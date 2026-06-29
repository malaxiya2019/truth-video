/**
 * truth-video Web UI Server
 *
 * 启动: node src/server.js
 * 访问: http://localhost:3456
 *
 * 功能:
 *   - 列出所有 .md 文件
 *   - 交互式生成 (--topic)
 *   - 启动渲染任务
 *   - 实时查看进度
 *   - 预览/下载视频
 */

import http from "http";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = parseInt(process.env.PORT || "3456");
const OUTPUT_DIR = path.join(ROOT, "output_webui");
const HISTORY_DIR = path.join(ROOT, ".truth-video");
const HISTORY_FILE = path.join(HISTORY_DIR, "history.json");

// ── 历史记录管理 (持久化) ──
fs.mkdirSync(HISTORY_DIR, { recursive: true });

let history = [];
try {
  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  }
} catch {}

function saveHistory() {
  try {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf8");
  } catch (e) {
    console.error(`  ⚠ 历史记录保存失败: ${e.message}`);
  }
}

function addHistoryEntry(entry) {
  // 去重: 相同 id 则更新
  const idx = history.findIndex((h) => h.id === entry.id);
  if (idx >= 0) history[idx] = entry;
  else history.unshift(entry); // 最新的在前面
  // 最多保留 50 条
  if (history.length > 50) history = history.slice(0, 50);
  saveHistory();
}

function deleteHistoryEntry(id) {
  history = history.filter((h) => h.id !== id);
  saveHistory();
}

// ── 渲染任务管理 ──
const jobs = new Map();
let jobCounter = 0;

function startRenderJob(filePath, options = {}) {
  const id = `job_${++jobCounter}`;
  const jobOutDir = path.join(OUTPUT_DIR, id);

  jobs.set(id, {
    id,
    file: filePath,
    options: { ...options },
    status: "running",
    progress: [],
    outputDir: jobOutDir,
    startedAt: Date.now(),
  });

  // 在子进程中运行渲染
  const args = [path.join(ROOT, "src", "cli.js"), filePath, `--out=${jobOutDir}`];
  if (options.persona) args.push(`--persona=${options.persona}`);
  if (options.truthMode) args.push(`--truth-mode=${options.truthMode}`);
  if (options.quality) args.push(`--quality=${options.quality}`);

  // 对于 topic 模式, 需要先生成脚本
  const child = spawn("node", args, {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  child.stdout.on("data", (data) => {
    const msg = data.toString().trim();
    const job = jobs.get(id);
    if (job) {
      job.progress.push(msg);
      // 检测完成
      if (msg.includes("完成") || msg.includes("DONE") || msg.includes("✨")) {
        job.status = "completed";
        job.completedAt = Date.now();
      }
    }
  });

  child.stderr.on("data", (data) => {
    const job = jobs.get(id);
    if (job) job.progress.push(`[stderr] ${data.toString().trim()}`);
  });

  child.on("close", (code) => {
    const job = jobs.get(id);
    if (job) {
      job.status = code === 0 ? "completed" : "failed";
      job.exitCode = code;
      job.completedAt = Date.now();
      job.elapsed = ((job.completedAt - job.startedAt) / 1000).toFixed(1);

      // 列出输出文件
      let outputFiles = [];
      if (fs.existsSync(job.outputDir)) {
        outputFiles = fs.readdirSync(job.outputDir).filter((f) => f.endsWith(".mp4") || f.endsWith(".html") || f.endsWith(".srt") || f.endsWith(".ass"));
      }
      job.outputFiles = outputFiles;

      // 持久化到历史记录
      addHistoryEntry({
        id: job.id,
        file: path.basename(job.file),
        filePath: job.file,
        options: job.options || {},
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        elapsed: job.elapsed,
        outputFiles: job.outputFiles,
        outputDir: job.outputDir,
      });
    }
  });

  return id;
}

// ── MIME 类型 ──
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".json": "application/json",
  ".srt": "text/plain; charset=utf-8",
  ".ass": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
  }
}

