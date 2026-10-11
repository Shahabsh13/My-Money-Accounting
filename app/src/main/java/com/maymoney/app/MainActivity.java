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

    // اگر برنامه‌ی وب بتواند برگشت درون‌برنامه‌ای انجام دهد، خودش اعلام می‌کند (backHandled)؛
    // وگرنه از HnBridge.exitApp خروج از برنامه را می‌خواهد.
    private static final String BACK_JS =
            "(function(){function done(){try{if(window.HnBridge)window.HnBridge.backHandled();}catch(e){}}"
            + "try{var fr=document.getElementById('hesabno-first-run');"
            + "if(fr){fr.parentNode.removeChild(fr);done();return;}}catch(e){}"
            + "try{var h=window.__hesabnoNavigateBack;"
            + "if(typeof h==='function'&&h()){done();return;}"
            + "var b=document.querySelector('main button[aria-label=\"\\u0628\\u0627\\u0632\\u06af\\u0634\\u062a\"],main button[title=\"\\u0628\\u0627\\u0632\\u06af\\u0634\\u062a\"]');"
            + "if(b){b.click();done();return;}}catch(e){}"
            + "try{if(window.HnBridge)window.HnBridge.exitApp();}catch(e){}})();";

    private WebView webView;
    private final Handler handler = new Handler(Looper.getMainLooper());

    // انتخاب فایل برای <input type="file">
    private ValueCallback<Uri[]> filePathCallback;
    private final ActivityResultLauncher<Intent> filePicker =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (filePathCallback == null) return;
                Uri[] results = WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData());
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            });

    // دکمه‌ی برگشت
    private volatile boolean backHandled;

    // پشتیبان معلق (اگر مجوز نوشتن برای اندروید ۲۸ و پایین‌تر هنوز داده نشده باشد)
    private volatile String pendingBackupName;
    private volatile byte[] pendingBackupData;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);           // ذخیره‌ی داده‌ها در localStorage
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
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

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 1001 && pendingBackupName != null && pendingBackupData != null) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            boolean ok = granted && writeFileToDownloads(pendingBackupName, pendingBackupData);
            pendingBackupName = null;
            pendingBackupData = null;
            toast(ok ? "پشتیبان در «دانلودها» ذخیره شد" : "ذخیره‌ی پشتیبان ناموفق بود");
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
