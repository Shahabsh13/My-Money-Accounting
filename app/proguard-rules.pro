# Keep rules
# پوسته‌ی WebView و پل بومی باید از R8 محافظت شوند
-keep public class com.maymoney.app.MainActivity { *; }
-keep public class com.maymoney.app.MainActivity$NativeBridge { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
