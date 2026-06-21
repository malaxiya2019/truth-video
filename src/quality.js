/**
 * 画质配置 — 分辨率 / 码率 / 编码器选择
 *
 * --quality=draft   快速预览 (854x480, 低码率)
 * --quality=normal  标准 (1280x720) — 默认
 * --quality=high    高画质 (1920x1080, 高码率)
 */

import { execSync } from "child_process";
import fs from "fs";

/**
 * 画质预设
 */
export const QUALITY_PRESETS = {
  draft: {
    label: "草稿",
    width: 854,
    height: 480,
    crf: 28,
    preset: "veryfast",
    audioBitrate: "64k",
    viewportScale: 0.67,  // 相对于 1280
    description: "快速预览, 低分辨率低码率",
  },
  normal: {
    label: "标准",
    width: 1280,
    height: 720,
    crf: 23,
    preset: "medium",
    audioBitrate: "128k",
    viewportScale: 1.0,
    description: "720p, 均衡画质与速度",
  },
  high: {
    label: "高画质",
    width: 1920,
    height: 1080,
    crf: 18,
    preset: "slow",
    audioBitrate: "192k",
    viewportScale: 1.5,   // 相对于 1280
    description: "1080p, 高码率, 适合发布",
  },
};

/**
 * 检测可用的硬件编码器
 */
function detectHardwareEncoder() {
  try {
    const out = execSync("ffmpeg -encoders 2>/dev/null | grep -E '(nvenc|vaapi|qsv)' | head -5", {
      encoding: "utf8", timeout: 5000,
    });
    if (out.includes("nvenc")) return "h264_nvenc";
    if (out.includes("vaapi")) return "h264_vaapi";
    if (out.includes("qsv")) return "h264_qsv";
  } catch {}
  return null;
}

/**
 * 获取编码器配置
 */
export function getEncoder(hwAccel = true) {
  if (hwAccel) {
    const hw = detectHardwareEncoder();
    if (hw) {
      console.log(`   ⚡ GPU 编码器: ${hw}`);
      return { codec: hw, hw: true };
    }
  }
  return { codec: "libx264", hw: false };
}

/**
 * 获取画质配置
 */
export function getQuality(name = "normal") {
  const q = QUALITY_PRESETS[name];
  if (!q) {
    console.warn(`   ⚠ 未知画质 "${name}", 使用 normal`);
    return QUALITY_PRESETS.normal;
  }
  return q;
}

/**
 * 构建 ffmpeg 编码参数
 */
export function buildEncodeArgs(qualityName, audioFile, outFile, hwAccel = true) {
  const quality = getQuality(qualityName);

  // 稳定优先: 始终使用软件编码器
  const videoArgs = `-c:v libx264 -preset ${quality.preset} -crf ${quality.crf}`;
  const audioArgs = audioFile ? `-c:a aac -b:a ${quality.audioBitrate}` : "";
  const sizeArgs = `scale=${quality.width}:${quality.height}:force_original_aspect_ratio=decrease`;

  return { quality, encoder: { codec: "libx264", hw: false }, videoArgs, audioArgs, sizeArgs };
}
