# ===================================================
# TruVid ProGuard / R8 混淆规则
# ===================================================

# ── 保留 Kotlin 协程 ──
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }

# ── 保留 WebView JS 接口 ──
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── 保留安全检测类（不要混淆安全逻辑类名） ──
-keep class com.truvid.app.SecurityGuard { *; }

# ── 保留 RenderEngine 公开接口 ──
-keep class com.truvid.app.RenderEngine { *; }

# ── 保留 WebView 相关 ──
-keep class android.webkit.** { *; }

# ── 移除日志（release 版自动移除） ──
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
}

# ── 通用 Android 保留规则 ──
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider

# ── 泛型和反射保留 ──
-keepattributes Signature
-keepattributes EnclosingMethod

# ── 混淆字典（增加逆向难度） ──
-obfuscationdictionary proguard-dict.txt
-classobfuscationdictionary proguard-dict.txt
-packageobfuscationdictionary proguard-dict.txt

# ── 字符串加密（增加静态分析难度） ──
-adaptclassstrings
-adaptresourcefilenames
-adaptresourcefilecontents
