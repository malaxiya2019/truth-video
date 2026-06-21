/**
 * truth-video Web UI — 前端逻辑 v2 (含历史记录)
 */

let currentJobId = null;
let pollTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  // ── Tab 切换 ──
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");

      // 切到历史 tab 时自动刷新
      if (tab.dataset.tab === "history") loadHistory();
    });
  });

  // ── 刷新文件列表 ──
  document.getElementById("btn-refresh").addEventListener("click", loadFiles);
  loadFiles();

  // ── 刷新历史 ──
  document.getElementById("btn-refresh-history").addEventListener("click", loadHistory);

  // ── 开始渲染 ──
  document.getElementById("btn-render").addEventListener("click", startRender);
});

// ── 加载文件列表 ──
async function loadFiles() {
  const select = document.getElementById("file-select");
  select.innerHTML = '<option value="" disabled>加载中...</option>';

  try {
    const resp = await fetch("/api/files");
    const data = await resp.json();
    select.innerHTML = "";
    for (const f of data.files) {
      const opt = document.createElement("option");
      opt.value = f.path;
      opt.textContent = `${f.name} (${(f.size / 1024).toFixed(0)} KB)`;
      select.appendChild(opt);
    }
    if (data.files.length === 0) {
      select.innerHTML = '<option value="" disabled>暂无 .md 文件</option>';
    }
  } catch (e) {
    select.innerHTML = '<option value="" disabled>加载失败</option>';
  }
}

// ── 加载历史记录 ──
async function loadHistory() {
  const container = document.getElementById("history-list");
  container.innerHTML = '<p class="hint">加载中...</p>';

  try {
    const resp = await fetch("/api/history");
    const data = await resp.json();

    if (!data.history || data.history.length === 0) {
      container.innerHTML = '<p class="hint">暂无渲染历史</p>';
      return;
    }

    container.innerHTML = "";
    for (const entry of data.history) {
      const div = document.createElement("div");
      div.className = "history-item";

      const icon = entry.status === "completed" ? "✅" : entry.status === "failed" ? "❌" : "⏳";
      const date = new Date(entry.startedAt).toLocaleString("zh-CN");
      const opts = Object.entries(entry.options || {})
        .filter(([k, v]) => v && k !== "file")
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");

      let actionsHTML = "";
      if (entry.status === "completed") {
        actionsHTML = `
          <button class="btn-sm" onclick="reRenderHistory('${entry.id}')">🔄 重新渲染</button>
          <button class="btn-sm" onclick="exportProject('${entry.id}')">📦 导出</button>
          <button class="btn-sm" onclick="deleteHistory('${entry.id}')" style="color:#f85149">🗑 删除</button>
        `;
      } else {
        actionsHTML = `<button class="btn-sm" onclick="deleteHistory('${entry.id}')" style="color:#f85149">🗑 删除</button>`;
      }

      div.innerHTML = `
        <div class="history-header">
          <span class="history-icon">${icon}</span>
          <span class="history-file">${escapeHtml(entry.file)}</span>
          <span class="history-time">${date}</span>
        </div>
        <div class="history-meta">
          ${opts ? `<span class="history-opts">${escapeHtml(opts)}</span>` : ""}
          <span class="history-elapsed">${entry.elapsed ? entry.elapsed + "s" : ""}</span>
        </div>
        <div class="history-files">
          ${(entry.outputFiles || []).filter(f => f.endsWith(".mp4")).map(f =>
            `<a href="/output/${entry.id}/${f}" target="_blank">📹 ${f}</a> ${f.endsWith("video.mp4") ? `<a href="/kg-viewer.html?job=${entry.id}" target="_blank" style="margin-left:4px">🕸</a>` : ""}`
          ).join(" ")}
        </div>
        <div class="history-actions">${actionsHTML}</div>
      `;
      container.appendChild(div);
    }
  } catch (e) {
    container.innerHTML = `<p class="hint" style="color:#f85149">加载失败: ${e.message}</p>`;
  }
}

// ── 重新渲染历史任务 ──
async function reRenderHistory(id) {
  try {
    const resp = await fetch(`/api/history/${id}/re-render`, { method: "POST" });
    const data = await resp.json();
    if (data.jobId) {
      // 切到文件 tab 开始监控
      document.querySelector('.tab[data-tab="file"]').click();
      pollJobStatusFromId(data.jobId);
    }
  } catch (e) {
    alert("重新渲染失败: " + e.message);
  }
}

