/**
 * Truth Correction — 纠错覆盖层
 *
 * 当场景包含错误事实时, 生成纠错画面:
 *   - 红框标注错误区域
 *   - 底部显示 "事实核查" 弹窗
 *   - 严重错误时生成替换帧
 */

import fs from "fs";

/**
 * 生成纠错覆盖层 HTML
 *
 * @param {string} sceneTitle - 场景标题
 * @param {Array} errors - [{word, explanation}]
 * @param {string} outPath - 输出 HTML 路径
 */
export function renderCorrectionOverlay(sceneTitle, errors, outPath) {
  const errorItems = errors
    .map(
      (e) =>
        `<div class="error-item">
          <span class="error-word">✗ ${e.word}</span>
          <span class="error-desc">${e.explanation || "事实待验证"}</span>
        </div>`
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{margin:0;background:#0b0b0b;overflow:hidden;width:1280px;height:720px;font-family:sans-serif;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:60px}
@font-face{font-family:'WenQuanYi Zen Hei';src:url('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc') format('truetype')}
h1{color:#ff4444;font-size:36px;font-weight:bold;font-family:'WenQuanYi Zen Hei',sans-serif;margin-bottom:30px}
.error-item{background:#1a0000;border:1px solid #ff4444;border-radius:8px;padding:12px 20px;margin:8px 0;width:80%;display:flex;justify-content:space-between;align-items:center}
.error-word{color:#ff6666;font-size:20px;font-weight:bold;font-family:'WenQuanYi Zen Hei',sans-serif}
.error-desc{color:#ffaaaa;font-size:16px;font-family:'WenQuanYi Zen Hei',sans-serif}
.badge{position:absolute;top:20px;right:30px;background:#ff4444;color:white;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:bold;font-family:'WenQuanYi Zen Hei',sans-serif}
</style></head><body>
<div class="badge">🔍 事实核查</div>
<h1>⚠ 内容需注意</h1>
${errorItems}
</body></html>`;

  fs.writeFileSync(outPath, html, "utf8");
}

/**
 * 生成纠错帧 (替换有问题的场景帧)
 *
 * @param {Array} errors - 当前场景的错误 [{word, explanation}]
 * @param {string} title - 场景标题
 * @returns {string} HTML 内容
 */
export function generateCorrectionFrame(title, errors) {
  const errorItems = errors
    .map(
      (e) =>
        `<div class="ei"><span class="ew">✗ ${e.word}</span><span class="ed">${e.explanation || ""}</span></div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{margin:0;background:#1a0000;overflow:hidden;width:1280px;height:720px;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:'WenQuanYi Zen Hei',sans-serif;padding:40px}
h1{color:#ff6666;font-size:32px;margin-bottom:20px}
.ei{background:#2a0000;border:1px solid #ff4444;border-radius:6px;padding:10px 16px;margin:6px;width:70%;display:flex;justify-content:space-between}
.ew{color:#ff8888;font-size:18px;font-weight:bold}
.ed{color:#ffaaaa;font-size:14px}
.badge{position:absolute;top:20px;right:30px;background:#ff4444;color:white;padding:4px 12px;border-radius:16px;font-size:13px}
</style></head><body>
<div class="badge">🔍 事实核查</div>
<h1>${title}</h1>
${errorItems}
</body></html>`;
}
