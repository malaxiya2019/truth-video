package com.truthvideo.app

import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.*
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {

    private lateinit var tokenInput: EditText
    private lateinit var repoInput: EditText
    private lateinit var markdownInput: EditText
    private lateinit var personaSpinner: Spinner
    private lateinit var templateSpinner: Spinner
    private lateinit var qualitySpinner: Spinner
    private lateinit var truthSpinner: Spinner
    private lateinit var renderButton: Button
    private lateinit var downloadButton: Button
    private lateinit var statusText: TextView

    private var lastRunId: String? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // 绑定视图
        tokenInput = findViewById(R.id.tokenInput)
        repoInput = findViewById(R.id.repoInput)
        markdownInput = findViewById(R.id.markdownInput)
        personaSpinner = findViewById(R.id.personaSpinner)
        templateSpinner = findViewById(R.id.templateSpinner)
        qualitySpinner = findViewById(R.id.qualitySpinner)
        truthSpinner = findViewById(R.id.truthSpinner)
        renderButton = findViewById(R.id.renderButton)
        downloadButton = findViewById(R.id.downloadButton)
        statusText = findViewById(R.id.statusText)

        // 配置下拉选项
        setupSpinner(personaSpinner, arrayOf("professor", "explainer", "science", "coach", "tech", "hacker", "storyteller"))
        setupSpinner(templateSpinner, arrayOf("tech", "minimal", "tutorial", "presentation", "modern", "dark", "matcha"))
        setupSpinner(qualitySpinner, arrayOf("draft", "normal", "high"))
        setupSpinner(truthSpinner, arrayOf("normal", "strict", "off"))

        // 恢复保存的 Token
        val prefs = getPreferences(MODE_PRIVATE)
        tokenInput.setText(prefs.getString("github_token", ""))
        repoInput.setText(prefs.getString("github_repo", "malaxiya2019/truth-video"))

        // 渲染按钮
        renderButton.setOnClickListener {
            val token = tokenInput.text.toString().trim()
            val repo = repoInput.text.toString().trim()

            if (token.isEmpty()) {
                setStatus("⚠️ 请输入 GitHub Token", false)
                return@setOnClickListener
            }
            if (repo.isEmpty()) {
                setStatus("⚠️ 请输入仓库名", false)
                return@setOnClickListener
            }

            // 保存 Token
            prefs.edit().putString("github_token", token).apply()
            prefs.edit().putString("github_repo", repo).apply()

            val md = markdownInput.text.toString().trim()
            if (md.isEmpty()) {
                setStatus("⚠️ 请输入 Markdown 内容", false)
                return@setOnClickListener
            }

            triggerRender(token, repo, md)
        }

        // 下载按钮
        downloadButton.setOnClickListener {
            val token = tokenInput.text.toString().trim()
            val repo = repoInput.text.toString().trim()
            if (token.isEmpty() || repo.isEmpty()) {
                setStatus("⚠️ 请先配置 Token 和仓库", false)
                return@setOnClickListener
            }
            downloadVideo(token, repo)
        }
    }

    private fun setupSpinner(spinner: Spinner, items: Array<String>) {
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, items)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinner.adapter = adapter
    }

    private fun setStatus(msg: String, success: Boolean) {
        runOnUiThread {
            statusText.text = msg
            statusText.setTextColor(if (success) 0xFF3FB950.toInt() else 0xFFD29922.toInt())
        }
    }

    private fun triggerRender(token: String, repo: String, markdown: String) {
        setStatus("⏳ 正在触发 GitHub Actions 渲染...", false)
        renderButton.isEnabled = false

        scope.launch(Dispatchers.IO) {
            try {
                val url = URL("https://api.github.com/repos/$repo/actions/workflows/render.yml/dispatches")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.setRequestProperty("Accept", "application/vnd.github+json")
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true

                val persona = personaSpinner.selectedItem.toString()
                val template = templateSpinner.selectedItem.toString()
                val quality = qualitySpinner.selectedItem.toString()
                val truthMode = truthSpinner.selectedItem.toString()

                val body = JSONObject().apply {
                    put("ref", "main")
                    put("inputs", JSONObject().apply {
                        put("markdown", markdown)
                        put("persona", persona)
                        put("template", template)
                        put("quality", quality)
                        put("truth_mode", truthMode)
                    })
                }

                val os = conn.outputStream
                os.write(body.toString().encodeToByteArray())
                os.close()

                val code = conn.responseCode
                conn.disconnect()

                if (code == 204) {
                    setStatus("✅ 渲染任务已提交！等待 GitHub 云端处理（3-8分钟），完成后点击「下载视频」", true)
                    // 延迟后获取 run ID
                    delay(5000)
                    getLatestRun(token, repo)
                } else {
                    val err = conn.errorStream?.bufferedReader()?.readText() ?: "未知错误"
                    setStatus("❌ 提交失败 ($code): $err", false)
                }
            } catch (e: Exception) {
                setStatus("❌ 网络错误: ${e.message}", false)
            } finally {
                runOnUiThread { renderButton.isEnabled = true }
            }
        }
    }

    private fun getLatestRun(token: String, repo: String) {
        scope.launch(Dispatchers.IO) {
            try {
                val url = URL("https://api.github.com/repos/$repo/actions/runs?status=in_progress&per_page=1")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.setRequestProperty("Accept", "application/vnd.github+json")

                val resp = conn.inputStream.bufferedReader().readText()
                conn.disconnect()

                val json = JSONObject(resp)
                val runs = json.getJSONArray("workflow_runs")
                if (runs.length() > 0) {
                    lastRunId = runs.getJSONObject(0).getString("id")
                    val htmlUrl = runs.getJSONObject(0).getString("html_url")
                    setStatus("✅ 任务已提交！查看进度: $htmlUrl\n完成后点击「下载视频」", true)
                }
            } catch (e: Exception) {
                // 不阻塞，让用户手动查看
            }
        }
    }

    private fun downloadVideo(token: String, repo: String) {
        setStatus("⏳ 正在查询最新 Artifacts...", false)
        downloadButton.isEnabled = false

        scope.launch(Dispatchers.IO) {
            try {
                // 获取最新的 artifacts
                val url = URL("https://api.github.com/repos/$repo/actions/artifacts?per_page=5")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.setRequestProperty("Accept", "application/vnd.github+json")

                val resp = conn.inputStream.bufferedReader().readText()
                conn.disconnect()

                val json = JSONObject(resp)
                val artifacts = json.getJSONArray("artifacts")

                if (artifacts.length() == 0) {
                    setStatus("❌ 没有找到已渲染的视频，请先提交渲染任务", false)
                    return@launch
                }

                // 找到最新的 truth-video-output artifact
                var targetId: String? = null
                for (i in 0 until artifacts.length()) {
                    val art = artifacts.getJSONObject(i)
                    if (art.getString("name") == "truth-video-output") {
                        targetId = art.getString("id")
                        break
                    }
                }

                if (targetId == null) {
                    setStatus("❌ 未找到渲染完成的视频 (artifact: truth-video-output)", false)
                    return@launch
                }

                // 下载 artifact
                val dlUrl = URL("https://api.github.com/repos/$repo/actions/artifacts/$targetId/zip")
                val dlConn = dlUrl.openConnection() as HttpURLConnection
                dlConn.requestMethod = "GET"
                dlConn.setRequestProperty("Authorization", "Bearer $token")
                dlConn.setRequestProperty("Accept", "application/vnd.github+json")

                // 保存到 Downloads
                val downloadDir = android.os.Environment.getExternalStoragePublicDirectory(
                    android.os.Environment.DIRECTORY_DOWNLOADS
                )
                val zipFile = File(downloadDir, "truth-video-output.zip")
                val inputStream = dlConn.inputStream
                val fileOutputStream = FileOutputStream(zipFile)
                inputStream.copyTo(fileOutputStream)
                fileOutputStream.close()
                inputStream.close()
                dlConn.disconnect()

                setStatus("✅ 视频已下载到: Downloads/truth-video-output.zip\n解压即可查看!", true)

            } catch (e: Exception) {
                setStatus("❌ 下载失败: ${e.message}", false)
            } finally {
                runOnUiThread { downloadButton.isEnabled = true }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