// ── 导出项目 ──
async function exportProject(id) {
  try {
    const resp = await fetch(`/api/project/export/${id}`);
    if (resp.headers.get("content-type")?.includes("json")) {
      const data = await resp.json();
      alert(data.error || "导出失败");
    } else {
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${id}.tvproj`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    alert("导出失败: " + e.message);
  }
}

// ── 删除历史 ──
async function deleteHistory(id) {
  if (!confirm(`确定删除历史记录 "${id}"? 视频文件也会被删除。`)) return;
  try {
    await fetch(`/api/history/${id}`, { method: "DELETE" });
    loadHistory();
  } catch (e) {
    alert("删除失败: " + e.message);
  }
}

// ── 开始渲染 ──
async function startRender() {
  const btn = document.getElementById("btn-render");
  btn.disabled = true;
  btn.textContent = "⏳ 渲染中...";

  const isTopic = document.querySelector('.tab[data-tab="topic"]').classList.contains("active");
  const logBox = document.getElementById("progress-log");
  const statusBox = document.getElementById("job-status");
  const fileList = document.getElementById("output-files");

  logBox.innerHTML = "";
  fileList.innerHTML = "";
  statusBox.innerHTML = '<p class="hint">⏳ 提交任务...</p>';

  let params = {
    persona: document.getElementById("persona-select").value,
    quality: document.getElementById("quality-select").value,
    truthMode: document.getElementById("truth-select").value,
  };

  if (isTopic) {
    params.topic = document.getElementById("topic-input").value.trim();
    params.style = document.getElementById("style-select").value;
    if (!params.topic) {
      statusBox.innerHTML = '<p class="hint" style="color:#f85149">请输入主题</p>';
      btn.disabled = false;
      btn.textContent = "▶ 开始渲染";
      return;
    }
  } else {
    const select = document.getElementById("file-select");
    params.file = select.value;
    if (!params.file) {
      statusBox.innerHTML = '<p class="hint" style="color:#f85149">请选择一个文件</p>';
      btn.disabled = false;
      btn.textContent = "▶ 开始渲染";
      return;
    }
  }

  try {
    const resp = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await resp.json();

    if (data.error) {
      statusBox.innerHTML = `<p class="hint" style="color:#f85149">✖ ${data.error}</p>`;
      btn.disabled = false;
      btn.textContent = "▶ 开始渲染";
      return;
    }

    pollJobStatusFromId(data.jobId);

  } catch (e) {
    statusBox.innerHTML = `<p class="hint" style="color:#f85149">✖ 连接失败</p>`;
    btn.disabled = false;
    btn.textContent = "▶ 开始渲染";
  }
}

// ── 从 jobId 开始轮询 ──
function pollJobStatusFromId(jobId) {
  currentJobId = jobId;
  const statusBox = document.getElementById("job-status");
  statusBox.innerHTML = `<p class="hint" style="color:#58a6ff">⏳ 任务 ${jobId} 运行中...</p>`;

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => pollJobStatus(currentJobId), 1000);
}

// ── 轮询任务状态 ──
async function pollJobStatus(jobId) {
  try {
    const resp = await fetch(`/api/status/${jobId}`);
    const job = await resp.json();

    const logBox = document.getElementById("progress-log");
    const statusBox = document.getElementById("job-status");
    const btn = document.getElementById("btn-render");

    // 更新日志
    if (job.progress) {
      logBox.innerHTML = job.progress
        .map((line) => {
          let cls = "line";
          if (line.includes("✔") || line.includes("完成") || line.includes("OK")) cls += " ok";
          else if (line.includes("✖") || line.includes("Error") || line.includes("err")) cls += " err";
          else if (line.includes("Truth") || line.includes("知识") || line.includes("→")) cls += " info";
          return `<div class="${cls}">${escapeHtml(line)}</div>`;
        })
        .join("");
      logBox.scrollTop = logBox.scrollHeight;
    }

    // 更新状态
    if (job.status === "completed") {
      statusBox.innerHTML = `<p class="hint" style="color:#3fb950">✅ 渲染完成! (${Math.round((job.completedAt - job.startedAt) / 1000)}s)</p>`;
      btn.disabled = false;
      btn.textContent = "▶ 开始渲染";
      if (pollTimer) clearInterval(pollTimer);

      // 显示输出文件
      showOutputFiles(job);
      // 刷新历史
      loadHistory();
    } else if (job.status === "failed") {
      statusBox.innerHTML = `<p class="hint" style="color:#f85149">✖ 渲染失败 (code: ${job.exitCode})</p>`;
      btn.disabled = false;
      btn.textContent = "▶ 开始渲染";
      if (pollTimer) clearInterval(pollTimer);
    }

  } catch (e) {
    // 忽略轮询错误
  }
}

// ── 显示输出文件 ──
function showOutputFiles(job) {
  const container = document.getElementById("output-files");
  container.innerHTML = "";

  const files = job.outputFiles || [];
  const videoFiles = files.filter((f) => f.endsWith(".mp4"));

  // 如果有视频子目录，从历史记录获取完整列表
  if (videoFiles.length === 0 && job.outputDir) {
    // 从历史记录中查找
    return;
  }

  videoFiles.forEach((f) => {
    const div = document.createElement("div");
    div.className = "file-item";
    const url = `/output/${job.id}/${f}`;
    div.innerHTML = `
      <video src="${url}" controls></video>
      <div class="info">
        <div class="name">${f}</div>
        <a href="${url}" download>📥 下载</a>
        <a href="/kg-viewer.html?job=${job.id}" target="_blank" style="margin-left:8px">🕸 图谱</a>
      </div>
    `;
    container.appendChild(div);
  });
}

// ── HTML 转义 ──
function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
