import { execSync } from "child_process";
import fs from "fs";

/**
 * 最终编码: PNG帧 + 过渡动画 + 文字烧录 + 音频 → MP4
 *
 * 核心改进 (V0.5+):
 *   - 每帧按场景时长独立延展 (不再是固定 1fps)
 *   - fade in/out 过渡动画 (0.5s 淡入淡出)
 *   - drawtext 文字烧录 (中文文泉驿, 英文 DejaVu)
 *   - 音频混音
 *
 * 注意: 旧版 encodeVideo / encodeVideoSilent / mergeAudio 已移除，
 *       统一使用 encodeFromConcat（帧序列 concat 文件 + 画质选项）。
 */

/**
 * 从帧序列 concat 文件编码视频 (带画质选项)
 *
 * @param {string} concatFile
 * @param {string} audioFile
 * @param {string} outFile
 * @param {object} [qualityOpt] - {quality, encoder, videoArgs, audioArgs, sizeArgs}
 */
export function encodeFromConcat(concatFile, audioFile, outFile = "output/video.mp4", qualityOpt = null) {
  if (!fs.existsSync(concatFile)) {
    throw new Error(`Concat file not found: ${concatFile}`);
  }

  const audioInput = audioFile && fs.existsSync(audioFile) ? `-i "${audioFile}"` : "";
  const audioMap = audioInput ? "-map 1:a" : "";

  // 使用画质配置或默认
  let videoCodec = "-c:v libx264 -preset medium -crf 23";
  let audioCodec = audioInput ? "-c:a aac -b:a 128k" : "";
  let scaleFilter = "";
  let pixelFmt = "-pix_fmt yuv420p";

  if (qualityOpt) {
    videoCodec = qualityOpt.videoArgs;
    audioCodec = qualityOpt.audioArgs || audioCodec;
    // sizeArgs 已经是完整 -vf 字符串, 需要提取 scale= 部分
    const sizeMatch = qualityOpt.sizeArgs?.match(/scale=([^ ]+)/);
    if (sizeMatch) scaleFilter = `scale=${sizeMatch[1]}`;
    if (qualityOpt.encoder?.hw) pixelFmt = "";
    console.log(`   🎬 ${qualityOpt.quality.width}x${qualityOpt.quality.height} | ${qualityOpt.encoder.codec} | CRF ${qualityOpt.quality.crf}`);
  }

  // 简单缩放, 不 pad (NVENC 兼容)
  const vf = scaleFilter ? `-vf "${scaleFilter}"` : pixelFmt;

  const cmd =
    `ffmpeg -y -f concat -safe 0 -i "${concatFile}" ${audioInput} ` +
    `-map 0:v ${audioMap} ` +
    `${videoCodec} ${vf} -r 30 ` +
    `${audioCodec} ` +
    `-shortest ` +
    `"${outFile}"`;

  console.log("  Encoding...");
  execSync(cmd, { stdio: "inherit", timeout: 600_000 });

  console.log(`  ✔ ${outFile}`);
}
