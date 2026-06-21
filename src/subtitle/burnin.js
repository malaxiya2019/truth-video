/**
 * 字幕烧录模块: 将 .srt/.ass 字幕烧录到视频中
 *
 * 两种模式:
 *   - ffmpeg subtitles filter (嵌入字幕流 + 渲染到画面)
 *   - ASS 直接作为字幕流 (保留样式)
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * 将字幕烧录到视频 (硬编码到画面)
 *
 * 输出视频自带字幕画面, 任何播放器都能看到
 *
 * @param {string} videoPath    - 输入视频 (output/video.mp4)
 * @param {string} subtitlePath - 字幕文件 (output/subtitles.srt/.ass)
 * @param {string} outputPath   - 输出视频 (output/video_sub.mp4)
 */
export function burnSubtitle(videoPath, subtitlePath, outputPath) {
  if (!fs.existsSync(videoPath)) {
    console.error("Video not found:", videoPath);
    return;
  }
  if (!fs.existsSync(subtitlePath)) {
    console.error("Subtitle not found:", subtitlePath);
    return;
  }

  const ext = path.extname(subtitlePath).toLowerCase();

  // ASS 直接用 / .srt 需要转义路径中的特殊字符
  const subArg = ext === ".ass"
    ? `ass='${subtitlePath}'`
    : `subtitles='${subtitlePath}'`;

  const cmd =
    `ffmpeg -y -i "${videoPath}" ` +
    `-vf "${subArg}" ` +
    `-c:a copy ` +
    `"${outputPath}"`;

  console.log("  Burning subtitles into video...");
  execSync(cmd, { stdio: "inherit", timeout: 120_000 });
  console.log(`  ✔ ${outputPath}`);
}

/**
 * 向 MP4 中添加字幕流 (软字幕, 可切换)
 *
 * 播放器可开启/关闭字幕
 *
 * @param {string} videoPath
 * @param {string} subtitlePath
 * @param {string} outputPath
 */
export function embedSubtitle(videoPath, subtitlePath, outputPath) {
  if (!fs.existsSync(videoPath) || !fs.existsSync(subtitlePath)) return;

  const ext = path.extname(subtitlePath).toLowerCase();
  const codec = ext === ".ass" ? "ass" : "mov_text";

  try {
    const cmd =
      `ffmpeg -y -i "${videoPath}" -i "${subtitlePath}" ` +
      `-c:v copy -c:a copy -c:s ${codec} -metadata:s:s:0 language=chi ` +
      `"${outputPath}"`;
    console.log("  Embedding subtitle stream...");
    execSync(cmd, { stdio: "ignore", timeout: 30_000 });
    console.log(`  ✔ ${outputPath}`);
  } catch {
    console.log("  (subtitle stream embed skipped — SRT burn-in already done)");
  }
}
