# ساخت APK نرم‌افزار «My Money»

## ساختار
- `app/src/main/assets/` : برنامه‌ی وب (index.html، src، assets). هر تغییر در نسخه‌ی وب باید اینجا هم کپی شود.
- `app/src/main/java/com/maymoney/app/MainActivity.java` : پوسته‌ی WebView.
- `app/src/main/res/mipmap-*` : آیکون برنامه (از فایل `app-icon`).
- نام پکیج: `com.maymoney.app`  |  نام نمایشی: «My Money»

## روش ۱: با Android Studio (ساده‌ترین)
1. Android Studio را نصب کنید (نسخه‌ی Ladybug یا جدیدتر).
2. `File → Open` را بزنید و پوشه‌ی `android-app` انتخاب کنید.
   اگر `gradlew` نبود، Android Studio خودکار wrapper را می‌سازد (نسخه‌ی Gradle در `gradle/wrapper/gradle-wrapper.properties` قفل شده).
3. اجازه بدهید Gradle همگام‌سازی شود. **برای بیلد، Android SDK 35 باید نصب باشد** (در `app/build.gradle`، `compileSdk`/`targetSdk`؛ اگر ندارید، هر دو را به `34` تغییر دهید).
4. `Build → Build Bundle(s) / APK(s) → Build APK(s)` را بزنید.
5. فایل APK در مسیر `app/build/outputs/apk/debug/app-debug.apk` ساخته می‌شود.
6. فایل را روی گوشی منتقل و نصب کنید (اجازه‌ی «نصب از منابع ناشناس» لازم است).

## نسخه‌بندی
شماره‌ی نسخه در `version.properties` (ریشه‌ی `android-app`) است؛ برای هر آپدیت `versionCode` را ۱ واحد زیاد کنید.

## روش ۲: با خط فرمان
```
cd android-app
gradle wrapper        # فقط یک بار، اگر Gradle نصب است
./gradlew assembleDebug
```

## نسخه‌ی نهایی (Release) برای انتشار و به‌روزرسانی
برای به‌روزرسانی‌های بعدی روی گوشی، **کلید امضا (keystore) باید همیشه یکسان باشد.** اگر آن را گم کنید، نمی‌توانید روی نسخه‌ی نصب‌شده به‌روزرسانی بدهید.
1. یک کلید بسازید:
   `keytool -genkeypair -v -keystore maymoney-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias maymoney`
2. فایل `maymoney-release.jks` را در جای امن و جدا از پروژه نگه دارید و از آن پشتیبان بگیرید.
3. در Android Studio: `Build → Generate Signed App Bundle / APK` و کلید را انتخاب کنید.

## نکات مهم
- پوسته‌ی اندروید یک پل بومی به نام `HnBridge` دارد (در `MainActivity`):
  - `HnBridge.saveBackup(name, base64)` → فایل پشتیبان را در پوشه‌ی «دانلودها» می‌نویسد و مقدار موفقیت را برمی‌گرداند.
  - `HnBridge.backHandled()` / `HnBridge.exitApp()` → تصمیم‌گیری دکمه‌ی برگشت سخت‌افزاری.
  - انتخاب فایل (`<input type="file">`) و دانلود لینک‌ها نیز در پوسته پشتیبانی می‌شود.
- داده‌ها داخل WebView ذخیره می‌شوند. اگر نام پکیج یا کلید امضا عوض شود، برنامه داده‌های قبلی را نمی‌بیند. قبل از هر به‌روزرسانی از داخل برنامه پشتیبان بگیرید.
- این پوسته فقط برای اجرای برنامه‌ی وب است؛ دسترسی اینترنت لازم نیست.
- تست نهایی را روی گوشی واقعی انجام دهید (به‌ویژه اندروید ۲۸ و پایین‌تر برای مجوز ذخیره‌ی پشتیبان).

## ساخت نسخه‌ی Release (با امضای شما)
1. کلید را بسازید (فقط یک بار):
   `keytool -genkeypair -v -keystore maymoney-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias maymoney`
   فایل `maymoney-release.jks` را در جای امن و جدا از پروژه نگه دارید (مثلاً `~/keys/`). **هرگز آن را در پروژه یا Git نگذارید.**
2. فایل `keystore.properties.example` را کپی کنید، نامش را به `keystore.properties` بگذارید و مقادیر را پر کنید.
   مسیر `storeFile` نسبت به پوشه‌ی `android-app` تفسیر می‌شود؛ برای نگه‌داری کلید بیرون از پروژه، مسیر کامل بدهید، مثلاً `storeFile=/home/you/keys/maymoney-release.jks`.
3. ساخت APK نهایی:
   `./gradlew assembleRelease`
   خروجی: `app/build/outputs/apk/release/app-release.apk`

اگر `keystore.properties` نباشد، نسخه‌ی release بدون امضا ساخته می‌شود و روی گوشی نصب نمی‌شود.
نسخه‌ی `versionCode` را برای هر به‌روزرسانی یک واحد زیاد کنید (فایل `app/build.gradle`).
