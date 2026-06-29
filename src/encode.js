import { execSync } from "child_process";
import fs from "fs";

/**
 * 最终编码: PNG帧 + 过渡动画 + 文字烧录 + 音频 → MP4
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

  const audioInput = audioFile && fs.existsSync(audioFile) ? ` -i "${audioFile}"` : "";
  const audioMap = audioInput ? "-map 1:a" : "";

  // 默认编码参数
  let videoCodec = "-c:v libx264 -preset medium -crf 23";
  let audioCodec = audioInput ? "-c:a aac -b:a 128k" : "";

  // 始终使用 yuv420p — 安卓播放器兼容 (不支持 yuv444p)
  let vf = "-pix_fmt yuv420p";

  if (qualityOpt) {
    videoCodec = qualityOpt.videoArgs;
    audioCodec = qualityOpt.audioArgs || audioCodec;

    // 提取缩放参数
    const sizeMatch = qualityOpt.sizeArgs?.match(/scale=([^ ]+)/);
    if (sizeMatch) {
      // 缩放 + yuv420p 像素格式转换
      vf = `-vf "scale=${sizeMatch[1]},format=yuv420p"`;
    }

    console.log(`   🎬 ${qualityOpt.quality.width}x${qualityOpt.quality.height} | ${qualityOpt.encoder.codec} | CRF ${qualityOpt.quality.crf}`);
  }

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
