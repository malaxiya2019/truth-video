/**
 * 图谱帧截图 v2 — 跨平台版 (Termux + GitHub Actions + Desktop)
 *
 * 自动检测运行环境，选择正确的浏览器引擎：
 * - Termux/Android → puppeteer-core + 系统 Chromium
 * - 其他 (CI/桌面) → Playwright (已安装的 Chromium)
 *
 * 捕获所有帧 (场景帧 + 过渡帧) 为 PNG 序列
 * 输出 concat 文件供 ffmpeg 使用 (每帧指定时长)
 */

import fs from "fs";
import path from "path";
import os from "os";

/**
 * 检测是否运行在 Termux 环境
 */
function isTermux() {
  return os.platform() === "android" ||
    fs.existsSync("/data/data/com.termux") ||
    process.env.TERMUX_VERSION !== undefined;
}

/**
 * 根据环境选择合适的 browser launcher
 */
async function launchBrowser(viewportW, viewportH, scaleFactor) {
  if (isTermux()) {
    // Termux: 使用 puppeteer-core + 系统 Chromium
    const puppeteer = await import("puppeteer-core");
    const CHROMIUM_PATH = "/data/data/com.termux/files/usr/bin/chromium-browser";
    console.log("  📱 Termux 模式: puppeteer-core");
    const browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: viewportW, height: viewportH });
    return { browser, page };
  } else {
    // 桌面/CI: 使用 Playwright
    const { chromium } = await import("playwright");
    console.log("  🖥  Playwright 模式");
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: viewportW, height: viewportH },
      deviceScaleFactor: scaleFactor,
    });
    const page = await context.newPage();
    return { browser, page };
  }
}

/**
 * 截取帧序列
 *
 * @param {Array<{html:string, duration:number}>} frameMetas
 * @param {string} outDir
 * @param {number} viewportW
 * @param {number} viewportH
 * @param {number} scaleFactor
 * @returns {{frames:string[], concatFile:string}}
 */
export async function captureFrameSequence(
  frameMetas, outDir = "renders",
  viewportW = 1280, viewportH = 720, scaleFactor = 1
) {
  fs.mkdirSync(outDir, { recursive: true });

  const { browser, page } = await launchBrowser(viewportW, viewportH, scaleFactor);

  // 先把所有 HTML 写入临时文件
  const htmlDir = `${outDir}_html`;
  fs.mkdirSync(htmlDir, { recursive: true });

  const concatLines = [];
  const files = [];

  for (let i = 0; i < frameMetas.length; i++) {
    const meta = frameMetas[i];
    const htmlFile = path.join(htmlDir, `frame_${String(i).padStart(5, "0")}.html`);
    fs.writeFileSync(htmlFile, meta.html, "utf8");

    await page.goto("file://" + path.resolve(htmlFile), { waitUntil: "load" });
    await new Promise(r => setTimeout(r, 80)); // 渲染稳定

    const pngFile = path.join(outDir, `frame_${String(i).padStart(5, "0")}.png`);
    await page.screenshot({ path: pngFile });

    // 计算 ffmpeg concat 时长
    const durationUs = Math.round(meta.duration * 1_000_000);
    concatLines.push(`file '${path.resolve(pngFile)}'`);
    concatLines.push(`duration ${meta.duration.toFixed(4)}`);
    files.push(pngFile);
  }

  await browser.close();

  // 清理临时 HTML
  try { fs.rmSync(htmlDir, { recursive: true, force: true }); } catch {}

  // 写入 concat file
  const concatFile = path.join(outDir, "concat.txt");
  fs.writeFileSync(concatFile, concatLines.join("\n"), "utf8");

  return { frames: files, concatFile };
}

/**
 * 兼容旧 API: 仅截取场景帧
 */
export async function captureGraphFrames(count, outDir = "renders") {
  const { browser, page } = await launchBrowser(1280, 720, 1);
  const files = [];

  for (let i = 0; i < count; i++) {
    const htmlFile = path.resolve(`output/graph_frame_${i}.html`);
    if (!fs.existsSync(htmlFile)) continue;
    await page.goto("file://" + htmlFile, { waitUntil: "load" });
    await new Promise(r => setTimeout(r, 300));
    const pngFile = path.join(outDir, `frame_${String(i).padStart(3, "0")}.png`);
    await page.screenshot({ path: pngFile });
    files.push(pngFile);
  }

  await browser.close();
  return files;
}
