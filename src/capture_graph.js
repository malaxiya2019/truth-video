/**
 * 图谱帧截图 v2 — Termux 版
 *
 * 使用系统 Chromium (puppeteer-core) 代替 Playwright
 * Playwright 不支持 Android/Termux 平台
 *
 * 捕获所有帧 (场景帧 + 过渡帧) 为 PNG 序列
 * 输出 concat 文件供 ffmpeg 使用 (每帧指定时长)
 */

import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const CHROMIUM_PATH = "/data/data/com.termux/files/usr/bin/chromium-browser";

/**
 * 截取帧序列
 *
 * @param {Array} frameMetas - [{html:string, type:string, sceneIndex:number, duration:number}]
 * @param {string} outDir - renders/
 * @param {number} viewportW
 * @param {number} viewportH
 * @param {number} [scaleFactor] - 设备缩放 (1=标准, 2=Retina)
 * @returns {{frames:string[], concatFile:string}}
 */
export async function captureFrameSequence(
  frameMetas, outDir = "renders",
  viewportW = 1280, viewportH = 720, scaleFactor = 1
) {
  fs.mkdirSync(outDir, { recursive: true });

  console.log("  🚀 Launching Chromium (puppeteer-core)...");
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

  // 先把所有 HTML 写入临时文件
  const htmlDir = `${outDir}_html`;
  fs.mkdirSync(htmlDir, { recursive: true });

  const pngFiles = [];
  const concatLines = [];

  for (let i = 0; i < frameMetas.length; i++) {
    const meta = frameMetas[i];
    const htmlFile = path.join(htmlDir, `frame_${String(i).padStart(5, "0")}.html`);
    fs.writeFileSync(htmlFile, meta.html, "utf8");

    await page.goto("file://" + path.resolve(htmlFile), { waitUntil: "load" });
    await new Promise(r => setTimeout(r, 80)); // 渲染稳定

    const pngFile = path.join(outDir, `frame_${String(i).padStart(5, "0")}.png`);
    await page.screenshot({ path: pngFile });

    // 计算 ffmpeg concat 时长 (秒)
    const durationUs = Math.round(meta.duration * 1_000_000);
    concatLines.push(`file '${path.resolve(pngFile)}'`);
    concatLines.push(`duration ${meta.duration.toFixed(4)}`);

    pngFiles.push(pngFile);

    if ((i + 1) % 20 === 0 || i === frameMetas.length - 1) {
      const type = meta.type === "scene" ? "📖" : "➡️";
      console.log(`  [${i + 1}/${frameMetas.length}] ${type} ${meta.type} (scene ${meta.sceneIndex}) ${meta.duration.toFixed(2)}s`);
    }
  }

  // 写 concat 文件
  const concatFile = path.join(outDir, "concat.txt");
  fs.writeFileSync(concatFile, concatLines.join("\n") + "\n", "utf8");

  await browser.close();

  // 清理临时 HTML
  try { fs.rmSync(htmlDir, { recursive: true }); } catch {}

  console.log(`  ✔ ${frameMetas.length} frames → ${outDir}/`);
  return { frames: pngFiles, concatFile };
}

/**
 * 兼容旧 API: 仅截取场景帧
 */
export async function captureGraphFrames(count, outDir = "renders") {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const files = [];

  for (let i = 0; i < count; i++) {
    const htmlFile = path.resolve(`output/graph_frame_${i}.html`);
    if (!fs.existsSync(htmlFile)) continue;
    await page.goto("file://" + htmlFile, { waitUntil: "load" });
    await new Promise(r => setTimeout(r, 300));
    const pngFile = path.join(outDir, `frame_${String(i).padStart(3, "0")}.png`);
    await page.screenshot({ path: pngFile });
    files.push(pngFile);
    console.log(`  [${i + 1}/${count}] ${pngFile} (graph frame)`);
  }

  await browser.close();
  return files;
}
