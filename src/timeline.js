import { execSync } from "child_process";
import path from "path";

/**
 * 时间轴: 为每个场景分配起止时间
 *
 * 核心思路:
 *   测量每个音频文件的时长 → 建立场景时间线
 */

/**
 * 获取音频文件时长 (秒)
 */
function getDuration(audioFile) {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioFile}"`,
      { encoding: "utf8", timeout: 5_000 }
    );
    return parseFloat(out.trim()) || 3;
  } catch {
    return 3; // fallback
  }
}

/**
 * 构建时间轴
 *
 * @param {string[]} audioFiles - 音频文件路径列表
 * @param {Array<{title:string, body:string}>} scenes
 * @param {number} minDuration - 每场最少停留秒数
 * @returns {Array<{index, title, body, audioFile, startSec, endSec, duration}>}
 */
export function buildTimeline(audioFiles, scenes, minDuration = 3) {
  let cursor = 0;
  const timeline = [];

  for (let i = 0; i < scenes.length; i++) {
    const audioFile = audioFiles[i];
    let dur = getDuration(audioFile);
    if (dur < minDuration) dur = minDuration;

    timeline.push({
      index: i,
      title: scenes[i].title,
      body: scenes[i].body,
      audioFile,
      startSec: cursor,
      endSec: cursor + dur,
      duration: dur,
    });
    cursor += dur;
  }

  return timeline;
}

/**
 * 格式化时间轴为可读字符串
 */
export function formatTimeline(timeline) {
  const pad = (n) => String(Math.floor(n)).padStart(2, "0");
  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${pad(m)}:${pad(sec).replace(".", ":")}`;
  };

  return timeline
    .map(
      (t) =>
        `  ${fmt(t.startSec)} → ${fmt(t.endSec)}  [${t.duration.toFixed(1)}s]  ${t.title}`
    )
    .join("\n");
}
