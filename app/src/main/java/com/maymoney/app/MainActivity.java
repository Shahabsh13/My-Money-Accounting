package com.maymoney.app;

import android.Manifest;
import android.content.ContentValues;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * پوسته‌ی WebView برای نرم‌افزار «My Money».
 * فایل‌های برنامه‌ی وب از پوشه‌ی assets خوانده می‌شوند و از طریق
 * https://appassets.androidplatform.net/assets/index.html بارگذاری می‌شوند.
 *
 * پل بومی (HnBridge):
 * - backHandled() / exitApp() : تصمیم‌گیری دکمه‌ی برگشت سخت‌افزاری
 * - saveBackup(name, base64)  : ذخیره‌ی فایل پشتیبان برنامه‌ی وب در «دانلودها»
 */
public class MainActivity extends ComponentActivity {

    private static final String START_URL = "https://appassets.androidplatform.net/assets/index.html";
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String NATIVE_SQL_DB = "hesabno_native_store.db";
    private static final int NATIVE_SQL_DB_VERSION = 1;
    private static final String AUTO_BACKUP_FILE = "hesabno_auto_backup.json";
    private static final String AUTO_BACKUP_BAK_FILE = "hesabno_auto_backup.bak.json";
    private static final String ATTACHMENTS_DIR = "hesabno_attachments";
    private static final String CLOUD_PREFS = "hesabno_cloud_prefs";
    private static final String KEY_CLOUD_URI = "cloud_drive_uri";
    private static final String KEY_CLOUD_NAME = "cloud_drive_name";
    private static final String KEY_CLOUD_LAST_SYNC = "cloud_drive_last_sync";
    private final Object autoBackupLock = new Object();
    private final Object attachmentLock = new Object();
    private final Object sqlStoreLock = new Object();
    private volatile NativeSqlStoreHelper sqlStoreHelper;
    private volatile String pendingCloudBackupJson;

    // اگر برنامه‌ی وب بتواند برگشت درون‌برنامه‌ای انجام دهد، خودش اعلام می‌کند (backHandled)؛
    // وگرنه از HnBridge.exitApp خروج از برنامه را می‌خواهد.
    private static final String BACK_JS =
            "(function(){\nvar handled=false;\nfunction done(){if(handled)return;handled=true;try{if(window.HnBridge)window.H"
            + "nBridge.backHandled();}catch(e){}}\nfunction visible(el){if(!el||!el.getClientRects||!el.getClientRects().lengt"
            + "h)return false;var s=window.getComputedStyle?window.getComputedStyle(el):null;return !s||(s.display!=='none'&&"
            + "s.visibility!=='hidden'&&s.opacity!=='0');}\nfunction findBackButton(scope){if(!scope||!scope.querySelectorAll)"
            + "return null;var labels=['بازگشت','برگشت','انصراف','بستن'];var list=scope.querySelectorAll('button,[role=\"butto"
            + "n\"]');for(var i=list.length-1;i>=0;i--){var el=list[i];if(!visible(el))continue;var vals=[el.getAttribute('ari"
            + "a-label'),el.getAttribute('title'),el.innerText,el.textContent];for(var j=0;j<vals.length;j++){var label=Strin"
            + "g(vals[j]||'').replace(/\\s+/g,' ').trim();if(labels.indexOf(label)!==-1)return el;}}return null;}\ntry{var fr=d"
            + "ocument.getElementById('hesabno-first-run');if(fr){fr.parentNode.removeChild(fr);done();return;}}catch(e){}\ntr"
            + "y{var h=window.__hesabnoNavigateBack;if(typeof h==='function'&&h()){done();return;}}catch(e){}\ntry{var layers="
            + "document.querySelectorAll('.hesabno-fullpage-layer,[role=\"dialog\"],[aria-modal=\"true\"]');for(var i=layers.leng"
            + "th-1;i>=0;i--){if(!visible(layers[i]))continue;var lb=findBackButton(layers[i]);if(lb){lb.click();done();retur"
            + "n;}}var b=findBackButton(document.querySelector('main')||document);if(b){b.click();done();return;}}catch(e){}\n"
            + "try{var shouldExit=window.confirm('آیا می‌خواهید از برنامه خارج شوید؟');done();if(shouldExit&&window.HnBridge)"
            + "window.HnBridge.exitApp();}catch(e){done();}\n})();";

    private WebView webView;
    private final Handler handler = new Handler(Looper.getMainLooper());

    // نمایش کوتاه و پویا از آیکون در شروع هر بار اجرای تازه‌ی Activity
    private android.view.View startupSplash;
    private long startupSplashStartedAt;
    private boolean startupPageLoaded;
    private boolean startupSplashDismissScheduled;
    private boolean startupSplashDismissed;
    private static final long MIN_STARTUP_SPLASH_MS = 1350L;
    private static final long MAX_STARTUP_SPLASH_MS = 8000L;

