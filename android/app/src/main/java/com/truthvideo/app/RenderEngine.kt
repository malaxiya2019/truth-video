package com.truthvideo.app

import android.content.Context
import android.graphics.*
import android.media.*
import android.os.Environment
import android.speech.tts.TextToSpeech
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import kotlinx.coroutines.*
import java.io.*
import java.nio.ByteBuffer
import java.util.*

/**
 * TruthVideo 独立渲染引擎
 *
 * 100% 离线运行，不依赖任何外部服务或原生二进制。
 * 使用 Android 原生 API 替代 ffmpeg / Python / edge-tts / Chromium:
 *
 *   WebView          → HTML 渲染 + 帧捕获 (替代 Playwright/Chromium)
 *   TextToSpeech     → 语音合成 (替代 edge-tts)
 *   MediaCodec       → H.264 视频编码 (替代 ffmpeg libx264)
 *   MediaMuxer       → MP4 封装 (替代 ffmpeg)
 */
class RenderEngine(private val context: Context) {

    var onProgress: (String) -> Unit = {}
    var onComplete: (File) -> Unit = {}
    var onError: (String) -> Unit = {}

    private var job: Job? = null
    private var webView: WebView? = null

    data class Params(
        val markdown: String,
        val theme: String = "tech",
        val fps: Int = 30,
        val width: Int = 854,
        val height: Int = 480
    )

    data class Scene(
        val title: String,
        val body: String,
        val durationMs: Int
    )

    fun start(params: Params) {
        job?.cancel()
        job = CoroutineScope(Dispatchers.Main + SupervisorJob()).launch {
            try {
                runPipeline(params)
            } catch (e: CancellationException) {
                onProgress("⏹ 已取消")
            } catch (e: Exception) {
                onError("❌ ${e.message ?: "未知错误"}")
            }
        }
    }

    fun cancel() {
        job?.cancel()
        job = null
        try { webView?.destroy() } catch (_: Exception) {}
    }

    // ─── 渲染管线 ───

