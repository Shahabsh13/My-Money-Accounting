# ساخت APK نرم‌افزار «My Money»

## ریشه صحیح پروژه
این مخزن خودش ریشه پروژه Android/Gradle است؛ پوشه‌ای جدا با نام `android-app` وجود ندارد. پوشه‌ای را در Android Studio باز کنید که فایل‌های `settings.gradle`، `build.gradle` و `gradlew.bat` را مستقیماً داخل خود دارد.

- پوسته اندروید: `app/src/main/java/com/maymoney/app/MainActivity.java`
- فایل‌های برنامه وب: `app/src/main/assets/`
- نام بسته: `com.maymoney.app`
- نسخه Gradle Wrapper: در `gradle/wrapper/gradle-wrapper.properties`
- نسخه برنامه: `version.properties` و `app/build.gradle`

## روش ۱: ساخت با Android Studio در ویندوز
1. Android Studio پایدار را نصب کنید.
2. از **File → Open**، پوشه اصلی `My-Money-Accounting` را انتخاب کنید؛ زیرپوشه `app` را به‌تنهایی باز نکنید.
3. در **Tools → SDK Manager**، Android SDK Platform 35، Android SDK Build-Tools 35.0.0 و Android SDK Platform-Tools را نصب کنید.
4. مطمئن شوید JDK 17 در Android Studio انتخاب شده است و صبر کنید Gradle Sync تمام شود.
5. از **Build → Build Bundle(s) / APK(s) → Build APK(s)** استفاده کنید.
6. APK آزمایشی در مسیر `app/build/outputs/apk/debug/app-debug.apk` ساخته می‌شود.

## روش ۲: ساخت از PowerShell در ویندوز
PowerShell را در پوشه اصلی پروژه باز کنید و این دستورات را اجرا کنید:

```powershell
java -version
.\gradlew.bat --version
.\gradlew.bat --no-daemon assembleDebug
```

اگر دستور `java` پیدا نشد، JDK 17 را از Android Studio نصب/انتخاب کنید و `JAVA_HOME` را تنظیم کنید. برای ساخت، Android SDK Platform 35 باید نصب باشد. به‌جای تغییر `compileSdk` یا `targetSdk`، ابتدا SDK لازم را از SDK Manager نصب کنید.

## دریافت APK ساخته‌شده در GitHub
1. صفحه اجرای GitHub Actions را باز کنید: [Build debug APK](https://github.com/Shahabsh13/My-Money-Accounting/actions).
2. اجرای موفق با وضعیت **Success** را باز کنید.
3. در پایین صفحه، بخش **Artifacts**، فایل `my-money-debug-apk` را دانلود و ZIP را استخراج کنید؛ فایل داخل آن `app-debug.apk` است.
4. ZIP مربوط به هر اجرا مدت محدودی نگه‌داری می‌شود؛ در اجرای فعلی زمان انقضا در صفحه artifact نشان داده می‌شود.

## نصب و تست روی گوشی
- فایل `app-debug.apk` را به گوشی منتقل و باز کنید؛ اگر لازم شد اجازه نصب برنامه از همان منبع را فعال کنید.
- قبل از حذف یا نصب مجدد نسخه‌ای با امضای متفاوت، از داخل برنامه پشتیبان بگیرید. نصب نسخه‌ای با امضای متفاوت معمولاً به حذف نسخه قبلی نیاز دارد و حذف برنامه می‌تواند داده‌های محلی آن را پاک کند.
- پس از نصب، ابتدا ثبت و حذف یک تراکنش آزمایشی، مانده حساب، سند مرکب، و گزارش‌ها را با داده‌های نمونه بررسی کنید؛ از اطلاعات واقعی مالی برای تست اولیه استفاده نکنید.

## آزمون‌های خودکار
در صورت نصب Node.js نسخه 20 یا بالاتر، از ریشه پروژه اجرا کنید:

```powershell
node --test tests/*.test.cjs
```

این آزمون‌ها بخشی از محاسبات مانده/گزارش و قواعد قفل وام و سند مرکب را با داده‌های نمونه بررسی می‌کنند. آن‌ها جایگزین تست کامل رابط کاربری و آزمون روی گوشی واقعی نیستند.

## ساخت نسخه Release با امضای شخصی
برای انتشار و به‌روزرسانی‌های آینده، کلید امضای release باید همیشه یکسان بماند. کلید را فقط یک بار بسازید و بیرون از پروژه در جای امن نگه دارید:

```powershell
keytool -genkeypair -v -keystore maymoney-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias maymoney
```

1. `keystore.properties.example` را به `keystore.properties` کپی کنید و مقادیر را پر کنید.
2. مقدار `storeFile` نسبت به **ریشه مخزن** تفسیر می‌شود؛ مسیر کامل فایل کلید نیز قابل استفاده است.
3. `keystore.properties` و فایل `.jks` را در Git قرار ندهید و از کلید نسخه پشتیبان امن بگیرید.
4. برای ساخت از PowerShell اجرا کنید: ` .\gradlew.bat --no-daemon assembleRelease `
5. خروجی در `app/build/outputs/apk/release/app-release.apk` قرار می‌گیرد. بدون keystore، خروجی release امضای شخصی ندارد و برای نصب/انتشار مناسب نیست.

## نکات فنی
- پوسته اندروید از WebView استفاده می‌کند و فایل‌های برنامه وب در `app/src/main/assets/` قرار دارند؛ تغییرات وب باید در همین پوشه نیز اعمال شوند.
- پل بومی `HnBridge` از جمله برای ذخیره نسخه پشتیبان و مدیریت دکمه برگشت استفاده می‌شود.
- داده‌ها در فضای محلی WebView نگه‌داری می‌شوند. قبل از به‌روزرسانی یا حذف برنامه از اطلاعات پشتیبان بگیرید.
- ساخت موفق APK به‌تنهایی صحت همه محاسبات حسابداری را ثابت نمی‌کند؛ آزمون‌های خودکار و بررسی دستی گزارش‌ها نیز لازم است.
