package com.truthvideo.app

import android.content.Context
import android.graphics.*
import android.media.*
import android.os.Environment
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.webkit.WebView
import android.webkit.WebViewClient
import kotlinx.coroutines.*
import java.io.*
import java.nio.ByteBuffer
import java.util.*

/**
 * TruthVideo 独立渲染引擎
 *
 * 100% 离线运行，不依赖任何外部服务。
 * WebView → Canvas 截帧 | TextToSpeech → 逐场景语音 | MediaCodec + MediaMuxer → MP4
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

    data class Scene(val title: String, val body: String, val durationMs: Int)

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
        job?.cancel(); job = null
        try { webView?.destroy() } catch (_: Exception) {}
    }

    // ═══════════════════════════════════════════════════
    //  管线
    // ═══════════════════════════════════════════════════

    private suspend fun runPipeline(params: Params) {
        onProgress("📝 初始化...")
        val wv = initWebView(params); webView = wv

        onProgress("🔍 解析 Markdown...")
        val scenes = parseScenes(params.markdown)
        if (scenes.isEmpty()) throw Exception("无法解析 Markdown")

        onProgress("🎨 生成动画...")
        loadHtmlSync(wv, generateHtml(scenes, params))

        val totalMs = scenes.sumOf { it.durationMs }
        val totalFrames = totalMs * params.fps / 1000
        val outDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES), "TruthVideo")
        outDir.mkdirs()
        val mp4File = File(outDir, "TV_${System.currentTimeMillis()}.mp4")

        // ── 视频编码器 ──
        onProgress("🎬 编码视频...")
        val muxer = MediaMuxer(mp4File.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)

        val vfmt = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, params.width, params.height)
        vfmt.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
        vfmt.setInteger(MediaFormat.KEY_BIT_RATE, 2_000_000)
        vfmt.setInteger(MediaFormat.KEY_FRAME_RATE, params.fps)
        vfmt.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
        val vcodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        vcodec.configure(vfmt, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        val surface = vcodec.createInputSurface()
        vcodec.start()

        // ── 逐场景渲染帧 ──
        var fi = 0
        for ((si, scene) in scenes.withIndex()) {
            val nFrames = scene.durationMs * params.fps / 1000
            wv.evaluateJavascript("showScene($si)", null)
            delay(100)
            for (f in 0 until nFrames) {
                val bmp = Bitmap.createBitmap(params.width, params.height, Bitmap.Config.ARGB_8888)
                val c = Canvas(bmp)
                wv.draw(c)
                val sc = surface.lockCanvas(null)
                sc.drawBitmap(bmp, 0f, 0f, Paint())
                surface.unlockCanvasAndPost(sc)
                bmp.recycle()
                fi++
                if (f % params.fps == 0 || f == nFrames - 1) {
                    onProgress("🎬 ${scene.title.take(14)}... ${fi * 100 / totalFrames}%")
                }
            }
        }
        vcodec.signalEndOfInputStream()

        // ── TTS: 逐场景合成（永不截断！）──
        onProgress("🎤 生成语音...")
        val tts = initTts()
        val sceneAudioFiles = mutableListOf<File>()
        for ((si, scene) in scenes.withIndex()) {
            val txt = if (scene.body.isNotBlank()) "${scene.title}。${scene.body}" else scene.title
            val af = File(outDir, "a$si.wav")
            if (tts != null) {
                synthesizeSync(tts, txt, af) // 每个场景单独合成，绝不超长
                onProgress("🎤 TTS ${si+1}/${scenes.size}")
            } else {
                generateSilentWav(af, scene.durationMs)
            }
            sceneAudioFiles.add(af)
        }
        tts?.shutdown()

        // ── 合并音频 ──
        onProgress("🔊 合并音频...")
        val allAudio = File(outDir, "all.wav")
        concatWav(sceneAudioFiles, allAudio)
        sceneAudioFiles.forEach { it.delete() }

        // ── 音频编码器 ──
        val afmt = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, 22050, 1)
        afmt.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
        afmt.setInteger(MediaFormat.KEY_BIT_RATE, 64000)
        val acodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
        acodec.configure(afmt, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        acodec.start()

        // ── 组装 ──
        val vt = muxer.addTrack(vfmt)
        val at = muxer.addTrack(afmt)
        muxer.start()
        drainCodec(vcodec, muxer, vt)
        feedWavToCodec(allAudio, acodec, muxer, at)
        drainCodec(acodec, muxer, at)
        muxer.stop(); muxer.release()
        vcodec.stop(); vcodec.release()
        acodec.stop(); acodec.release()
        allAudio.delete()

        onProgress("✅ 完成!")
        onComplete(mp4File)
    }

    // ═══════════════════════════════════════════════════
    //  TTS — 逐场景合成
    // ═══════════════════════════════════════════════════

    private fun initTts(): TextToSpeech? {
        val d = CompletableDeferred<TextToSpeech?>()
        TextToSpeech(context) { s ->
            if (s == TextToSpeech.SUCCESS) {
                it?.let { t ->
                    t.language = Locale.CHINESE
                    t.setSpeechRate(1.0f)
                    t.setPitch(1.0f)
                    d.complete(t)
                } ?: d.complete(null)
            } else d.complete(null)
        }
        return runBlocking { d.await() }
    }

    /** 合成单段文本到 WAV 文件（每场景一段，永不超长） */
    private fun synthesizeSync(tts: TextToSpeech, text: String, out: File) {
        val d = CompletableDeferred<Unit>()
        val id = "s_${System.nanoTime()}"
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onDone(uid: String?) { if (uid == id) d.complete(Unit) }
            override fun onError(uid: String?) { d.complete(Unit) }
            override fun onStart(uid: String?) {}
        })
        val r = tts.synthesizeToFile(text, null, out, id)
        if (r != TextToSpeech.SUCCESS) { generateSilentWav(out, 3000); return }
        runBlocking { withTimeout(30_000) { d.await() } }
    }

    // ═══════════════════════════════════════════════════
    //  音频合并
    // ═══════════════════════════════════════════════════

    /** 合并多个 WAV 文件为一个 */
    private fun concatWav(files: List<File>, out: File) {
        if (files.isEmpty()) { generateSilentWav(out, 3000); return }
        if (files.size == 1) { files[0].copyTo(out, overwrite = true); return }

        val outStream = out.outputStream().buffered()
        // 读取所有 WAV 数据，合并 PCM
        val allPcm = ByteArrayOutputStream()
        var sampleRate = 22050
        for (f in files) {
            val bytes = f.readBytes()
            if (bytes.size < 44) continue
            sampleRate = ((bytes[24].toInt() and 0xFF) or
                    ((bytes[25].toInt() and 0xFF) shl 8) or
                    ((bytes[26].toInt() and 0xFF) shl 16) or
                    ((bytes[27].toInt() and 0xFF) shl 24))
            val dataSize = ((bytes[40].toInt() and 0xFF) or
                    ((bytes[41].toInt() and 0xFF) shl 8) or
                    ((bytes[42].toInt() and 0xFF) shl 16) or
                    ((bytes[43].toInt() and 0xFF) shl 24))
            val dataSizeActual = minOf(dataSize, bytes.size - 44)
            allPcm.write(bytes, 44, dataSizeActual)
        }
        val pcm = allPcm.toByteArray()
        outStream.write(wavHeader(pcm.size, sampleRate))
        outStream.write(pcm)
        outStream.close()
    }

    /** 把 WAV 文件喂给 MediaCodec AAC 编码器 */
    private fun feedWavToCodec(wav: File, codec: MediaCodec, muxer: MediaMuxer, track: Int) {
        val bytes = wav.readBytes()
        if (bytes.size < 44) return
        val sr = ((bytes[24].toInt() and 0xFF) or
                ((bytes[25].toInt() and 0xFF) shl 8) or
                ((bytes[26].toInt() and 0xFF) shl 16) or
                ((bytes[27].toInt() and 0xFF) shl 24))
        val dataSize = ((bytes[40].toInt() and 0xFF) or
                ((bytes[41].toInt() and 0xFF) shl 8) or
                ((bytes[42].toInt() and 0xFF) shl 16) or
                ((bytes[43].toInt() and 0xFF) shl 24))
        val dataSizeActual = minOf(dataSize, bytes.size - 44)
        val pcm = bytes.copyOfRange(44, 44 + dataSizeActual)

        val chunk = 4096
        var off = 0
        var pts = 0L
        while (off < pcm.size) {
            val sz = minOf(chunk, pcm.size - off)
            val idx = codec.dequeueInputBuffer(10_000)
            if (idx >= 0) {
                val buf = codec.getInputBuffer(idx)!!
                buf.clear()
                buf.put(pcm, off, sz)
                val end = (off + sz) >= pcm.size
                codec.queueInputBuffer(idx, 0, sz, pts / 1000, if (end) MediaCodec.BUFFER_FLAG_END_OF_STREAM else 0)
                off += sz
                pts += sz * 1_000_000L / (sr * 2)
            }
        }
    }

    // ═══════════════════════════════════════════════════
    //  编码器 Drain
    // ═══════════════════════════════════════════════════

    private fun drainCodec(codec: MediaCodec, muxer: MediaMuxer, track: Int) {
        val info = MediaCodec.BufferInfo()
        var done = false
        var retries = 0
        while (!done && retries < 200) {
            val idx = codec.dequeueOutputBuffer(info, 10_000)
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
                    retries = 0
                }
                idx == MediaCodec.INFO_TRY_AGAIN_LATER -> retries++
                else -> {}
            }
        }
    }

    // ═══════════════════════════════════════════════════
    //  WebView
    // ═══════════════════════════════════════════════════

    private suspend fun initWebView(p: Params): WebView = withContext(Dispatchers.Main) {
        WebView(context).apply {
            layout(0, 0, p.width, p.height)
            setInitialScale(100)
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            settings.apply {
                javaScriptEnabled = true; domStorageEnabled = true
                loadWithOverviewMode = true; useWideViewPort = true
                builtInZoomControls = false; displayZoomControls = false
            }
        }
    }

    private suspend fun loadHtmlSync(wv: WebView, html: String) = withContext(Dispatchers.Main) {
        val d = CompletableDeferred<Unit>()
        wv.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) { d.complete(Unit) }
        }
        wv.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
        d.await()
    }

    // ═══════════════════════════════════════════════════
    //  Markdown 解析
    // ═══════════════════════════════════════════════════

    fun parseScenes(md: String): List<Scene> {
        val list = mutableListOf<Scene>()
        var t = ""; val b = StringBuilder()
        for (line in md.lines()) {
            val tr = line.trim()
            when {
                tr.startsWith("# ") && !tr.startsWith("## ") -> {
                    if (t.isNotEmpty()) list += makeScene(t, b)
                    t = tr.removePrefix("# ").trim(); b.clear()
                }
                tr.startsWith("## ") -> {
                    if (t.isNotEmpty()) list += makeScene(t, b)
                    t = tr.removePrefix("## ").trim(); b.clear()
                }
                tr.isNotEmpty() -> { if (b.isNotEmpty()) b.append(" "); b.append(tr) }
            }
        }
        if (t.isNotEmpty()) list += makeScene(t, b)
        return list
    }

    private fun makeScene(title: String, body: StringBuilder): Scene {
        val bt = body.toString().trim()
        val len = "$title。$bt".replace("\\s".toRegex(), "").length
        return Scene(title, bt, maxOf(3000, len * 250))
    }

    // ═══════════════════════════════════════════════════
    //  HTML 生成
    // ═══════════════════════════════════════════════════

    private fun generateHtml(scenes: List<Scene>, p: Params): String {
        val vars = mapOf(
            "tech" to "--bg:#0a1628;--text:#e0e8f0;--accent:#58a6ff;--secondary:#8b949e;--card:#0d1a31",
            "dark" to "--bg:#0d1117;--text:#e6edf3;--accent:#58a6ff;--secondary:#8b949e;--card:#161b22",
            "minimal" to "--bg:#ffffff;--text:#24292f;--accent:#0969da;--secondary:#656d76;--card:#f6f8fa"
        )[p.theme] ?: "--bg:#0a1628;--text:#e0e8f0;--accent:#58a6ff;--secondary:#8b949e;--card:#0d1a31"

        val divs = scenes.joinToString("\n") { s ->
            val eb = s.body.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
            """<div class="s"><div class="st">${s.title}</div>${if(eb.isNotBlank())"<div class=\"sb\">$eb</div>"else""}</div>"""
        }
        return """<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
:root{$vars}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,sans-serif;width:${p.width}px}
.s{width:${p.width}px;height:${p.height}px;display:flex;flex-direction:column;justify-content:center;padding:40px 60px}
.st{font-size:36px;font-weight:bold;color:var(--accent);line-height:1.3}
.sb{margin-top:16px;font-size:20px;color:var(--secondary);line-height:1.6}
</style></head><body>
$divs
<script>function showScene(i){document.querySelectorAll('.s').forEach((e,idx)=>{e.style.display=idx===i?'flex':'none'})}showScene(0)</script>
</body></html>"""
    }

    // ═══════════════════════════════════════════════════
    //  静音 WAV / 工具
    // ═══════════════════════════════════════════════════

    private fun generateSilentWav(f: File, ms: Int) {
        val sr = 22050; val n = sr * ms / 1000; val d = ByteArray(n * 2)
        f.outputStream().use { it.write(wavHeader(d.size, sr)); it.write(d) }
    }

    private fun wavHeader(ds: Int, sr: Int): ByteArray {
        val h = ByteArray(44)
        h[0]='R'.code.toByte();h[1]='I'.code.toByte();h[2]='F'.code.toByte();h[3]='F'.code.toByte()
        i32(h,4,36+ds)
        h[8]='W'.code.toByte();h[9]='A'.code.toByte();h[10]='V'.code.toByte();h[11]='E'.code.toByte()
        h[12]='f'.code.toByte();h[13]='m'.code.toByte();h[14]='t'.code.toByte();h[15]=' '.code.toByte()
        i32(h,16,16);i16(h,20,1);i16(h,22,1);i32(h,24,sr);i32(h,28,sr*2);i16(h,32,2);i16(h,34,16)
        h[36]='d'.code.toByte();h[37]='a'.code.toByte();h[38]='t'.code.toByte();h[39]='a'.code.toByte()
        i32(h,40,ds); return h
    }
    private fun i32(b: ByteArray, o: Int, v: Int) { b[o]=(v and 0xFF).toByte();b[o+1]=((v shr 8) and 0xFF).toByte();b[o+2]=((v shr 16) and 0xFF).toByte();b[o+3]=((v shr 24) and 0xFF).toByte() }
    private fun i16(b: ByteArray, o: Int, v: Int) { b[o]=(v and 0xFF).toByte();b[o+1]=((v shr 8) and 0xFF).toByte() }
}
