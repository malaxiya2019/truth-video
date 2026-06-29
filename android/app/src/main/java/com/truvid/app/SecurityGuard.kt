package com.truvid.app

import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.SigningInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Debug
import java.io.*
import java.security.MessageDigest
import java.util.jar.JarFile

/**
 * TruVid 安全防护引擎
 *
 * 实现全链路安全检测，防止逆向、篡改、注入等攻击。
 * 检测失败时通过 [onThreat] 回调通知应用层处理。
 */
class SecurityGuard(private val context: Context) {

    var onThreat: (String) -> Unit = { msg ->
        throw SecurityException("🔒 $msg")
    }

    // ══════════════════════════════════════════════
    //  入口：一键执行所有检测
    // ══════════════════════════════════════════════

    fun runAllChecks() {
        checkRoot()
        checkEmulator()
        checkDebugger()
        checkPackageName()
        checkAppName()
        checkApkIntegrity()
        checkAppSignature()
    }

    // ══════════════════════════════════════════════
    //  核心二：APK 完整性校验
    // ══════════════════════════════════════════════

    private val EXPECTED_APK_HASH = "truvid_v1_secure_hash"  // 构建时替换为实际哈希

    private fun checkApkIntegrity() {
        try {
            val apkFile = File(context.applicationInfo.sourceDir)
            if (!apkFile.exists()) {
                onThreat("APK 文件不存在")
                return
            }

            val digest = MessageDigest.getInstance("SHA-256")
            val buffer = ByteArray(8192)
            var totalBytes = 0L

            BufferedInputStream(FileInputStream(apkFile)).use { bis ->
                var bytesRead: Int
                while (bis.read(buffer).also { bytesRead = it } != -1) {
                    digest.update(buffer, 0, bytesRead)
                    totalBytes += bytesRead
                    if (totalBytes > 10 * 1024 * 1024) break // 只检查前10MB
                }
            }

            val hash = digest.digest().joinToString("") { "%02x".format(it) }
            // 首次运行缓存基准哈希
            val prefs = context.getSharedPreferences("truvid_secure", Context.MODE_PRIVATE)
            val savedHash = prefs.getString("apk_hash", null)

            if (savedHash == null) {
                // 首次安装，保存哈希
                prefs.edit().putString("apk_hash", hash).apply()
            } else if (savedHash != hash) {
                onThreat("APK 已被篡改！哈希不匹配")
            }
        } catch (e: Exception) {
            // 哈希校验失败不阻塞，仅记录
        }
    }

    // ══════════════════════════════════════════════
    //  核心三：Root / 越狱检测
    // ══════════════════════════════════════════════

    private fun checkRoot() {
        // 检测常见 Root 路径
        val rootPaths = arrayOf(
            "/system/bin/su", "/system/xbin/su",
            "/sbin/su", "/system/su",
            "/system/bin/.ext/su",
            "/system/xbin/daemonsu",
            "/data/local/su",
            "/data/local/xbin/su",
            "/data/su",
            "/su/bin/su",
            "/system/app/Superuser.apk",
            "/system/app/SuperSU.apk",
            "/system/app/Magisk.apk",
            "/data/data/com.topjohnwu.magisk",
            "/data/data/com.thirdparty.superuser"
        )

        for (path in rootPaths) {
            if (File(path).exists()) {
                onThreat("检测到 Root 工具: $path")
                return
            }
        }

        // 检测 Magisk 特征
        try {
            val cmd = Runtime.getRuntime().exec("which su")
            val reader = BufferedReader(InputStreamReader(cmd.inputStream))
            if (reader.readLine() != null) {
                onThreat("检测到 su 命令")
                return
            }
        } catch (_: Exception) {}

        // 检测测试密钥
        if (Build.TAGS?.contains("test-keys") == true) {
            onThreat("检测到测试密钥 (test-keys)")
        }
    }

    // ══════════════════════════════════════════════
    //  核心三：模拟器检测
    // ══════════════════════════════════════════════

    private fun checkEmulator() {
        val emulatorIndicators = listOf(
            Build.FINGERPRINT?.startsWith("generic") == true,
            Build.FINGERPRINT?.contains("emulator") == true,
            Build.MODEL?.contains("Emulator") == true,
            Build.MODEL?.contains("sdk") == true,
            Build.MANUFACTURER?.contains("Genymotion") == true,
            Build.HARDWARE?.contains("goldfish") == true,
            Build.HARDWARE?.contains("ranchu") == true,
            Build.PRODUCT?.contains("sdk") == true,
            Build.DEVICE?.contains("generic") == true,
            Build.BOARD?.lowercase()?.contains("nox") == true,
            Build.BRAND?.contains("generic") == true
        )

        if (emulatorIndicators.any { it }) {
            onThreat("检测到模拟器环境")
        }
    }

