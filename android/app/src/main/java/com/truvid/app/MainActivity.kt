package com.truvid.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var mdInput: EditText
    private lateinit var themeSpinner: Spinner
    private lateinit var renderBtn: Button
    private lateinit var statusTv: TextView
    private var renderEngine: RenderEngine? = null
    private var lastVideoFile: File? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        mdInput = findViewById(R.id.mdInput)
        themeSpinner = findViewById(R.id.themeSpinner)
        renderBtn = findViewById(R.id.renderBtn)
        statusTv = findViewById(R.id.statusTv)

        // 主题选择器
        val themes = arrayOf("tech (科技)", "dark (暗黑)", "minimal (极简)")
        ArrayAdapter(this, android.R.layout.simple_spinner_item, themes).also {
            it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            themeSpinner.adapter = it
        }

        // 预填示例内容
        mdInput.setText(getString(R.string.demo_md))

        renderBtn.setOnClickListener {
            val md = mdInput.text.toString().trim()
            if (md.isEmpty()) {
                setStatus("⚠️ 请输入 Markdown 内容")
                return@setOnClickListener
            }

            val theme = when (themeSpinner.selectedItemPosition) {
                1 -> "dark"
                2 -> "minimal"
                else -> "tech"
            }

            startRender(md, theme)
        }
    }

    private fun startRender(md: String, theme: String) {
        renderBtn.isEnabled = false
        renderBtn.text = "⏳ 渲染中..."
        setStatus("📝 初始化渲染引擎...")

        renderEngine?.cancel()
        renderEngine = RenderEngine(this).apply {
            onProgress = { msg ->
                runOnUiThread { setStatus(msg) }
            }
            onComplete = { file ->
                runOnUiThread {
                    lastVideoFile = file
                    renderBtn.isEnabled = true
                    renderBtn.text = "🚀 开始渲染"
                    setStatus("✅ 渲染完成!\n📁 $file")
                    showVideo(file)
                }
            }
            onError = { msg ->
                runOnUiThread {
                    renderBtn.isEnabled = true
                    renderBtn.text = "🚀 开始渲染"
                    setStatus(msg)
                }
            }
        }

        renderEngine?.start(RenderEngine.Params(
            markdown = md,
            theme = theme
        ))
    }

    private fun setStatus(msg: String) {
        statusTv.text = msg
    }

    private fun showVideo(file: File) {
        try {
            val uri = Uri.fromFile(file)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "video/mp4")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(Intent.createChooser(intent, "打开视频"))
        } catch (e: Exception) {
            setStatus("✅ 视频已保存到 Movies/TruVid/\n${file.name}")
        }
    }

    override fun onDestroy() {
        renderEngine?.cancel()
        super.onDestroy()
    }
}
