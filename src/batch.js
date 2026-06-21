/**
 * 批量渲染引擎
 *
 * 遍历目录下所有 .md 文件, 逐个渲染为教学视频
 * 支持: 并行控制、错误隔离、汇总报告
 */

import fs from "fs";
import path from "path";

/**
 * 批量渲染
 *
 * @param {string} dir       - 输入目录
 * @param {string} outDir    - 输出根目录
 * @param {object} options   - 传给 cli 的选项
 * @param {Function} renderFn - 渲染函数 (file, outPath) => Promise
 * @returns {Promise<Array<{file, success, error, elapsed}>>}
 */
export async function batchRender(dir, outDir, options, renderFn) {
  // 发现所有 .md 文件
  const files = discoverMarkdownFiles(dir);

  if (files.length === 0) {
    console.log(`  ⚠ 在 "${dir}" 中未找到 .md 文件`);
    return [];
  }

  console.log(`\n  📦 批量渲染: ${files.length} 个文件\n`);

  // 逐个渲染 (串行避免资源冲突)
  const results = [];
  const startAll = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relPath = path.relative(dir, file);
    const baseName = path.basename(file, ".md");
    const fileOutDir = path.join(outDir, sanitizeFileName(baseName));

    console.log(`  [${i + 1}/${files.length}] ${relPath}`);
    console.log(`       → ${fileOutDir}/`);

    const start = Date.now();
    try {
      await renderFn(file, fileOutDir, options);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      results.push({ file: relPath, success: true, elapsed, output: fileOutDir });
      console.log(`       ✔ ${elapsed}s\n`);
    } catch (e) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      results.push({ file: relPath, success: false, error: e.message, elapsed });
      console.log(`       ✖ ${elapsed}s — ${e.message}\n`);
    }
  }

  // 生成汇总报告
  const totalElapsed = ((Date.now() - startAll) / 1000).toFixed(1);
  generateBatchReport(results, outDir, totalElapsed);

  return results;
}

/**
 * 发现目录下所有 .md 文件
 */
function discoverMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && !e.name.startsWith(".")) {
        walk(full);
      } else if (e.isFile() && e.name.endsWith(".md")) {
        files.push(full);
      }
    }
  }
  walk(dir);
  return files.sort();
}

/**
 * 文件名清理
 */
function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "_").slice(0, 60);
}

/**
 * 生成 HTML 汇总报告
 */
function generateBatchReport(results, outDir, totalElapsed) {
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  const rows = results
    .map((r) => {
      const icon = r.success ? "✅" : "❌";
      const extra = r.success ? `<a href="${path.basename(r.output)}/video_lecture.mp4">观看</a>` : `✖ ${r.error}`;
      return `<tr><td>${icon}</td><td>${r.file}</td><td>${r.elapsed}s</td><td>${extra}</td></tr>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>批量渲染报告</title>
<style>
body{font-family:sans-serif;background:#111;color:#eee;padding:40px;max-width:800px;margin:auto}
h1{color:#FFD700;font-size:28px}
.stats{display:flex;gap:20px;margin:20px 0}
.stat{background:#1a1a2e;padding:12px 24px;border-radius:8px;text-align:center}
.stat-num{font-size:28px;font-weight:bold;color:#FFD700}
.stat-label{font-size:12px;color:#888}
table{width:100%;border-collapse:collapse;margin-top:20px}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #333}
th{color:#888;font-size:12px;text-transform:uppercase}
a{color:#4488FF;text-decoration:none}
.fail{color:#FF4444}
</style></head><body>
<h1>📦 批量渲染报告</h1>
<div class="stats">
  <div class="stat"><div class="stat-num">${results.length}</div><div class="stat-label">总数</div></div>
  <div class="stat"><div class="stat-num">${successCount}</div><div class="stat-label">成功</div></div>
  <div class="stat"><div class="stat-num">${failCount}</div><div class="stat-label">失败</div></div>
  <div class="stat"><div class="stat-num">${totalElapsed}s</div><div class="stat-label">总耗时</div></div>
</div>
<table><tr><th></th><th>文件</th><th>耗时</th><th>结果</th></tr>
${rows}
</table>
</body></html>`;

  const reportPath = path.join(outDir, "index.html");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(reportPath, html, "utf8");
  console.log(`  📊 报告: ${reportPath}`);
}