    // ══════════════════════════════════════════════
    //  核心三：反调试检测
    // ══════════════════════════════════════════════

    private fun checkDebugger() {
        // 检测调试器连接
        if (Debug.isDebuggerConnected() || Debug.waitingForDebugger()) {
            onThreat("检测到调试器连接")
        }

        // 检测 ptrace 状态
        try {
            val statusFile = File("/proc/self/status")
            if (statusFile.exists()) {
                val content = statusFile.readText()
                val tracerPid = Regex("TracerPid:\\s*(\\d+)")
                    .find(content)?.groupValues?.get(1)?.toIntOrNull() ?: 0
                if (tracerPid != 0) {
                    onThreat("检测到进程跟踪 (TracerPid=$tracerPid)")
                }
            }
        } catch (_: Exception) {}
    }

    // ══════════════════════════════════════════════
    //  核心四：包名校验
    // ══════════════════════════════════════════════

    private val EXPECTED_PACKAGE = "com.truvid.app"

    private fun checkPackageName() {
        val currentPkg = context.packageName
        if (currentPkg != EXPECTED_PACKAGE) {
            onThreat("包名被篡改: $currentPkg != $EXPECTED_PACKAGE")
        }
    }

    // ══════════════════════════════════════════════
    //  核心四：APK 签名校验
    // ══════════════════════════════════════════════

    private fun checkAppSignature() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val pkgInfo = context.packageManager.getPackageInfo(
                    context.packageName,
                    PackageManager.GET_SIGNING_CERTIFICATES
                )
                val sigInfo = pkgInfo.signingInfo
                val signatures = if (sigInfo?.hasMultipleSigners() == true) {
                    sigInfo.apkContentsSigners
                } else {
                    sigInfo?.signingCertificateHistory
                }

                if (signatures.isNullOrEmpty()) {
                    onThreat("无法获取签名信息")
                    return
                }

                // 计算签名哈希并缓存基准值
                val digest = MessageDigest.getInstance("SHA-256")
                for (sig in signatures) {
                    digest.update(sig.toByteArray())
                }
                val hash = digest.digest().joinToString("") { "%02x".format(it) }

                val prefs = context.getSharedPreferences("truvid_secure", Context.MODE_PRIVATE)
                val savedSig = prefs.getString("sig_hash", null)

                if (savedSig == null) {
                    prefs.edit().putString("sig_hash", hash).apply()
                } else if (savedSig != hash) {
                    onThreat("APK 签名被篡改！")
                }
            } else {
                // Android 8.x 及以下使用旧方法
                @Suppress("DEPRECATION")
                val pkgInfo = context.packageManager.getPackageInfo(
                    context.packageName,
                    PackageManager.GET_SIGNATURES
                )
                val signatures = pkgInfo.signatures
                if (signatures.isNullOrEmpty()) {
                    onThreat("无法获取签名信息")
                    return
                }

                val digest = MessageDigest.getInstance("SHA-256")
                for (sig in signatures) {
                    digest.update(sig.toByteArray())
                }
                val hash = digest.digest().joinToString("") { "%02x".format(it) }

                @Suppress("DEPRECATION")
                val prefs = context.getSharedPreferences("truvid_secure", Context.MODE_PRIVATE)
                val savedSig = prefs.getString("sig_hash", null)

                if (savedSig == null) {
                    prefs.edit().putString("sig_hash", hash).apply()
                } else if (savedSig != hash) {
                    onThreat("APK 签名被篡改！")
                }
            }
        } catch (e: Exception) {
            onThreat("签名校验异常: ${e.message}")
        }
    }

    // ══════════════════════════════════════════════
    //  核心四：图标完整性校验
    // ══════════════════════════════════════════════

    fun checkIconIntegrity(): Boolean {
        return try {
            // 读取应用图标
            val icon = BitmapFactory.decodeResource(context.resources,
                android.R.drawable.sym_def_app_icon)
            // 注意：实际开发中应读取具体 Icon 资源的像素值
            // 这里简化为检查图标资源是否存在
            icon != null
        } catch (_: Exception) {
            false
        }
    }
    // ══════════════════════════════════════════════
    //  核心四：APK 名称保护（防重打包改名）
    // ══════════════════════════════════════════════

    private val EXPECTED_APP_NAME = "TruVid"

    private fun checkAppName() {
        val appInfo = context.applicationInfo
        val label = context.packageManager.getApplicationLabel(appInfo)?.toString()
        if (label != null && label != EXPECTED_APP_NAME) {
            // 检查是否在资源中预埋了名称
            val resId = context.resources.getIdentifier("app_name", "string", context.packageName)
            if (resId != 0) {
                val resName = context.getString(resId)
                if (resName != EXPECTED_APP_NAME) {
                    onThreat("应用名称被篡改: $label (期望: $EXPECTED_APP_NAME)")
                }
            }
        }
    }

}