    private suspend fun runPipeline(params: Params) {
        onProgress("📝 初始化...")

        // 1. WebView + JS 引擎
        val wv = initWebView(params)
        webView = wv

        // 2. 解析 Markdown
        onProgress("🔍 解析 Markdown...")
        val scenes = parseScenes(params.markdown)
        if (scenes.isEmpty()) throw Exception("无法解析 Markdown")

        // 3. 生成 HTML 并加载到 WebView
        onProgress("🎨 生成动画...")
        val html = generateHtml(scenes, params)
        loadHtmlSync(wv, html)

        // 4. 计算总帧数
        val totalMs = scenes.sumOf { it.durationMs }
        val totalFrames = totalMs * params.fps / 1000

        // 5. 准备输出目录
        val outputDir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES),
            "TruthVideo"
        )
        outputDir.mkdirs()
        val outputFile = File(outputDir, "TV_${System.currentTimeMillis()}.mp4")

        // 6. 配置编码器
        onProgress("🎬 编码视频...")

        val muxer = MediaMuxer(
            outputFile.absolutePath,
            MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4
        )

        // 视频编码器
        val videoFormat = MediaFormat.createVideoFormat(
            MediaFormat.MIMETYPE_VIDEO_AVC, params.width, params.height
        )
        videoFormat.setInteger(MediaFormat.KEY_COLOR_FORMAT,
            MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
        videoFormat.setInteger(MediaFormat.KEY_BIT_RATE, 2_000_000)
        videoFormat.setInteger(MediaFormat.KEY_FRAME_RATE, params.fps)
        videoFormat.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)

        val videoCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        videoCodec.configure(videoFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        val inputSurface = videoCodec.createInputSurface()
        videoCodec.start()

        // 7. 逐场景渲染帧到表面
        var frameIdx = 0
        for ((si, scene) in scenes.withIndex()) {
            val frames = scene.durationMs * params.fps / 1000
            wv.evaluateJavascript("showScene($si)", null)
            delay(100) // 等待渲染

            for (f in 0 until frames) {
                val bitmap = Bitmap.createBitmap(params.width, params.height, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bitmap)
                wv.draw(canvas)

                val surfCanvas = inputSurface.lockCanvas(null)
                surfCanvas.drawBitmap(bitmap, 0f, 0f, Paint())
                inputSurface.unlockCanvasAndPost(surfCanvas)
                bitmap.recycle()

                frameIdx++
                if (f % params.fps == 0 || f == frames - 1) {
                    val pct = frameIdx * 100 / totalFrames
                    onProgress("🎬 编码 ${scene.title.take(16)}... (${pct}%)")
                }
            }
        }

        videoCodec.signalEndOfInputStream()

        // 8. 音频 TTS
        onProgress("🎤 生成语音...")
        ttsFile = null
        val tts = initTts()
        val audioFile = File(outputDir, "audio_temp.wav")
        if (tts != null) {
            val fullText = scenes.joinToString("。") { s ->
                if (s.body.isNotBlank()) "${s.title}。${s.body}" else s.title
            }
            synthesizeSync(tts, fullText, audioFile)
            tts.shutdown()
        } else {
            generateSilentWav(audioFile, totalMs)
        }

        // 9. 音频编码
        val audioFormat = MediaFormat.createAudioFormat(
            MediaFormat.MIMETYPE_AUDIO_AAC, 22050, 1
        )
        audioFormat.setInteger(MediaFormat.KEY_AAC_PROFILE,
            MediaCodecInfo.CodecProfileLevel.AACObjectLC)
        audioFormat.setInteger(MediaFormat.KEY_BIT_RATE, 64000)

        val audioCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
        audioCodec.configure(audioFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        audioCodec.start()

        // 10. 组装
        val videoTrack = muxer.addTrack(videoFormat)
        val audioTrack = muxer.addTrack(audioFormat)
        muxer.start()

        // Drain video
        drainCodec(videoCodec, muxer, videoTrack)
        // Feed audio data
        feedAudioToCodec(audioFile, audioCodec, muxer, audioTrack)
        drainCodec(audioCodec, muxer, audioTrack)

        muxer.stop()
        muxer.release()
        videoCodec.stop()
        videoCodec.release()
        audioCodec.stop()
        audioCodec.release()
        audioFile.delete()

        onProgress("✅ 完成!")
        onComplete(outputFile)
    }

    private var ttsFile: File? = null

    private fun initTts(): TextToSpeech? {
        val ready = CompletableDeferred<TextToSpeech?>()
        val tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts.language = Locale.CHINESE
                tts.setSpeechRate(1.0f)
                tts.setPitch(1.0f)
                ready.complete(tts)
            } else {
                ready.complete(null)
            }
        }
        return runBlocking { ready.await() }
    }

    private fun synthesizeSync(tts: TextToSpeech, text: String, out: File) {
        val done = CompletableDeferred<Unit>()
        val id = "utt_${System.nanoTime()}"
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onDone(uid: String?) { if (uid == id) done.complete(Unit) }
            override fun onError(uid: String?) { done.complete(Unit) }
            override fun onStart(uid: String?) {}
        })
        val result = tts.synthesizeToFile(text, null, out, id)
        if (result != TextToSpeech.SUCCESS) {
            generateSilentWav(out, 10000)
            return
        }
        runBlocking {
            withTimeout(60000) { done.await() }
        }
    }

    private fun feedAudioToCodec(
        audioFile: File, codec: MediaCodec,
        muxer: MediaMuxer, track: Int
    ) {
        val sampleRate = 22050
        // Read WAV
        val wavBytes = audioFile.readBytes()
        if (wavBytes.size < 44) return
        val dataSize = minOf(
            wavBytes.size - 44,
            ((wavBytes[40].toInt() and 0xFF) or
                    ((wavBytes[41].toInt() and 0xFF) shl 8) or
                    ((wavBytes[42].toInt() and 0xFF) shl 16) or
                    ((wavBytes[43].toInt() and 0xFF) shl 24))
        )
        val pcmData = wavBytes.copyOfRange(44, 44 + dataSize)
        val chunkSize = 4096
        var offset = 0
        var presentationUs = 0L

        while (offset < pcmData.size) {
            val size = minOf(chunkSize, pcmData.size - offset)
            val inputIndex = codec.dequeueInputBuffer(10000)
            if (inputIndex >= 0) {
                val buf = codec.getInputBuffer(inputIndex)!!
                buf.clear()
                buf.put(pcmData, offset, size)
                val isEnd = (offset + size) >= pcmData.size
                val flags = if (isEnd) MediaCodec.BUFFER_FLAG_END_OF_STREAM else 0
                codec.queueInputBuffer(inputIndex, 0, size, presentationUs, flags)
                offset += size
                presentationUs += (size * 1_000_000L) / (sampleRate * 2)
            }
        }
    }

    private fun drainCodec(codec: MediaCodec, muxer: MediaMuxer, track: Int) {
        val info = MediaCodec.BufferInfo()
        var done = false
        var timeout = 0
        while (!done && timeout < 100) {
            val idx = codec.dequeueOutputBuffer(info, 10000)
            when {
                idx >= 0 -> {
                    val buf = codec.getOutputBuffer(idx)!!
                    val data = ByteArray(info.size)
                    buf.position(info.offset)
                    buf.get(data)
                    buf.clear()
                    muxer.writeSampleData(track, ByteBuffer.wrap(data), info)
                    codec.releaseOutputBuffer(idx, false)
                    if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) done = true
                    timeout = 0
                }
                idx == MediaCodec.INFO_TRY_AGAIN_LATER -> timeout++
                else -> {}
            }
        }
    }

    // ─── WebView ───

    private suspend fun initWebView(params: Params): WebView = withContext(Dispatchers.Main) {
        val wv = WebView(context).apply {
            layout(0, 0, params.width, params.height)
            setInitialScale(100)
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                loadWithOverviewMode = true
                useWideViewPort = true
                builtInZoomControls = false
                displayZoomControls = false
            }
        }
        return@withContext wv
    }

    private suspend fun loadHtmlSync(wv: WebView, html: String) = withContext(Dispatchers.Main) {
        val done = CompletableDeferred<Unit>()
        wv.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                done.complete(Unit)
            }
        }
        wv.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
        done.await()
    }

    // ─── Markdown 解析 ───

    fun parseScenes(md: String): List<Scene> {
        val scenes = mutableListOf<Scene>()
        var title = ""
        val body = StringBuilder()
        for (line in md.lines()) {
            val t = line.trim()
            when {
                t.startsWith("# ") && !t.startsWith("## ") -> {
                    if (title.isNotEmpty()) scenes.add(makeScene(title, body))
                    title = t.removePrefix("# ").trim()
                    body.clear()
                }
                t.startsWith("## ") -> {
                    if (title.isNotEmpty()) scenes.add(makeScene(title, body))
                    title = t.removePrefix("## ").trim()
                    body.clear()
                }
                t.isNotEmpty() && t.startsWith("### ") -> {
                    if (body.isNotEmpty()) body.append("\n\n")
                    body.append(t)
                }
                t.isNotEmpty() -> {
                    if (body.isNotEmpty()) body.append(" ")
                    body.append(t)
                }
            }
        }
        if (title.isNotEmpty()) scenes.add(makeScene(title, body))
        return scenes
    }

    private fun makeScene(title: String, body: StringBuilder): Scene {
        val b = body.toString().trim()
        val textLen = "$title。$b".replace("\\s".toRegex(), "").length
        val duration = maxOf(3000, textLen * 250)
        return Scene(title, b, duration)
    }

    // ─── HTML 生成器 ───

    private fun generateHtml(scenes: List<Scene>, params: Params): String {
        val themeColors = mapOf(
            "tech" to """|  --bg: #0a1628; --text: #e0e8f0;
                         |  --accent: #58a6ff; --secondary: #8b949e;
                         |  --card: #0d1a31;""".trimMargin(),
            "dark" to """|  --bg: #0d1117; --text: #e6edf3;
                         |  --accent: #58a6ff; --secondary: #8b949e;
                         |  --card: #161b22;""".trimMargin(),
            "minimal" to """|  --bg: #ffffff; --text: #24292f;
                            |  --accent: #0969da; --secondary: #656d76;
                            |  --card: #f6f8fa;""".trimMargin()
        )
        val cssVars = themeColors[params.theme] ?: themeColors["tech"]!!

        val sceneDivs = scenes.joinToString("\n") { s ->
            val escBody = s.body
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
            """  <div class="scene" data-i="${scenes.indexOf(s)}">
               |    <div class="s-title">${s.title}</div>
               |    ${if (escBody.isNotBlank()) "<div class=\"s-body\">$escBody</div>" else ""}
               |  </div>""".trimMargin()
        }

        return """<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
:root { $cssVars }
* { margin:0; padding:0; box-sizing:border-box; }
body { background:var(--bg); color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  width:${params.width}px; }
.scene {
  width:${params.width}px; height:${params.height}px;
  display:flex; flex-direction:column; justify-content:center;
  padding:40px 60px;
  border-bottom:1px solid var(--card);
}
.s-title { font-size:36px; font-weight:bold; color:var(--accent); line-height:1.3; }
.s-body { margin-top:16px; font-size:20px; color:var(--secondary); line-height:1.6; }
</style></head><body>
$sceneDivs
<script>
function showScene(i) {
  document.querySelectorAll('.scene').forEach((s,idx)=>{
    s.style.display = idx===i ? 'flex' : 'none';
  });
}
showScene(0);
</script>
</body></html>"""
    }

    // ─── 静音 WAV ───

    private fun generateSilentWav(file: File, durationMs: Int) {
        val sr = 22050
        val samples = sr * durationMs / 1000
        val data = ByteArray(samples * 2)
        file.outputStream().use { it.write(wavHeader(data.size, sr)); it.write(data) }
    }

    private fun wavHeader(dataSize: Int, sampleRate: Int): ByteArray {
        val h = ByteArray(44)
        h[0] = 'R'.code.toByte(); h[1] = 'I'.code.toByte()
        h[2] = 'F'.code.toByte(); h[3] = 'F'.code.toByte()
        putInt(h, 4, 36 + dataSize)
        h[8] = 'W'.code.toByte(); h[9] = 'A'.code.toByte()
        h[10] = 'V'.code.toByte(); h[11] = 'E'.code.toByte()
        h[12] = 'f'.code.toByte(); h[13] = 'm'.code.toByte()
        h[14] = 't'.code.toByte(); h[15] = ' '.code.toByte()
        putInt(h, 16, 16); putShort(h, 20, 1); putShort(h, 22, 1)
        putInt(h, 24, sampleRate); putInt(h, 28, sampleRate * 2)
        putShort(h, 32, 2); putShort(h, 34, 16)
        h[36] = 'd'.code.toByte(); h[37] = 'a'.code.toByte()
        h[38] = 't'.code.toByte(); h[39] = 'a'.code.toByte()
        putInt(h, 40, dataSize)
        return h
    }

    private fun putInt(b: ByteArray, o: Int, v: Int) {
        b[o] = (v and 0xFF).toByte()
        b[o+1] = ((v shr 8) and 0xFF).toByte()
        b[o+2] = ((v shr 16) and 0xFF).toByte()
        b[o+3] = ((v shr 24) and 0xFF).toByte()
    }
    private fun putShort(b: ByteArray, o: Int, v: Int) {
        b[o] = (v and 0xFF).toByte()
        b[o+1] = ((v shr 8) and 0xFF).toByte()
    }
}