    // انتخاب فایل برای <input type="file">
    private ValueCallback<Uri[]> filePathCallback;
    private final ActivityResultLauncher<Intent> filePicker =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (filePathCallback == null) return;
                Uri[] results = WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData());
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            });

    // اتصال و ذخیره‌ی پایدار در گوگل درایو (SAF) با مجوز ماندگار
    private final ActivityResultLauncher<Intent> cloudDriveCreatePicker =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                Intent data = result.getData();
                Uri uri = (result.getResultCode() == RESULT_OK && data != null) ? data.getData() : null;
                if (uri == null) {
                    pendingCloudBackupJson = null;
                    return;
                }
                persistCloudDriveUri(uri);
                String payload = pendingCloudBackupJson;
                pendingCloudBackupJson = null;
                if (payload != null && !payload.isEmpty()) {
                    boolean ok = writeCloudDriveUri(uri, payload);
                    toast(ok ? "به گوگل درایو متصل و پشتیبان ذخیره شد ✓" : "ذخیره در گوگل درایو ناموفق بود");
                }
                notifyWebCloudDriveChanged();
            });

    // انتخاب و بازیابی مستقیم فایل پشتیبان از گوگل درایو
    private final ActivityResultLauncher<Intent> cloudDriveRestorePicker =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                Intent data = result.getData();
                Uri uri = (result.getResultCode() == RESULT_OK && data != null) ? data.getData() : null;
                if (uri == null) return;
                persistCloudDriveUri(uri);
                String json = readCloudDriveUri(uri);
                if (json == null || json.isEmpty()) {
                    toast("خواندن فایل پشتیبان از گوگل درایو ناموفق بود");
                    return;
                }
                deliverCloudRestoreToWeb(json, resolveUriDisplayName(uri));
            });

    // ثبت عکس فیش/چک با دوربین گوشی و ارسال مستقیم تصویر فشرده‌شده به برنامه‌ی وب
    private final ActivityResultLauncher<Intent> cameraCaptureLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (result.getResultCode() != RESULT_OK || result.getData() == null) return;
                try {
                    Bundle extras = result.getData().getExtras();
                    Object rawBitmap = extras != null ? extras.get("data") : null;
                    if (rawBitmap instanceof android.graphics.Bitmap) {
                        android.graphics.Bitmap bmp = (android.graphics.Bitmap) rawBitmap;
                        java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                        bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, bos);
                        String b64 = android.util.Base64.encodeToString(bos.toByteArray(), android.util.Base64.NO_WRAP);
                        String dataUrl = "data:image/jpeg;base64," + b64;
                        deliverCameraPhotoToWeb(dataUrl, "camera-receipt-" + System.currentTimeMillis() + ".jpg");
                    }
                } catch (Exception e) {
                    toast("ثبت تصویر از دوربین انجام نشد");
                }
            });

    // دریافت زنده‌ی پیامک‌های بانکی جدید هنگام باز بودن برنامه
    private boolean smsReceiverRegistered;
    private final android.content.BroadcastReceiver smsReceiver = new android.content.BroadcastReceiver() {
        @Override
        public void onReceive(android.content.Context context, Intent intent) {
            if (intent == null || !"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) return;
            try {
                Bundle bundle = intent.getExtras();
                if (bundle == null) return;
                Object[] pdus = (Object[]) bundle.get("pdus");
                if (pdus == null || pdus.length == 0) return;
                String format = bundle.getString("format");
                StringBuilder fullBody = new StringBuilder();
                String sender = "";
                long timestamp = System.currentTimeMillis();
                for (Object pdu : pdus) {
                    android.telephony.SmsMessage msg = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                            ? android.telephony.SmsMessage.createFromPdu((byte[]) pdu, format)
                            : android.telephony.SmsMessage.createFromPdu((byte[]) pdu);
                    if (msg != null) {
                        if (sender.isEmpty() && msg.getOriginatingAddress() != null) {
                            sender = msg.getOriginatingAddress();
                        }
                        if (msg.getMessageBody() != null) {
                            fullBody.append(msg.getMessageBody());
                        }
                        if (msg.getTimestampMillis() > 0) {
                            timestamp = msg.getTimestampMillis();
                        }
                    }
                }
                String body = fullBody.toString().trim();
                if (isLikelyBankSms(body)) {
                    deliverIncomingSmsToWeb(sender, body, timestamp);
                }
            } catch (Exception ignored) {}
        }
    };

    // دکمه‌ی برگشت
    private volatile boolean backHandled;

    // پشتیبان معلق (اگر مجوز نوشتن برای اندروید ۲۸ و پایین‌تر هنوز داده نشده باشد)
    private volatile String pendingBackupName;
    private volatile byte[] pendingBackupData;
    private volatile String pendingNotifTitle;
    private volatile String pendingNotifMessage;
    private volatile String pendingNotifTarget;
    private static final String NOTIF_CHANNEL_ID = "hesabno_reminders_channel";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ensureNotificationChannel();

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        final android.widget.FrameLayout root = new android.widget.FrameLayout(this);
        root.setBackgroundColor(0xFF0C1F1D);
        root.addView(webView, new android.widget.FrameLayout.LayoutParams(-1, -1));
        startupSplash = createStartupSplash();
        root.addView(startupSplash, new android.widget.FrameLayout.LayoutParams(-1, -1));
        startupSplashStartedAt = android.os.SystemClock.uptimeMillis();
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int l = insets.getSystemWindowInsetLeft(), t = insets.getSystemWindowInsetTop();
            int r = insets.getSystemWindowInsetRight(), b = insets.getSystemWindowInsetBottom();
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout() | android.view.WindowInsets.Type.ime());
                l = i.left; t = i.top; r = i.right; b = i.bottom;
            }
            v.setPadding(l, t, r, b);
            return insets;
        });
        setContentView(root);
        startStartupSplashAnimation();
        handler.postDelayed(new Runnable() {
            @Override public void run() { dismissStartupSplashWhenReady(true); }
        }, MAX_STARTUP_SPLASH_MS);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);           // ذخیره‌ی داده‌ها در localStorage
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        webView.addJavascriptInterface(new NativeBridge(), "HnBridge");

        // بدون WebChromeClient، ورودی‌های نوع فایل (انتخاب فایل پشتیبان، پیوست فیش چک ...) کار نمی‌کنند.
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    filePicker.launch(Intent.createChooser(intent, "انتخاب فایل"));
                } catch (Exception e) {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    filePicker.launch(intent);
                }
                return true;
            }

            // پشتیبان گفتگوهای بومی (alert/confirm/prompt)؛ برنامه‌ی وب معمولاً
            // دیالوگ خودش را می‌سازد (004) و این‌ها فقط شبکه‌ی ایمنی هستند.
            @Override
            public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                new android.app.AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton("باشه", new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) { result.confirm(); }
                        })
                        .setCancelable(false)
                        .create()
                        .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new android.app.AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton("بله", new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) { result.confirm(); }
                        })
                        .setNegativeButton("انصراف", new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) { result.cancel(); }
                        })
                        .setOnCancelListener(new DialogInterface.OnCancelListener() {
                            @Override
                            public void onCancel(DialogInterface dialog) { result.cancel(); }
                        })
                        .create()
                        .show();
                return true;
            }

            @Override
            public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, JsPromptResult result) {
                final android.widget.EditText input = new android.widget.EditText(MainActivity.this);
                input.setText(defaultValue);
                new android.app.AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setView(input)
                        .setPositiveButton("تأیید", new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) { result.confirm(input.getText().toString()); }
                        })
                        .setNegativeButton("انصراف", new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) { result.cancel(); }
                        })
                        .setOnCancelListener(new DialogInterface.OnCancelListener() {
                            @Override
                            public void onCancel(DialogInterface dialog) { result.cancel(); }
                        })
                        .create()
                        .show();
                return true;
            }
        });

        // دانلودها (لینک‌های دانلود عادی)؛ فایل‌های blob: از طریق HnBridge.saveBackup ذخیره می‌شوند.
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                if (url == null || url.startsWith("blob:")) return;
                try {
                    DownloadManagerCompat.enqueue(MainActivity.this, Uri.parse(url));
                } catch (Exception ignored) {
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (startupSplash != null && !startupSplashDismissed) {
                    startupPageLoaded = true;
                    dismissStartupSplashWhenReady(false);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request != null && request.isForMainFrame() && startupSplash != null && !startupSplashDismissed) {
                    startupPageLoaded = true;
                    dismissStartupSplashWhenReady(false);
                }
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if (APP_HOST.equals(uri.getHost())
                        || "blob".equals(scheme) || "data".equals(scheme) || "about".equals(scheme)) {
                    return false;
                }
                // لینک‌های بیرونی در مرورگر باز شوند
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        // دکمه‌ی برگشت سخت‌افزاری: ابتدا تاریخچه‌ی WebView، بعد برگشت درون‌برنامه‌ای، در نهایت خروج.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                if (webView == null) {
                    finish();
                    return;
                }
                backHandled = false;
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        if (!backHandled) finish();
                    }
                }, 700);
                webView.evaluateJavascript(BACK_JS, null);
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
            // اگر وضعیت WebView بازیابی نشد (مثلاً پس از تغییر نسخه)، صفحه را از نو بارگذاری کن.
            if (webView.copyBackForwardList().getSize() == 0) {
                webView.loadUrl(START_URL);
            }
        } else {
            webView.loadUrl(START_URL);
        }
    }

    private android.view.View createStartupSplash() {
        android.widget.FrameLayout overlay = new android.widget.FrameLayout(this);
        overlay.setBackgroundColor(0xFF0C1F1D);
        overlay.setClickable(true);
        overlay.setFocusable(true);

        android.widget.FrameLayout emblem = new android.widget.FrameLayout(this);
        android.widget.FrameLayout.LayoutParams emblemParams = new android.widget.FrameLayout.LayoutParams(dp(190), dp(190), android.view.Gravity.CENTER);
        overlay.addView(emblem, emblemParams);

        android.view.View outerRing = createSplashRing(0xFF39D6A2, dp(2));
        android.view.View innerRing = createSplashRing(0xFF7CE8C5, dp(1));
        emblem.addView(outerRing, new android.widget.FrameLayout.LayoutParams(dp(154), dp(154), android.view.Gravity.CENTER));
        emblem.addView(innerRing, new android.widget.FrameLayout.LayoutParams(dp(118), dp(118), android.view.Gravity.CENTER));

        AnimatedStartupLogoView icon = new AnimatedStartupLogoView(this);
        emblem.addView(icon, new android.widget.FrameLayout.LayoutParams(dp(112), dp(112), android.view.Gravity.CENTER));

        android.widget.TextView title = new android.widget.TextView(this);
        title.setText("My Money");
        title.setTextColor(0xFFE6FFF5);
        title.setTextSize(18);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        title.setGravity(android.view.Gravity.CENTER);
        android.widget.FrameLayout.LayoutParams titleParams = new android.widget.FrameLayout.LayoutParams(-2, -2, android.view.Gravity.CENTER_HORIZONTAL | android.view.Gravity.CENTER_VERTICAL);
        titleParams.topMargin = dp(145);
        overlay.addView(title, titleParams);

        return overlay;
    }

    /** نسخه‌ی لایه‌ای آیکون برای اسپلش؛ نمودار و تیک مستقل از بدنه متحرک‌اند. */
    private final class AnimatedStartupLogoView extends android.view.View {
        private final android.graphics.Paint paint = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        private float phase;
        private final android.animation.ValueAnimator motion;

        AnimatedStartupLogoView(android.content.Context context) {
            super(context);
            motion = android.animation.ValueAnimator.ofFloat(0f, 1f);
            motion.setDuration(1250L);
            motion.setRepeatCount(android.animation.ValueAnimator.INFINITE);
            motion.addUpdateListener(a -> { phase = (float) a.getAnimatedValue(); invalidate(); });
        }

        @Override protected void onAttachedToWindow() {
            super.onAttachedToWindow();
            if (!motion.isStarted()) motion.start();
        }

        @Override protected void onDetachedFromWindow() {
            motion.cancel();
            super.onDetachedFromWindow();
        }

        @Override protected void onDraw(android.graphics.Canvas canvas) {
            super.onDraw(canvas);
            float scale = Math.min(getWidth(), getHeight()) / 192f;
            canvas.save();
            canvas.scale(scale, scale);
            // پس‌زمینه‌ی سبز-آبی و خطوط ظریف هماهنگ با آیکون واقعی برنامه
            paint.setShader(new android.graphics.LinearGradient(0, 0, 192, 192, 0xFF123E3B, 0xFF0B2928, android.graphics.Shader.TileMode.CLAMP));
            canvas.drawRoundRect(5, 5, 187, 187, 42, 42, paint);
            paint.setShader(null);
            paint.setStyle(android.graphics.Paint.Style.STROKE);
            paint.setStrokeWidth(1.5f);
            paint.setColor(0xFF245A54);
            canvas.drawRoundRect(12, 12, 180, 180, 38, 38, paint);
            paint.setStyle(android.graphics.Paint.Style.FILL);

            // گوشی کمی کج؛ حرکت آرام بدنه جدا از نمودار
            canvas.save();
            canvas.rotate(-9f + (float)Math.sin(phase * Math.PI * 2) * 1.6f, 88, 91);
            paint.setColor(0xFFBFE8D8);
            canvas.drawRoundRect(39, 13, 137, 169, 13, 13, paint);
            paint.setColor(0xFF173D3A);
            canvas.drawRoundRect(44, 20, 132, 160, 7, 7, paint);
            paint.setColor(0xFFE8F7EF);
            canvas.drawRoundRect(48, 24, 128, 156, 4, 4, paint);
            paint.setColor(0xFF244E49);
            canvas.drawRoundRect(71, 17, 105, 20, 1.5f, 1.5f, paint);
            canvas.drawRoundRect(56, 37, 112, 42, 2, 2, paint);
            canvas.drawRoundRect(56, 46, 99, 50, 2, 2, paint);
            // سه میله‌ی نمودار با ارتفاع‌های مستقل و موجی
            float[] base = {104, 91, 77};
            float[] heights = {27, 39, 51};
            for (int i = 0; i < 3; i++) {
                float bob = (float)Math.sin(phase * Math.PI * 2 + i * 1.35f) * 5f;
                float top = base[i] - heights[i] - bob;
                paint.setColor(i == 2 ? 0xFF2A8273 : 0xFF5BB89B);
                canvas.drawRoundRect(57 + i * 18, top, 69 + i * 18, 124, 5, 5, paint);
            }
            canvas.restore();

            // نشان تیک شناور با چرخش کوتاه و کنترل‌شده
            canvas.save();
            canvas.rotate((float)Math.sin(phase * Math.PI * 2) * 5f, 145, 123);
            float lift = (float)Math.sin(phase * Math.PI * 2) * 2.2f;
            paint.setColor(0xFF3A9D87);
            canvas.drawCircle(145, 123 + lift, 29, paint);
            paint.setColor(0xFFBFE8D8);
            paint.setStyle(android.graphics.Paint.Style.STROKE);
            paint.setStrokeWidth(2.5f);
            canvas.drawCircle(145, 123 + lift, 25.5f, paint);
            paint.setStyle(android.graphics.Paint.Style.STROKE);
            paint.setStrokeCap(android.graphics.Paint.Cap.ROUND);
            paint.setStrokeJoin(android.graphics.Paint.Join.ROUND);
            paint.setStrokeWidth(6f);
            paint.setColor(android.graphics.Color.WHITE);
            android.graphics.Path check = new android.graphics.Path();
            check.moveTo(133, 123 + lift);
            check.lineTo(141, 131 + lift);
            check.lineTo(157, 114 + lift);
            canvas.drawPath(check, paint);
            paint.setStyle(android.graphics.Paint.Style.FILL);
            canvas.restore();
            canvas.restore();
        }
    }

    private android.view.View createSplashRing(int color, int strokeWidth) {
        android.view.View ring = new android.view.View(this);
        android.graphics.drawable.GradientDrawable shape = new android.graphics.drawable.GradientDrawable();
        shape.setShape(android.graphics.drawable.GradientDrawable.OVAL);
        shape.setColor(android.graphics.Color.TRANSPARENT);
        shape.setStroke(strokeWidth, color);
        ring.setBackground(shape);
        ring.setAlpha(0.72f);
        return ring;
    }

    private int dp(float value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private void startStartupSplashAnimation() {
        if (startupSplash == null) return;
        android.widget.FrameLayout emblem = (android.widget.FrameLayout) ((android.widget.FrameLayout) startupSplash).getChildAt(0);
        if (emblem == null) return;
        android.view.View outer = emblem.getChildAt(0);
        android.view.View inner = emblem.getChildAt(1);
        android.view.View emblemIcon = emblem.getChildAt(2);
        if (outer != null) {
            android.animation.ObjectAnimator sx = android.animation.ObjectAnimator.ofFloat(outer, android.view.View.SCALE_X, 0.72f, 1.22f);
            android.animation.ObjectAnimator sy = android.animation.ObjectAnimator.ofFloat(outer, android.view.View.SCALE_Y, 0.72f, 1.22f);
            android.animation.ObjectAnimator alpha = android.animation.ObjectAnimator.ofFloat(outer, android.view.View.ALPHA, 0.72f, 0f);
            for (android.animation.ObjectAnimator animator : new android.animation.ObjectAnimator[]{sx, sy, alpha}) {
                animator.setDuration(1150L);
                animator.setRepeatCount(android.animation.ValueAnimator.INFINITE);
            }
            sx.start(); sy.start(); alpha.start();
        }
        if (inner != null) {
            android.animation.ObjectAnimator sx = android.animation.ObjectAnimator.ofFloat(inner, android.view.View.SCALE_X, 0.78f, 1.16f);
            android.animation.ObjectAnimator sy = android.animation.ObjectAnimator.ofFloat(inner, android.view.View.SCALE_Y, 0.78f, 1.16f);
            android.animation.ObjectAnimator alpha = android.animation.ObjectAnimator.ofFloat(inner, android.view.View.ALPHA, 0.72f, 0f);
            for (android.animation.ObjectAnimator animator : new android.animation.ObjectAnimator[]{sx, sy, alpha}) {
                animator.setDuration(1150L);
                animator.setStartDelay(430L);
                animator.setRepeatCount(android.animation.ValueAnimator.INFINITE);
            }
            sx.start(); sy.start(); alpha.start();
        }
        if (emblemIcon != null) {
            android.animation.ObjectAnimator scaleX = android.animation.ObjectAnimator.ofFloat(emblemIcon, android.view.View.SCALE_X, 0.96f, 1.02f, 0.98f, 1f);
            android.animation.ObjectAnimator scaleY = android.animation.ObjectAnimator.ofFloat(emblemIcon, android.view.View.SCALE_Y, 0.96f, 1.02f, 0.98f, 1f);
            android.animation.ObjectAnimator rotation = android.animation.ObjectAnimator.ofFloat(emblemIcon, android.view.View.ROTATION, 0f, -2.5f, 2.5f, 0f);
            for (android.animation.ObjectAnimator animator : new android.animation.ObjectAnimator[]{scaleX, scaleY, rotation}) {
                animator.setDuration(1900L);
                animator.setRepeatCount(android.animation.ValueAnimator.INFINITE);
            }
            scaleX.start(); scaleY.start(); rotation.start();
        }
    }

    private void dismissStartupSplashWhenReady(boolean timeoutReached) {
        if (startupSplash == null || startupSplashDismissed) return;
        if (!startupPageLoaded && !timeoutReached) return;
        if (startupSplashDismissScheduled) return;
        startupSplashDismissScheduled = true;
        long elapsed = android.os.SystemClock.uptimeMillis() - startupSplashStartedAt;
        long remaining = Math.max(0L, MIN_STARTUP_SPLASH_MS - elapsed);
        handler.postDelayed(new Runnable() {
            @Override public void run() {
                if (startupSplash == null || startupSplashDismissed) return;
                startupSplashDismissed = true;
                final android.view.View splash = startupSplash;
                splash.animate().alpha(0f).setDuration(240L).withEndAction(new Runnable() {
                    @Override public void run() {
                        if (splash.getParent() instanceof android.view.ViewGroup) {
                            ((android.view.ViewGroup) splash.getParent()).removeView(splash);
                        }
                        if (startupSplash == splash) startupSplash = null;
                    }
                }).start();
            }
        }, remaining);
    }

    @Override
    protected void onPause() {
        recordUserActivityAndSchedule4DayReminder(this);
        if (smsReceiverRegistered) {
            try {
                unregisterReceiver(smsReceiver);
            } catch (Exception ignored) {}
            smsReceiverRegistered = false;
        }
        if (webView != null) {
            try {
                webView.evaluateJavascript("if(typeof window.__hesabnoFlushAutoBackup==='function')window.__hesabnoFlushAutoBackup();", null);
            } catch (Exception ignored) {
            }
        }
        super.onPause();
        if (webView != null) webView.onPause();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationDashboardIntent(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            try {
                webView.evaluateJavascript("if(typeof window.__hesabnoRefreshPermissionsState==='function')window.__hesabnoRefreshPermissionsState();", null);
            } catch (Exception ignored) {}
        }
        recordUserActivityAndSchedule4DayReminder(this);
        handleNotificationDashboardIntent(getIntent());
        if (!smsReceiverRegistered && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED) {
            try {
                android.content.IntentFilter filter = new android.content.IntentFilter("android.provider.Telephony.SMS_RECEIVED");
                if (Build.VERSION.SDK_INT >= 33) {
                    registerReceiver(smsReceiver, filter, android.content.Context.RECEIVER_EXPORTED);
                } else {
                    registerReceiver(smsReceiver, filter);
                }
                smsReceiverRegistered = true;
            } catch (Exception ignored) {}
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    private void notifyPermissionResultToWeb(final String permKey, final boolean granted) {
        if (webView == null || permKey == null) return;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    String script = "if(typeof window.__hesabnoOnNativePermissionResult==='function')window.__hesabnoOnNativePermissionResult("
                            + org.json.JSONObject.quote(permKey) + "," + granted + ");";
                    webView.evaluateJavascript(script, null);
                } catch (Exception ignored) {}
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 1001 && pendingBackupName != null && pendingBackupData != null) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            notifyPermissionResultToWeb("storage", granted);
            boolean ok = granted && writeFileToDownloads(pendingBackupName, pendingBackupData);
            pendingBackupName = null;
            pendingBackupData = null;
            toast(ok ? "پشتیبان در «دانلودها» ذخیره شد" : "ذخیره‌ی پشتیبان ناموفق بود");
        } else if (requestCode == 1002) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            notifyPermissionResultToWeb("camera", granted);
            if (granted) {
                launchCameraIntent();
            } else {
                toast("برای عکس‌برداری از فیش، مجوز دوربین لازم است");
            }
        } else if (requestCode == 1003) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            notifyPermissionResultToWeb("sms", granted);
            if (granted) {
                String json = queryBankSmsFromDevice(120);
                deliverSmsBatchToWeb(json);
                toast("مجوز دسترسی به پیامک‌های بانکی فعال شد");
            } else {
                toast("برای خواندن خودکار پیامک‌های بانکی، مجوز پیامک لازم است");
            }
        } else if (requestCode == 1004) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            notifyPermissionResultToWeb("notifications", granted);
            if (granted) {
                if (pendingNotifTitle != null || pendingNotifMessage != null) {
                    String t = pendingNotifTitle != null ? pendingNotifTitle : "وقتشه حسابامونو صاف کنیم";
                    String m = pendingNotifMessage != null ? pendingNotifMessage : "یادآوری ثبت روزانه";
                    String tgt = pendingNotifTarget != null ? pendingNotifTarget : "home";
                    pendingNotifTitle = null;
                    pendingNotifMessage = null;
                    pendingNotifTarget = null;
                    postStaticNotification(MainActivity.this, t, m, tgt);
                } else {
                    toast("مجوز ارسال اعلان فعال شد");
                }
            } else {
                pendingNotifTitle = null;
                pendingNotifMessage = null;
                pendingNotifTarget = null;
                toast("برای ارسال یادآوری، مجوز اعلان لازم است");
            }
        } else if (requestCode == 1005) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            notifyPermissionResultToWeb("camera", granted);
            toast(granted ? "مجوز دسترسی به دوربین فعال شد" : "مجوز دسترسی به دوربین تأیید نشد");
        } else if (requestCode == 1006) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            notifyPermissionResultToWeb("storage", granted);
            toast(granted ? "مجوز دسترسی به حافظه فعال شد" : "مجوز دسترسی به حافظه تأیید نشد");
        }
    }

    private void toast(final String message) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                android.widget.Toast.makeText(MainActivity.this, message, android.widget.Toast.LENGTH_LONG).show();
            }
        });
    }

    /** پل بومی؛ متدهای آن از جاوااسکریپت برنامه‌ی وب فراخوانی می‌شوند. */
    private class NativeBridge {

        @JavascriptInterface
        public void backHandled() {
            backHandled = true;
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    finish();
                }
            });
        }

        /**
         * پشتیبان برنامه‌ی وب را در پوشه‌ی «دانلودها» می‌نویسد.
         * مقدار بولی برگشتی به‌صورت همگام به جاوااسکریپت برمی‌گردد.
         */
        @JavascriptInterface
        public boolean saveBackup(String name, String base64) {
            try {
                byte[] data = android.util.Base64.decode(base64 == null ? "" : base64, android.util.Base64.DEFAULT);
                boolean ok = saveToDownloads(name, data);
                if (!ok) toast("ذخیره‌ی پشتیبان ناموفق بود");
                return ok;
            } catch (Exception e) {
                toast("ذخیره‌ی پشتیبان ناموفق بود");
                return false;
            }
        }

        /**
         * کپی خودکار و اتمی داده‌های localStorage در پوشه‌ی استاندارد فایل‌های اندروید
         * (شامل‌شده در Android Auto Backup برای بازیابی خودکار پس از حذف و نصب مجدد)
         * و همگام‌سازی خودکار با فایل ماندگار انتخاب‌شده در حافظه گوشی / گوگل درایو.
         */
        @JavascriptInterface
        public boolean saveAutoBackup(String jsonPayload) {
            boolean ok = writeAutoBackupFile(jsonPayload);
            final Uri cloudUri = getSavedCloudDriveUri();
            final String payloadCopy = jsonPayload;
            if (ok && cloudUri != null && payloadCopy != null && !payloadCopy.isEmpty()) {
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            writeCloudDriveUri(cloudUri, payloadCopy);
                        } catch (Exception ignored) {}
                    }
                }).start();
            }
            return ok;
        }

        /**
         * پایگاه داده‌ی بومی SQLite اندروید (بدون محدودیت ۵ مگابایتی WebView، با تراکنش‌های ACID و WAL).
         */
        @JavascriptInterface
        public String sqlGetItem(String key) {
            return sqlReadKv(key);
        }

        @JavascriptInterface
        public boolean sqlSetItem(String key, String value) {
            return sqlWriteKv(key, value);
        }

        @JavascriptInterface
        public boolean sqlRemoveItem(String key) {
            return sqlDeleteKv(key);
        }

        @JavascriptInterface
        public boolean sqlClear() {
            return sqlClearAllKv();
        }

        @JavascriptInterface
        public String sqlExportAllJson() {
            return sqlExportAllKvJson();
        }

        @JavascriptInterface
        public boolean sqlImportAllJson(String jsonEntries) {
            return sqlImportAllKvJson(jsonEntries);
        }

        /**
         * ذخیره‌ی فایل پیوست (تصویر فیش/چک) در SQLite بومی و فایل‌سیستم داخلی اندروید خارج از محدودیت ۵ مگابایتی localStorage.
         */
        @JavascriptInterface
        public boolean saveAttachment(String id, String dataUrl) {
            boolean sqlOk = sqlWriteAttachment(id, dataUrl);
            boolean fileOk = writeAttachmentFile(id, dataUrl);
            return sqlOk || fileOk;
        }

        /**
         * خواندن همگام تصویر پیوست با شناسه.
         */
        @JavascriptInterface
        public String readAttachment(String id) {
            String fromSql = sqlReadAttachment(id);
            if (fromSql != null && !fromSql.isEmpty()) return fromSql;
            return readAttachmentFile(id);
        }

        /**
         * حذف فایل پیوست از حافظه.
         */
        @JavascriptInterface
        public boolean deleteAttachment(String id) {
            boolean sqlOk = sqlDeleteAttachment(id);
            boolean fileOk = deleteAttachmentFile(id);
            return sqlOk || fileOk;
        }

        /**
         * خروجی JSON از تمام پیوست‌های ذخیره‌شده برای گنجاندن در فایل پشتیبان ماندگار.
         */
        @JavascriptInterface
        public String exportAllAttachmentsJson() {
            return exportAttachmentsJsonString();
        }

        /**
         * بازیابی تمام پیوست‌ها از فایل پشتیبان به پوشه‌ی پیوست‌ها و SQLite بومی.
         */
        @JavascriptInterface
        public boolean importAllAttachmentsJson(String jsonMap) {
            return importAttachmentsFromJsonString(jsonMap);
        }

        /**
         * خواندن آخرین پشتیبان خودکار هنگام راه‌اندازی (در صورت خالی بودن حافظه‌ی WebView پس از نصب مجدد).
         */
        @JavascriptInterface
        public String readAutoBackup() {
            String local = readAutoBackupFile();
            if (!local.isEmpty()) return local;
            Uri cloudUri = getSavedCloudDriveUri();
            return cloudUri != null ? readCloudDriveUri(cloudUri) : "";
        }

        /**
         * اتصال به گوگل درایو و ذخیره‌ی فایل پشتیبان ابری با مجوز ماندگار (یک‌بار انتخاب، همگام‌سازی دائمی).
         */
        @JavascriptInterface
        public boolean connectCloudDrive(final String jsonPayload, final String suggestedName) {
            pendingCloudBackupJson = jsonPayload;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        String fileName = (suggestedName == null || suggestedName.trim().isEmpty())
                                ? "MyMoney-GoogleDrive-Backup.json" : suggestedName.trim();
                        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                        intent.addCategory(Intent.CATEGORY_OPENABLE);
                        intent.setType("application/json");
                        intent.putExtra(Intent.EXTRA_TITLE, fileName);
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            intent.putExtra(android.provider.DocumentsContract.EXTRA_INITIAL_URI,
                                    Uri.parse("content://com.google.android.apps.docs.storage/root"));
                        }
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                        cloudDriveCreatePicker.launch(intent);
                    } catch (Exception e) {
                        toast("امکان باز کردن انتخابگر گوگل درایو وجود ندارد");
                    }
                }
            });
            return true;
        }

        /**
         * همگام‌سازی فوری با فایل متصل‌شده در گوگل درایو (بدون نیاز به باز کردن مجدد پنجره انتخاب).
         */
        @JavascriptInterface
        public boolean syncToCloudDrive(String jsonPayload) {
            Uri uri = getSavedCloudDriveUri();
            if (uri == null) return false;
            boolean ok = writeCloudDriveUri(uri, jsonPayload);
            if (ok) toast("با گوگل درایو همگام‌سازی شد ✓");
            return ok;
        }

        /**
         * خواندن مستقیم آخرین پشتیبان از فایل متصل‌شده در گوگل درایو.
         */
        @JavascriptInterface
        public String readFromCloudDrive() {
            Uri uri = getSavedCloudDriveUri();
            if (uri == null) return "";
            return readCloudDriveUri(uri);
        }

        /**
         * باز کردن گوگل درایو برای انتخاب فایل پشتیبان (مناسب گوشی جدید یا نصب مجدد).
         */
        @JavascriptInterface
        public boolean pickCloudBackupToRestore() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent driveIntent = new Intent(Intent.ACTION_GET_CONTENT);
                        driveIntent.addCategory(Intent.CATEGORY_OPENABLE);
                        driveIntent.setType("*/*");
                        driveIntent.setPackage("com.google.android.apps.docs");
                        driveIntent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                        driveIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        if (driveIntent.resolveActivity(getPackageManager()) != null) {
                            cloudDriveRestorePicker.launch(driveIntent);
                            return;
                        }
                        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                        intent.addCategory(Intent.CATEGORY_OPENABLE);
                        intent.setType("*/*");
                        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            intent.putExtra(android.provider.DocumentsContract.EXTRA_INITIAL_URI,
                                    Uri.parse("content://com.google.android.apps.docs.storage/root"));
                        }
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                        cloudDriveRestorePicker.launch(intent);
                    } catch (Exception e) {
                        toast("امکان باز کردن گوگل درایو وجود ندارد");
                    }
                }
            });
            return true;
        }

        /**
         * دریافت وضعیت اتصال به گوگل درایو به‌صورت JSON.
         */
        @JavascriptInterface
        public String getCloudDriveStatus() {
            android.content.SharedPreferences prefs = getSharedPreferences(CLOUD_PREFS, MODE_PRIVATE);
            String uriStr = prefs.getString(KEY_CLOUD_URI, "");
            String name = prefs.getString(KEY_CLOUD_NAME, "MyMoney-GoogleDrive-Backup.json");
            String lastSync = prefs.getString(KEY_CLOUD_LAST_SYNC, "");
            boolean connected = uriStr != null && !uriStr.isEmpty();
            return "{\"connected\":" + connected
                    + ",\"fileName\":" + org.json.JSONObject.quote(name)
                    + ",\"lastSync\":" + org.json.JSONObject.quote(lastSync) + "}";
        }

        /**
         * قطع اتصال فایل فعلی گوگل درایو (برای تغییر حساب یا مسیر).
         */
        @JavascriptInterface
        public boolean disconnectCloudDrive() {
            getSharedPreferences(CLOUD_PREFS, MODE_PRIVATE).edit()
                    .remove(KEY_CLOUD_URI)
                    .remove(KEY_CLOUD_NAME)
                    .remove(KEY_CLOUD_LAST_SYNC)
                    .apply();
            return true;
        }

        /**
         * باز کردن مستقیم دوربین گوشی برای ثبت عکس فیش یا چک پیوست.
         */
        @JavascriptInterface
        public boolean captureCameraPhoto() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                            && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, 1002);
                        return;
                    }
                    launchCameraIntent();
                }
            });
            return true;
        }

        /**
         * بررسی وضعیت مجوز دسترسی به دوربین.
         */
        @JavascriptInterface
        public boolean hasCameraPermission() {
            return Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                    || checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
        }

        /**
         * درخواست مجوز دسترسی به دوربین از کاربر روی گوشی.
         */
        @JavascriptInterface
        public boolean requestCameraPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, 1005);
                    }
                });
                return false;
            }
            return true;
        }

        /**
         * بررسی وضعیت مجوز دسترسی به حافظه دستگاه.
         */
        @JavascriptInterface
        public boolean hasStoragePermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                return true;
            }
            return Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                    || checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
        }

        /**
         * درخواست مجوز دسترسی به حافظه از کاربر روی گوشی.
         */
        @JavascriptInterface
        public boolean requestStoragePermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    && Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                    && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE, Manifest.permission.READ_EXTERNAL_STORAGE}, 1006);
                    }
                });
                return false;
            }
            return true;
        }

        /**
         * بررسی وضعیت مجوز خواندن پیامک‌های بانکی.
         */
        @JavascriptInterface
        public boolean hasSmsPermission() {
            return Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                    || checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
        }

        /**
         * درخواست مجوز خواندن و دریافت پیامک‌های بانکی از کاربر روی گوشی.
         */
        @JavascriptInterface
        public boolean requestSmsPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    && checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        requestPermissions(new String[]{Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS}, 1003);
                    }
                });
                return false;
            }
            return true;
        }

        /**
         * خواندن پیامک‌های بانکی از صندوق پیامک گوشی (در صورت نبود مجوز، پنجره مجوز اندروید باز می‌شود).
         */
        @JavascriptInterface
        public String readBankSmsInboxJson(final int maxCount) {
            final int limit = maxCount > 0 && maxCount <= 500 ? maxCount : 120;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    && checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        requestPermissions(new String[]{Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS}, 1003);
                    }
                });
                return "[]";
            }
            return queryBankSmsFromDevice(limit);
        }

        /**
         * خواندن شماره نسخه‌ی دقیق نرم‌افزار (versionName) از پکیج اندروید (که از version.properties ساخته می‌شود).
         */
        @JavascriptInterface
        public String getAppVersionName() {
            try {
                android.content.pm.PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
                if (pInfo != null && pInfo.versionName != null && !pInfo.versionName.trim().isEmpty()) {
                    return pInfo.versionName.trim();
                }
            } catch (Exception ignored) {}
            return "1.0.2";
        }

        /**
         * خواندن کد نسخه‌ی اندروید (versionCode) از پکیج نصب‌شده روی گوشی.
         */
        @JavascriptInterface
        public int getAppVersionCode() {
            try {
                android.content.pm.PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
                if (pInfo != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        return (int) pInfo.getLongVersionCode();
                    }
                    return pInfo.versionCode;
                }
            } catch (Exception ignored) {}
            return 3;
        }

        /**
         * بازگشایی قفل برنامه با حسگر اثر انگشت / تشخیص چهره سیستمی اندروید (API 28+).
         */
        @JavascriptInterface
        public boolean authenticateBiometric() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            android.os.CancellationSignal cancelSignal = new android.os.CancellationSignal();
                            android.hardware.biometrics.BiometricPrompt prompt =
                                    new android.hardware.biometrics.BiometricPrompt.Builder(MainActivity.this)
                                            .setTitle("بازگشایی قفل My Money")
                                            .setSubtitle("اثر انگشت خود را برای ورود لمس کنید")
                                            .setNegativeButton("استفاده از رمز ۴ رقمی", getMainExecutor(),
                                                    new android.content.DialogInterface.OnClickListener() {
                                                        @Override
                                                        public void onClick(android.content.DialogInterface dialog, int which) {
                                                            if (webView != null) {
                                                                webView.evaluateJavascript(
                                                                        "if(window.__hesabnoOnBiometricAuthResult)window.__hesabnoOnBiometricAuthResult(false);",
                                                                        null
                                                                );
                                                            }
                                                        }
                                                    })
                                            .build();
                            prompt.authenticate(cancelSignal, getMainExecutor(),
                                    new android.hardware.biometrics.BiometricPrompt.AuthenticationCallback() {
                                        @Override
                                        public void onAuthenticationSucceeded(
                                                android.hardware.biometrics.BiometricPrompt.AuthenticationResult result) {
                                            if (webView != null) {
                                                webView.evaluateJavascript(
                                                        "if(window.__hesabnoOnBiometricAuthResult)window.__hesabnoOnBiometricAuthResult(true);",
                                                        null
                                                );
                                            }
                                        }

                                        @Override
                                        public void onAuthenticationFailed() {
                                            if (webView != null) {
                                                webView.evaluateJavascript(
                                                        "if(window.__hesabnoOnBiometricAuthResult)window.__hesabnoOnBiometricAuthResult(false);",
                                                        null
                                                );
                                            }
                                        }
                                    });
                        } else if (webView != null) {
                            webView.evaluateJavascript(
                                    "if(window.__hesabnoOnBiometricAuthResult)window.__hesabnoOnBiometricAuthResult(true);",
                                    null
                            );
                        }
                    } catch (Exception ignored) {}
                }
            });
            return true;
        }

        /**
         * بررسی وضعیت مجوز ارسال اعلان (اندروید ۱۳ به بالا و وضعیت کلی اعلان‌های برنامه).
         */
        @JavascriptInterface
        public boolean hasNotificationPermission() {
            if (Build.VERSION.SDK_INT >= 33) {
                if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                    return false;
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (nm != null && !nm.areNotificationsEnabled()) {
                    return false;
                }
            }
            return true;
        }

        /**
         * درخواست مجوز ارسال اعلان از کاربر در اندروید ۱۳ به بالا (یا هدایت به تنظیمات اعلان برنامه).
         */
        @JavascriptInterface
        public boolean requestNotificationPermission() {
            if (Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1004);
                    }
                });
                return false;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (nm != null && !nm.areNotificationsEnabled()) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                Intent settingsIntent = new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                                        .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName());
                                startActivity(settingsIntent);
                            } catch (Exception ignored) {}
                        }
                    });
                    return false;
                }
            }
            return true;
        }

        /**
         * ارسال اعلان سیستمی اندروید با متن ثابت روزانه:
         * عنوان اصلی: «وقتشه حسابامونو صاف کنیم»
         * زیرنویس ریز: «یادآوری ثبت روزانه»
         */
        @JavascriptInterface
        public String getNotificationHistoryJson() {
            return getSharedPreferences(CLOUD_PREFS, MODE_PRIVATE).getString("notification_history", "[]");
        }

        @JavascriptInterface
        public boolean showNotification(final String title, final String message) {
            return showNotificationWithTarget(title, message, "home");
        }

        /**
         * ارسال اعلان سیستمی اندروید با مشخص کردن صفحه‌ی مقصد هنگام لمس اعلان (مثلاً "home" یا "checks").
         */
        @JavascriptInterface
        public boolean showNotificationWithTarget(final String title, final String message, final String targetPage) {
            final String safeTitle = (title == null || title.trim().isEmpty())
                    ? "وقتشه حسابامونو صاف کنیم"
                    : title.trim();
            final String safeMessage = (message == null || message.trim().isEmpty())
                    ? "یادآوری ثبت روزانه"
                    : message.trim();
            final String safeTarget = (targetPage == null || targetPage.trim().isEmpty())
                    ? "home"
                    : targetPage.trim();
            if (Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                pendingNotifTitle = safeTitle;
                pendingNotifMessage = safeMessage;
                pendingNotifTarget = safeTarget;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1004);
                    }
                });
                return false;
            }
            return postStaticNotification(MainActivity.this, safeTitle, safeMessage, safeTarget);
        }

        /**
         * ذخیره‌ی تنظیمات یادآوری روزانه و متن دلخواه اعلان در حافظه‌ی بومی.
         */
        @JavascriptInterface
        public boolean saveDailyReminderConfig(boolean enabled, String timeHHmm, String customTitle, String customMessage) {
            try {
                getSharedPreferences(CLOUD_PREFS, MODE_PRIVATE).edit()
                        .putBoolean("daily_reminder_enabled", enabled)
                        .putString("daily_reminder_time", timeHHmm != null ? timeHHmm : "21:00")
                        .putString("daily_reminder_title", customTitle != null ? customTitle : "")
                        .putString("daily_reminder_message", customMessage != null ? customMessage : "")
                        .apply();
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /**
         * زمان‌بندی مجدد یادآور ۴ روز عدم ورود به برنامه.
         */
        @JavascriptInterface
        public boolean scheduleInactivityReminder() {
            recordUserActivityAndSchedule4DayReminder(MainActivity.this);
            return true;
        }
    }

    public static final String ACTION_INACTIVITY_REMINDER = "com.maymoney.app.ACTION_INACTIVITY_REMINDER";
    public static final long INACTIVITY_THRESHOLD_MS = 4L * 24L * 60L * 60L * 1000L; // ۴ روز (۹۶ ساعت)
    public static final String INACTIVITY_NOTIF_TITLE = "حساب کتاب رفته مرخصی؟😂";
    public static final String INACTIVITY_NOTIF_BODY = "بیا دوباره مرتبش کنیم";
    private static final String KEY_LAST_APP_OPEN_TS = "last_app_open_ts";

    public static void recordUserActivityAndSchedule4DayReminder(android.content.Context context) {
        if (context == null) return;
        try {
            long now = System.currentTimeMillis();
            context.getSharedPreferences(CLOUD_PREFS, MODE_PRIVATE)
                    .edit()
                    .putLong(KEY_LAST_APP_OPEN_TS, now)
                    .apply();
            scheduleInactivityAlarmAt(context, now + INACTIVITY_THRESHOLD_MS);
        } catch (Exception ignored) {}
    }

    public static void scheduleInactivityAlarmAt(android.content.Context context, long triggerAtMillis) {
        if (context == null) return;
        try {
            android.app.AlarmManager am = (android.app.AlarmManager) context.getSystemService(ALARM_SERVICE);
            if (am == null) return;
            Intent intent = new Intent(context, InactivityReminderReceiver.class);
            intent.setAction(ACTION_INACTIVITY_REMINDER);
            int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    ? (android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE)
                    : android.app.PendingIntent.FLAG_UPDATE_CURRENT;
            android.app.PendingIntent pi = android.app.PendingIntent.getBroadcast(context, 4004, intent, flags);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } else {
                am.set(android.app.AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            }
        } catch (Exception ignored) {}
    }

    public static void ensureStaticNotificationChannel(android.content.Context context) {
        if (context != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                android.app.NotificationManager nm = (android.app.NotificationManager) context.getSystemService(NOTIFICATION_SERVICE);
                if (nm == null) return;
                android.app.NotificationChannel channel = new android.app.NotificationChannel(
                        NOTIF_CHANNEL_ID,
                        "یادآوری‌ها و اعلان‌های مالی",
                        android.app.NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("یادآور روزانه ثبت هزینه و یادآور ۴ روز عدم ورود به برنامه");
                nm.createNotificationChannel(channel);
            } catch (Exception ignored) {}
        }
    }

    public static boolean postStaticNotification(android.content.Context context, String title, String message) {
        return postStaticNotification(context, title, message, "home");
    }

    public static boolean postStaticNotification(android.content.Context context, String title, String message, String targetPage) {
        if (context == null) return false;
        try {
            if (Build.VERSION.SDK_INT >= 33
                    && context.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
            ensureStaticNotificationChannel(context);
            android.app.NotificationManager nm = (android.app.NotificationManager) context.getSystemService(NOTIFICATION_SERVICE);
            if (nm == null) return false;
            String safeTarget = (targetPage == null || targetPage.trim().isEmpty()) ? "home" : targetPage.trim();
            Intent intent = new Intent(context, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.putExtra("hesabno_open_dashboard", true);
            intent.putExtra("hesabno_open_target", safeTarget);
            String historyId = java.util.UUID.randomUUID().toString();
            synchronized (MainActivity.class) {
                android.content.SharedPreferences prefs = context.getSharedPreferences(CLOUD_PREFS, android.content.Context.MODE_PRIVATE);
                org.json.JSONArray history = new org.json.JSONArray(prefs.getString("notification_history", "[]"));
                org.json.JSONObject entry = new org.json.JSONObject();
                entry.put("id", historyId);
                entry.put("title", title);
                entry.put("body", message);
                entry.put("target", safeTarget);
                entry.put("createdAt", System.currentTimeMillis());
                history.put(entry);
                prefs.edit().putString("notification_history", history.toString()).apply();
            }
            intent.putExtra("hesabno_notification_id", historyId);
            intent.setData(android.net.Uri.parse("maymoney://notification/" + historyId));

            int reqCode = "checks".equals(safeTarget) ? 1002 : 1001;
            int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    ? (android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE)
                    : android.app.PendingIntent.FLAG_UPDATE_CURRENT;
            android.app.PendingIntent pi = android.app.PendingIntent.getActivity(context, reqCode, intent, flags);
            android.app.Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? new android.app.Notification.Builder(context, NOTIF_CHANNEL_ID)
                    : new android.app.Notification.Builder(context);
            builder.setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setStyle(new android.app.Notification.BigTextStyle().bigText(message))
                    .setAutoCancel(true)
                    .setContentIntent(pi);
            nm.notify((int) (System.currentTimeMillis() & 0x7FFFFFFF), builder.build());
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * گیرنده‌ی بومی زمان‌سنج ۴ روز عدم ورود به برنامه (حتی در صورت بسته بودن برنامه یا ری‌استارت گوشی).
     */
    public static class InactivityReminderReceiver extends android.content.BroadcastReceiver {
        @Override
        public void onReceive(android.content.Context context, Intent intent) {
            if (context == null || intent == null) return;
            String action = intent.getAction();
            try {
                long lastOpen = context.getSharedPreferences(CLOUD_PREFS, MODE_PRIVATE).getLong(KEY_LAST_APP_OPEN_TS, 0L);
                long now = System.currentTimeMillis();
                if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
                    if (lastOpen <= 0L) return;
                    long target = lastOpen + INACTIVITY_THRESHOLD_MS;
                    if (now >= target) {
                        postStaticNotification(context, INACTIVITY_NOTIF_TITLE, INACTIVITY_NOTIF_BODY);
                    } else {
                        scheduleInactivityAlarmAt(context, target);
                    }
                } else if (ACTION_INACTIVITY_REMINDER.equals(action)) {
                    if (lastOpen > 0L && (now - lastOpen) < (INACTIVITY_THRESHOLD_MS - 60000L)) {
                        scheduleInactivityAlarmAt(context, lastOpen + INACTIVITY_THRESHOLD_MS);
                        return;
                    }
                    postStaticNotification(context, INACTIVITY_NOTIF_TITLE, INACTIVITY_NOTIF_BODY);
                }
            } catch (Exception ignored) {}
        }
    }

    private void ensureNotificationChannel() {
        ensureStaticNotificationChannel(this);
    }

    private boolean postAndroidNotification(String title, String message) {
        return postStaticNotification(this, title, message, "home");
    }

    private void handleNotificationDashboardIntent(Intent intent) {
        if (intent == null || !intent.getBooleanExtra("hesabno_open_dashboard", false)) return;
        final String target = intent.getStringExtra("hesabno_open_target");
        final String notificationId = intent.getStringExtra("hesabno_notification_id");
        intent.removeExtra("hesabno_open_dashboard");
        intent.removeExtra("hesabno_open_target");
        if (webView == null) return;
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                try {
                    if (webView != null) {
                        if (notificationId != null) webView.evaluateJavascript(
                            "window.HnNotificationCenter?.sync();window.HnNotificationCenter?.readNative(" + org.json.JSONObject.quote(notificationId) + ");", null);
                        if ("checks".equals(target)) {
                            webView.evaluateJavascript("window.__hesabnoPendingNotificationTarget='checks';if(typeof window.__hesabnoOpenChecksFromNotification==='function')window.__hesabnoOpenChecksFromNotification();", null);
                        } else if ("loans".equals(target)) {
                            webView.evaluateJavascript("window.__hesabnoPendingNotificationTarget='loans';if(typeof window.__hesabnoOpenLoansFromNotification==='function')window.__hesabnoOpenLoansFromNotification();", null);
                        } else if (target != null && target.startsWith("sms:")) {
                            String smsId = target.substring(4);
                            webView.evaluateJavascript("window.__hesabnoPendingNotificationTarget=" + org.json.JSONObject.quote(target)
                                    + ";if(typeof window.__hesabnoOpenSmsFromNotification==='function')window.__hesabnoOpenSmsFromNotification("
                                    + org.json.JSONObject.quote(smsId) + ");", null);
                        } else {
                            webView.evaluateJavascript("window.__hesabnoPendingNotificationTarget='home';if(typeof window.__hesabnoOpenDashboardFromNotification==='function')window.__hesabnoOpenDashboardFromNotification();", null);
                        }
                    }
                } catch (Exception ignored) {}
            }
        }, 180L);
    }

    private void launchCameraIntent() {
        try {
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            cameraCaptureLauncher.launch(intent);
        } catch (Exception e) {
            toast("دوربین در دسترس نیست");
        }
    }

    private void deliverCameraPhotoToWeb(final String dataUrl, final String fileName) {
        if (webView == null || dataUrl == null || dataUrl.isEmpty()) return;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    String script = "if(typeof window.__hesabnoReceiveCameraPhoto==='function')window.__hesabnoReceiveCameraPhoto("
                            + org.json.JSONObject.quote(dataUrl) + "," + org.json.JSONObject.quote(fileName) + ");";
                    webView.evaluateJavascript(script, null);
                } catch (Exception ignored) {}
            }
        });
    }

    private boolean isLikelyBankSms(String body) {
        if (body == null || body.length() < 10) return false;
        boolean hasBankOrTxWord = body.contains("بانک") || body.contains("مبلغ") || body.contains("واریز")
                || body.contains("برداشت") || body.contains("مانده") || body.contains("حساب")
                || body.contains("کارت") || body.contains("بستانکار") || body.contains("بدهکار")
                || body.contains("بلو") || body.contains("خرید");
        if (!hasBankOrTxWord) return false;
        for (int i = 0; i < body.length(); i++) {
            char c = body.charAt(i);
            if ((c >= '0' && c <= '9') || (c >= '۰' && c <= '۹') || (c >= '٠' && c <= '٩')) {
                return true;
            }
        }
        return false;
    }

    private String queryBankSmsFromDevice(int limit) {
        android.database.Cursor cursor = null;
        org.json.JSONArray arr = new org.json.JSONArray();
        try {
            cursor = getContentResolver().query(
                    Uri.parse("content://sms/inbox"),
                    new String[]{"_id", "address", "body", "date"},
                    null,
                    null,
                    "date DESC"
            );
            if (cursor != null) {
                int count = 0;
                while (cursor.moveToNext() && count < limit) {
                    String id = cursor.getString(0);
                    String address = cursor.getString(1);
                    String body = cursor.getString(2);
                    long date = cursor.getLong(3);
                    if (isLikelyBankSms(body)) {
                        org.json.JSONObject obj = new org.json.JSONObject();
                        obj.put("id", "native-sms-" + (id != null ? id : date));
                        obj.put("address", address != null ? address : "");
                        obj.put("body", body != null ? body : "");
                        obj.put("date", date);
                        arr.put(obj);
                        count++;
                    }
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (cursor != null) {
                try { cursor.close(); } catch (Exception ignored) {}
            }
        }
        return arr.toString();
    }

    private void deliverSmsBatchToWeb(final String jsonArray) {
        if (webView == null || jsonArray == null) return;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    String script = "if(typeof window.__hesabnoOnNativeSmsFetched==='function')window.__hesabnoOnNativeSmsFetched("
                            + org.json.JSONObject.quote(jsonArray) + ");";
                    webView.evaluateJavascript(script, null);
                } catch (Exception ignored) {}
            }
        });
    }

    private void deliverIncomingSmsToWeb(final String sender, final String body, final long timestamp) {
        if (webView == null || body == null || body.isEmpty()) return;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    String script = "if(typeof window.__hesabnoOnNativeSmsReceived==='function')window.__hesabnoOnNativeSmsReceived("
                            + org.json.JSONObject.quote(sender != null ? sender : "") + ","
                            + org.json.JSONObject.quote(body) + "," + timestamp + ");";
                    webView.evaluateJavascript(script, null);
                } catch (Exception ignored) {}
            }
        });
    }

    private void persistCloudDriveUri(Uri uri) {
        if (uri == null) return;
        try {
            int flags = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
            getContentResolver().takePersistableUriPermission(uri, flags);
        } catch (Exception ignored) {
            try {
                getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (Exception ignored2) {}
        }
        String name = resolveUriDisplayName(uri);
        getSharedPreferences(CLOUD_PREFS, MODE_PRIVATE).edit()
                .putString(KEY_CLOUD_URI, uri.toString())
                .putString(KEY_CLOUD_NAME, name)
                .apply();
    }

    private Uri getSavedCloudDriveUri() {
        String uriStr = getSharedPreferences(CLOUD_PREFS, MODE_PRIVATE).getString(KEY_CLOUD_URI, "");
        if (uriStr == null || uriStr.isEmpty()) return null;
        try {
            return Uri.parse(uriStr);
        } catch (Exception e) {
            return null;
        }
    }

    private String resolveUriDisplayName(Uri uri) {
        if (uri == null) return "MyMoney-GoogleDrive-Backup.json";
        android.database.Cursor cursor = null;
        try {
            cursor = getContentResolver().query(uri, new String[]{android.provider.OpenableColumns.DISPLAY_NAME}, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                String name = cursor.getString(0);
                if (name != null && !name.trim().isEmpty()) return name.trim();
            }
        } catch (Exception ignored) {
        } finally {
            if (cursor != null) {
                try { cursor.close(); } catch (Exception ignored) {}
            }
        }
        return "MyMoney-GoogleDrive-Backup.json";
    }

    private boolean writeCloudDriveUri(Uri uri, String jsonPayload) {
        if (uri == null || jsonPayload == null || jsonPayload.trim().isEmpty()) return false;
        OutputStream out = null;
        try {
            byte[] bytes = jsonPayload.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            out = getContentResolver().openOutputStream(uri, "wt");
            if (out == null) out = getContentResolver().openOutputStream(uri);
            if (out == null) return false;
            out.write(bytes);
            out.flush();
            String stamp = new java.text.SimpleDateFormat("yyyy/MM/dd HH:mm", java.util.Locale.US).format(new java.util.Date());
            getSharedPreferences(CLOUD_PREFS, MODE_PRIVATE).edit()
                    .putString(KEY_CLOUD_LAST_SYNC, stamp)
                    .apply();
            return true;
        } catch (Exception e) {
            return false;
        } finally {
            if (out != null) {
                try { out.close(); } catch (Exception ignored) {}
            }
        }
    }

    private String readCloudDriveUri(Uri uri) {
        if (uri == null) return "";
        java.io.InputStream in = null;
        try {
            in = getContentResolver().openInputStream(uri);
            if (in == null) return "";
            java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) > 0) {
                buffer.write(chunk, 0, n);
            }
            String text = new String(buffer.toByteArray(), java.nio.charset.StandardCharsets.UTF_8).trim();
            return (text.startsWith("{") && text.endsWith("}")) ? text : "";
        } catch (Exception e) {
            return "";
        } finally {
            if (in != null) {
                try { in.close(); } catch (Exception ignored) {}
            }
        }
    }

    private void notifyWebCloudDriveChanged() {
        if (webView == null) return;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    webView.evaluateJavascript("if(typeof window.__hesabnoOnCloudDriveUpdated==='function')window.__hesabnoOnCloudDriveUpdated();", null);
                } catch (Exception ignored) {}
            }
        });
    }

    private void deliverCloudRestoreToWeb(final String json, final String fileName) {
        if (webView == null) return;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    String script = "if(typeof window.__hesabnoReceiveCloudBackupJson==='function')window.__hesabnoReceiveCloudBackupJson("
                            + org.json.JSONObject.quote(json) + "," + org.json.JSONObject.quote(fileName) + ");";
                    webView.evaluateJavascript(script, null);
                } catch (Exception ignored) {}
            }
        });
    }

    private boolean writeAutoBackupFile(String jsonPayload) {
        if (jsonPayload == null || jsonPayload.trim().isEmpty()) return false;
        synchronized (autoBackupLock) {
            File dir = getFilesDir();
            if (dir == null || (!dir.exists() && !dir.mkdirs())) return false;
            File primary = new File(dir, AUTO_BACKUP_FILE);
            File backup = new File(dir, AUTO_BACKUP_BAK_FILE);
            File temp = new File(dir, AUTO_BACKUP_FILE + ".tmp");
            FileOutputStream out = null;
            try {
                byte[] bytes = jsonPayload.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                if (bytes.length < 2) return false;
                out = new FileOutputStream(temp);
                out.write(bytes);
                out.flush();
                try { out.getFD().sync(); } catch (Exception ignored) {}
                out.close();
                out = null;
                if (primary.exists() && primary.length() > 0) {
                    copyFileSilently(primary, backup);
                }
                if (!temp.renameTo(primary)) {
                    copyFileSilently(temp, primary);
                    //noinspection ResultOfMethodCallIgnored
                    temp.delete();
                }
                return primary.exists() && primary.length() > 0;
            } catch (Exception e) {
                return false;
            } finally {
                if (out != null) {
                    try { out.close(); } catch (Exception ignored) {}
                }
            }
        }
    }

    private String readAutoBackupFile() {
        synchronized (autoBackupLock) {
            File dir = getFilesDir();
            if (dir == null) return "";
            String content = readUtf8FileIfValid(new File(dir, AUTO_BACKUP_FILE));
            if (!content.isEmpty()) return content;
            return readUtf8FileIfValid(new File(dir, AUTO_BACKUP_BAK_FILE));
        }
    }

    private String sanitizeAttachmentId(String id) {
        if (id == null) return "";
        String clean = id.trim();
        if (clean.startsWith("attref:")) clean = clean.substring(7);
        clean = clean.replaceAll("[^A-Za-z0-9_\\-]", "");
        return clean.length() > 80 ? clean.substring(0, 80) : clean;
    }

    private File getAttachmentsDir() {
        File base = getFilesDir();
        if (base == null) return null;
        File dir = new File(base, ATTACHMENTS_DIR);
        if (!dir.exists() && !dir.mkdirs()) return null;
        return dir;
    }

    private boolean writeAttachmentFile(String id, String dataUrl) {
        String safeId = sanitizeAttachmentId(id);
        if (safeId.isEmpty() || dataUrl == null || dataUrl.isEmpty()) return false;
        synchronized (attachmentLock) {
            File dir = getAttachmentsDir();
            if (dir == null) return false;
            File target = new File(dir, safeId + ".dat");
            File temp = new File(dir, safeId + ".dat.tmp");
            FileOutputStream out = null;
            try {
                byte[] bytes = dataUrl.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                out = new FileOutputStream(temp);
                out.write(bytes);
                out.flush();
                try { out.getFD().sync(); } catch (Exception ignored) {}
                out.close();
                out = null;
                if (!temp.renameTo(target)) {
                    copyFileSilently(temp, target);
                    //noinspection ResultOfMethodCallIgnored
                    temp.delete();
                }
                return target.exists() && target.length() > 0;
            } catch (Exception e) {
                return false;
            } finally {
                if (out != null) {
                    try { out.close(); } catch (Exception ignored) {}
                }
            }
        }
    }

    private String readAttachmentFile(String id) {
        String safeId = sanitizeAttachmentId(id);
        if (safeId.isEmpty()) return "";
        synchronized (attachmentLock) {
            File dir = getAttachmentsDir();
            if (dir == null) return "";
            File target = new File(dir, safeId + ".dat");
            if (!target.exists() || target.length() == 0) return "";
            java.io.FileInputStream in = null;
            try {
                byte[] buf = new byte[(int) target.length()];
                in = new java.io.FileInputStream(target);
                int offset = 0;
                while (offset < buf.length) {
                    int read = in.read(buf, offset, buf.length - offset);
                    if (read < 0) break;
                    offset += read;
                }
                return new String(buf, 0, offset, java.nio.charset.StandardCharsets.UTF_8);
            } catch (Exception e) {
                return "";
            } finally {
                if (in != null) {
                    try { in.close(); } catch (Exception ignored) {}
                }
            }
        }
    }

    private boolean deleteAttachmentFile(String id) {
        String safeId = sanitizeAttachmentId(id);
        if (safeId.isEmpty()) return false;
        synchronized (attachmentLock) {
            File dir = getAttachmentsDir();
            if (dir == null) return false;
            File target = new File(dir, safeId + ".dat");
            return !target.exists() || target.delete();
        }
    }

    private String exportAttachmentsJsonString() {
        org.json.JSONObject obj = new org.json.JSONObject();
        synchronized (attachmentLock) {
            File dir = getAttachmentsDir();
            if (dir != null) {
                File[] files = dir.listFiles();
                if (files != null) {
                    for (File f : files) {
                        if (f == null || !f.isFile() || !f.getName().endsWith(".dat")) continue;
                        String name = f.getName();
                        String id = name.substring(0, name.length() - 4);
                        String val = readAttachmentFile(id);
                        if (!val.isEmpty()) {
                            try { obj.put(id, val); } catch (Exception ignored) {}
                        }
                    }
                }
            }
        }
        synchronized (sqlStoreLock) {
            android.database.Cursor c = null;
            try {
                android.database.sqlite.SQLiteDatabase db = getSqlStoreDb();
                if (db != null) {
                    c = db.rawQuery("SELECT id, data_url FROM attachments_store", null);
                    if (c != null) {
                        while (c.moveToNext()) {
                            String id = c.getString(0);
                            String val = c.getString(1);
                            if (id != null && !id.isEmpty() && val != null && !val.isEmpty()) {
                                obj.put(id, val);
                            }
                        }
                    }
                }
            } catch (Exception ignored) {
            } finally {
                if (c != null) { try { c.close(); } catch (Exception ignored) {} }
            }
        }
        return obj.toString();
    }

    private boolean importAttachmentsFromJsonString(String jsonMap) {
        if (jsonMap == null || jsonMap.trim().isEmpty()) return false;
        try {
            org.json.JSONObject obj = new org.json.JSONObject(jsonMap);
            java.util.Iterator<String> keys = obj.keys();
            boolean any = false;
            while (keys.hasNext()) {
                String k = keys.next();
                String v = obj.optString(k, "");
                if (!v.isEmpty()) {
                    boolean sOk = sqlWriteAttachment(k, v);
                    boolean fOk = writeAttachmentFile(k, v);
                    if (sOk || fOk) any = true;
                }
            }
            return any;
        } catch (Exception e) {
            return false;
        }
    }

    private static final class NativeSqlStoreHelper extends android.database.sqlite.SQLiteOpenHelper {
        NativeSqlStoreHelper(android.content.Context context) {
            super(context, NATIVE_SQL_DB, null, NATIVE_SQL_DB_VERSION);
        }

        @Override
        public void onConfigure(android.database.sqlite.SQLiteDatabase db) {
            super.onConfigure(db);
            try {
                db.enableWriteAheadLogging();
            } catch (Exception ignored) {}
        }

        @Override
        public void onCreate(android.database.sqlite.SQLiteDatabase db) {
            db.execSQL("CREATE TABLE IF NOT EXISTS kv_store ("
                    + "k TEXT PRIMARY KEY NOT NULL, "
                    + "v TEXT NOT NULL, "
                    + "updated_at INTEGER NOT NULL)");
            db.execSQL("CREATE TABLE IF NOT EXISTS attachments_store ("
                    + "id TEXT PRIMARY KEY NOT NULL, "
                    + "data_url TEXT NOT NULL, "
                    + "updated_at INTEGER NOT NULL)");
        }

        @Override
        public void onUpgrade(android.database.sqlite.SQLiteDatabase db, int oldVersion, int newVersion) {
            onCreate(db);
        }
    }

    private android.database.sqlite.SQLiteDatabase getSqlStoreDb() {
        try {
            if (sqlStoreHelper == null) {
                synchronized (sqlStoreLock) {
                    if (sqlStoreHelper == null) {
                        sqlStoreHelper = new NativeSqlStoreHelper(getApplicationContext());
                    }
                }
            }
            return sqlStoreHelper.getWritableDatabase();
        } catch (Exception e) {
            return null;
        }
    }

    private String sqlReadKv(String key) {
        if (key == null || key.isEmpty()) return null;
        synchronized (sqlStoreLock) {
            android.database.Cursor c = null;
            try {
                android.database.sqlite.SQLiteDatabase db = getSqlStoreDb();
                if (db == null) return null;
                c = db.rawQuery("SELECT v FROM kv_store WHERE k = ? LIMIT 1", new String[]{key});
                if (c != null && c.moveToFirst()) {
                    return c.getString(0);
                }
                return null;
            } catch (Exception e) {
                return null;
            } finally {
                if (c != null) { try { c.close(); } catch (Exception ignored) {} }
            }
        }
    }

    private boolean sqlWriteKv(String key, String value) {
        if (key == null || key.isEmpty() || value == null) return false;
        synchronized (sqlStoreLock) {
            try {
                android.database.sqlite.SQLiteDatabase db = getSqlStoreDb();
                if (db == null) return false;
                ContentValues cv = new ContentValues();
                cv.put("k", key);
                cv.put("v", value);
                cv.put("updated_at", System.currentTimeMillis());
                long rowId = db.insertWithOnConflict("kv_store", null, cv, android.database.sqlite.SQLiteDatabase.CONFLICT_REPLACE);
                return rowId != -1L;
            } catch (Exception e) {
                return false;
            }
        }
    }

    private boolean sqlDeleteKv(String key) {
        if (key == null || key.isEmpty()) return false;
        synchronized (sqlStoreLock) {
            try {
                android.database.sqlite.SQLiteDatabase db = getSqlStoreDb();
                if (db == null) return false;
                db.delete("kv_store", "k = ?", new String[]{key});
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }

    private boolean sqlClearAllKv() {
        synchronized (sqlStoreLock) {
            try {
                android.database.sqlite.SQLiteDatabase db = getSqlStoreDb();
                if (db == null) return false;
                db.delete("kv_store", null, null);
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }

    private String sqlExportAllKvJson() {
        synchronized (sqlStoreLock) {
            android.database.Cursor c = null;
            try {
                android.database.sqlite.SQLiteDatabase db = getSqlStoreDb();
                if (db == null) return "{}";
                c = db.rawQuery("SELECT k, v FROM kv_store", null);
                org.json.JSONObject obj = new org.json.JSONObject();
                if (c != null) {
                    while (c.moveToNext()) {
                        String k = c.getString(0);
                        String v = c.getString(1);
                        if (k != null && v != null) {
                            obj.put(k, v);
                        }
                    }
                }
                return obj.toString();
            } catch (Exception e) {
                return "{}";
            } finally {
                if (c != null) { try { c.close(); } catch (Exception ignored) {} }
            }
        }
    }

    private boolean sqlImportAllKvJson(String jsonEntries) {
        if (jsonEntries == null || jsonEntries.trim().isEmpty()) return false;
        synchronized (sqlStoreLock) {
            android.database.sqlite.SQLiteDatabase db = getSqlStoreDb();
            if (db == null) return false;
            try {
                org.json.JSONObject obj = new org.json.JSONObject(jsonEntries);
                java.util.Iterator<String> keys = obj.keys();
                long now = System.currentTimeMillis();
                db.beginTransaction();
                try {
                    while (keys.hasNext()) {
                        String k = keys.next();
                        if (k == null || k.isEmpty()) continue;
                        if (obj.isNull(k)) {
                            db.delete("kv_store", "k = ?", new String[]{k});
                        } else {
                            String v = obj.optString(k, "");
                            ContentValues cv = new ContentValues();
                            cv.put("k", k);
                            cv.put("v", v);
                            cv.put("updated_at", now);
                            db.insertWithOnConflict("kv_store", null, cv, android.database.sqlite.SQLiteDatabase.CONFLICT_REPLACE);
                        }
                    }
                    db.setTransactionSuccessful();
                    return true;
                } finally {
                    db.endTransaction();
                }
            } catch (Exception e) {
                return false;
            }
        }
    }

    private boolean sqlWriteAttachment(String id, String dataUrl) {
        String safeId = sanitizeAttachmentId(id);
        if (safeId.isEmpty() || dataUrl == null || dataUrl.isEmpty()) return false;
        synchronized (sqlStoreLock) {
            try {
                android.database.sqlite.SQLiteDatabase db = getSqlStoreDb();
                if (db == null) return false;
                ContentValues cv = new ContentValues();
                cv.put("id", safeId);
                cv.put("data_url", dataUrl);
                cv.put("updated_at", System.currentTimeMillis());
                long rowId = db.insertWithOnConflict("attachments_store", null, cv, android.database.sqlite.SQLiteDatabase.CONFLICT_REPLACE);
                return rowId != -1L;
            } catch (Exception e) {
                return false;
            }
        }
    }

    private String sqlReadAttachment(String id) {
        String safeId = sanitizeAttachmentId(id);
        if (safeId.isEmpty()) return "";
        synchronized (sqlStoreLock) {
            android.database.Cursor c = null;
            try {
                android.database.sqlite.SQLiteDatabase db = getSqlStoreDb();
                if (db == null) return "";
                c = db.rawQuery("SELECT data_url FROM attachments_store WHERE id = ? LIMIT 1", new String[]{safeId});
                if (c != null && c.moveToFirst()) {
                    String val = c.getString(0);
                    return val != null ? val : "";
                }
                return "";
            } catch (Exception e) {
                return "";
            } finally {
                if (c != null) { try { c.close(); } catch (Exception ignored) {} }
            }
        }
    }

    private boolean sqlDeleteAttachment(String id) {
        String safeId = sanitizeAttachmentId(id);
        if (safeId.isEmpty()) return false;
        synchronized (sqlStoreLock) {
            try {
                android.database.sqlite.SQLiteDatabase db = getSqlStoreDb();
                if (db == null) return false;
                db.delete("attachments_store", "id = ?", new String[]{safeId});
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }

    private String readUtf8FileIfValid(File file) {
        if (file == null || !file.exists() || file.length() <= 2) return "";
        java.io.FileInputStream in = null;
        try {
            byte[] buf = new byte[(int) file.length()];
            in = new java.io.FileInputStream(file);
            int offset = 0;
            while (offset < buf.length) {
                int read = in.read(buf, offset, buf.length - offset);
                if (read < 0) break;
                offset += read;
            }
            String text = new String(buf, 0, offset, java.nio.charset.StandardCharsets.UTF_8).trim();
            return (text.startsWith("{") && text.endsWith("}")) ? text : "";
        } catch (Exception e) {
            return "";
        } finally {
            if (in != null) {
                try { in.close(); } catch (Exception ignored) {}
            }
        }
    }

    private void copyFileSilently(File src, File dst) {
        java.io.FileInputStream in = null;
        FileOutputStream out = null;
        try {
            in = new java.io.FileInputStream(src);
            out = new FileOutputStream(dst);
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
            }
            out.flush();
            try { out.getFD().sync(); } catch (Exception ignored) {}
        } catch (Exception ignored) {
        } finally {
            if (in != null) { try { in.close(); } catch (Exception ignored) {} }
            if (out != null) { try { out.close(); } catch (Exception ignored) {} }
        }
    }

    private boolean saveToDownloads(String name, byte[] data) {
        String safeName = (name == null || name.trim().isEmpty() ? "hesabno-backup.json" : name.trim())
                .replaceAll("[^\\w\\-. ]", "_");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                values.put(MediaStore.Downloads.MIME_TYPE, safeName.endsWith(".json") ? "application/json" : "application/octet-stream");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) return false;
                OutputStream out = getContentResolver().openOutputStream(uri);
                if (out == null) return false;
                try {
                    out.write(data);
                } finally {
                    out.close();
                }
                toast("پشتیبان در «دانلودها» ذخیره شد:\n" + safeName);
                return true;
            } catch (Exception e) {
                return false;
            }
        }
        // اندروید ۲۸ و پایین‌تر: مجوز نوشتن لازم است
        if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            pendingBackupName = safeName;
            pendingBackupData = data;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, 1001);
                }
            });
            return false;
        }
        return writeFileToDownloads(safeName, data);
    }

    private boolean writeFileToDownloads(String safeName, byte[] data) {
        FileOutputStream out = null;
        try {
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!dir.exists() && !dir.mkdirs()) return false;
            File file = new File(dir, safeName);
            out = new FileOutputStream(file);
            out.write(data);
            toast("پشتیبان در «دانلودها» ذخیره شد:\n" + safeName);
            return true;
        } catch (Exception e) {
            return false;
        } finally {
            if (out != null) {
                try { out.close(); } catch (Exception ignored) {}
            }
        }
    }

    /** کمکی: صف کردن دانلود از طریق DownloadManager (برای لینک‌های غیر blob). */
    private static final class DownloadManagerCompat {
        static void enqueue(android.content.Context context, Uri uri) {
            android.app.DownloadManager dm = (android.app.DownloadManager) context.getSystemService(android.content.Context.DOWNLOAD_SERVICE);
            if (dm == null) return;
            android.app.DownloadManager.Request request = new android.app.DownloadManager.Request(uri);
            request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.allowScanningByMediaScanner();
            dm.enqueue(request);
        }
    }
}