// ── 路由 ──
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method;

  // ── API: 文件列表 ──
  if (url.pathname === "/api/files" && method === "GET") {
    const examplesDir = path.join(ROOT, "examples");
    const files = [];
    if (fs.existsSync(examplesDir)) {
      for (const f of fs.readdirSync(examplesDir)) {
        if (f.endsWith(".md")) {
          files.push({
            name: f,
            path: path.join(examplesDir, f),
            size: fs.statSync(path.join(examplesDir, f)).size,
          });
        }
      }
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ files }));
    return;
  }

  // ── API: 提交渲染任务 ──
  if (url.pathname === "/api/render" && method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const params = JSON.parse(body);

    let filePath = params.file;

    // topic 模式: 先生成脚本
    if (params.topic) {
      const { writeScript, writeTempFile } = await import("./writer/index.js");
      const script = await writeScript(params.topic, { style: params.style || "通俗", scenes: 5 });
      filePath = writeTempFile(script);
    }

    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "文件不存在" }));
      return;
    }

    const jobId = startRenderJob(filePath, params);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ jobId }));
    return;
  }

  // ── API: 任务状态 ──
  if (url.pathname.startsWith("/api/status/") && method === "GET") {
    const jobId = url.pathname.split("/").pop();
    const job = jobs.get(jobId);
    if (!job) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "任务不存在" }));
      return;
    }

    // 列出输出文件
    let outputFiles = [];
    if (fs.existsSync(job.outputDir)) {
      outputFiles = fs.readdirSync(job.outputDir).filter((f) => f.endsWith(".mp4") || f.endsWith(".html") || f.endsWith(".srt"));
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ...job,
      progress: job.progress.slice(-50),
      outputFiles,
      outputDir: job.outputDir,
    }));
    return;
  }

  // ── 静态文件: 输出目录 ──
  // 前端 URL 形如 /output/job_1/video.mp4 → 映射到 OUTPUT_DIR/job_1/video.mp4
  if (url.pathname.startsWith("/output/")) {
    const relative = url.pathname.replace("/output/", "");
    const filePath = path.join(OUTPUT_DIR, relative);
    serveStatic(res, filePath);
    return;
  }

  // ── 静态文件: Web UI ──
  if (url.pathname === "/" || url.pathname === "/index.html") {
    serveStatic(res, path.join(__dirname, "webui", "index.html"));
    return;
  }

  if (url.pathname === "/app.js") {
    serveStatic(res, path.join(__dirname, "webui", "app.js"));
    return;
  }

  if (url.pathname === "/app.css") {
    serveStatic(res, path.join(__dirname, "webui", "app.css"));
    return;
  }

  if (url.pathname === "/manifest.json") {
    serveStatic(res, path.join(__dirname, "webui", "manifest.json"));
    return;
  }

  if (url.pathname === "/sw.js") {
    serveStatic(res, path.join(__dirname, "webui", "sw.js"));
    return;
  }

  if (url.pathname === "/icon-192.png") {
    serveStatic(res, path.join(__dirname, "webui", "icon-192.png"));
    return;
  }

  if (url.pathname === "/icon-512.png") {
    serveStatic(res, path.join(__dirname, "webui", "icon-512.png"));
    return;
  }

  if (url.pathname === "/kg-viewer.html") {
    serveStatic(res, path.join(__dirname, "webui", "kg-viewer.html"));
    return;
  }

  // ── API: 历史记录列表 ──
  if (url.pathname === "/api/history" && method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ history }));
    return;
  }

  // ── API: 删除历史记录 ──
  if (url.pathname.startsWith("/api/history/") && method === "DELETE") {
    const id = url.pathname.split("/").pop();
    deleteHistoryEntry(id);
    // 同时删除输出目录
    const dir = path.join(OUTPUT_DIR, id);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // ── API: 重新渲染历史任务 ──
  if (url.pathname.startsWith("/api/history/") && url.pathname.endsWith("/re-render") && method === "POST") {
    const id = url.pathname.split("/")[3]; // /api/history/{id}/re-render
    const entry = history.find((h) => h.id === id);
    if (!entry) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "记录不存在" }));
      return;
    }
    if (!fs.existsSync(entry.filePath)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `源文件不存在: ${entry.filePath}` }));
      return;
    }
    const jobId = startRenderJob(entry.filePath, entry.options);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ jobId }));
    return;
  }

  // ── API: 项目导出 ──
  if (url.pathname.startsWith("/api/project/export/") && method === "GET") {
    const id = url.pathname.split("/").pop();
    const entry = history.find((h) => h.id === id);
    if (!entry || !fs.existsSync(entry.outputDir)) {
      res.writeHead(404);
      res.end("项目不存在");
      return;
    }

    try {
      const { default: archiver } = await import("archiver");
      const zipPath = path.join(OUTPUT_DIR, `${id}.tvproj`);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.pipe(output);

      // 添加源文件
      if (fs.existsSync(entry.filePath)) {
        archive.file(entry.filePath, { name: `source/${path.basename(entry.filePath)}` });
      }

      // 添加历史配置
      archive.append(JSON.stringify(entry, null, 2), { name: "project.json" });

      // 添加知识图谱
      const kgPath = path.join(ROOT, ".hermes", "truth_kg.json");
      if (fs.existsSync(kgPath)) {
        archive.file(kgPath, { name: "knowledge-graph.json" });
      }

      // 添加输出视频 (只加 lecture 版作为代表)
      const lectureVideo = path.join(entry.outputDir, "video_lecture.mp4");
      if (fs.existsSync(lectureVideo)) {
        archive.file(lectureVideo, { name: "output/video_lecture.mp4" });
      }
      const subtitle = path.join(entry.outputDir, "subtitles.srt");
      if (fs.existsSync(subtitle)) {
        archive.file(subtitle, { name: "output/subtitles.srt" });
      }

      await new Promise((resolve) => { output.on("close", resolve); archive.finalize(); });

      serveStatic(res, zipPath);
    } catch (e) {
      // archiver 未安装时的降级方案: 返回 JSON
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "需要 archiver 包: npm install archiver",
        manual: `项目文件位于 ${entry.outputDir}`,
        source: entry.filePath,
      }));
    }
    return;
  }

  // ── API: 知识图谱数据 ──
  if (url.pathname.startsWith("/api/kg/") && method === "GET") {
    const id = url.pathname.split("/").pop();
    const kgPath = path.join(OUTPUT_DIR, id, "knowledge-graph.json");
    if (!fs.existsSync(kgPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "知识图谱数据不存在", note: "需要重新渲染以生成图谱数据" }));
      return;
    }
    serveStatic(res, kgPath);
    return;
  }

  // ── API: 项目导入 (简易版: 通知路径) ──
  if (url.pathname === "/api/project/import" && method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const params = JSON.parse(body);
      if (params.filePath && fs.existsSync(params.filePath)) {
        // 直接用路径导入: 提交渲染
        const jobId = startRenderJob(params.filePath, params.options || {});
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jobId, message: "从路径导入成功" }));
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "请提供有效的文件路径" }));
      }
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "无效的请求体" }));
    }
    return;
  }

  // ── 404 ──
  res.writeHead(404);
  res.end("Not Found");
}

// ── 启动 ──
const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`
  🌐 truth-video Web UI

    地址: http://localhost:${PORT}

    选项:
      PORT=3456         修改端口
      node src/server.js 启动服务

    支持的 API:
      GET  /api/files           列出 .md 文件
      POST /api/render          提交渲染任务
      GET  /api/status/:jobId   查看任务状态
      GET  /api/history         查看渲染历史
      DELETE /api/history/:id   删除历史记录
      GET  /api/project/export/:jobId  导出项目 (.tvproj)
    GET  /api/kg/:jobId        知识图谱数据 (交互播放器)
    GET  /kg-viewer.html       知识图谱交互播放器页面
  `);
});
