/**
 * 时间对齐器: 将文本均分到场景时长内
 *
 * 核心策略: "时间均分模型"
 *   场景内的每个词平均分配时间片段
 *
 * 后续可升级:
 *   - whisper timestamps (精确)
 *   - karaoke word-level (逐字高亮)
 */

import { tokenize } from "./tokenizer.js";

/**
 * 对齐单个场景的文本到时间轴
 *
 * @param {string} text      - 场景文本 (title + body)
 * @param {number} startTime - 场景开始时间 (秒)
 * @param {number} duration  - 场景时长 (秒)
 * @param {object} [opts]
 * @param {number} [opts.pauseAfterSentence=0.2] - 句末停顿 (秒)
 * @returns {Array<{word:string, start:number, end:number}>}
 */
export function alignWords(text, startTime, duration, opts = {}) {
  const { pauseAfterSentence = 0.2 } = opts;
  const words = tokenize(text);

  if (words.length === 0) {
    return [{ word: "", start: startTime, end: startTime + duration }];
  }

  if (words.length === 1) {
    return [{ word: words[0], start: startTime, end: startTime + duration }];
  }

  // 计算每词时长: 给句末留暂停, 其余均分
  const totalPause = pauseAfterSentence * (words.length - 1);
  const wordDuration = Math.max(0, (duration - totalPause) / words.length);

  const result = [];
  let cursor = startTime;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const end = cursor + wordDuration;

    result.push({
      word: w,
      start: cursor,
      end: end,
    });

    cursor = end + pauseAfterSentence;
  }

  // 修正最后一点溢出
  if (result.length > 0) {
    const last = result[result.length - 1];
    if (last.end > startTime + duration) {
      last.end = startTime + duration;
    }
  }

  return result;
}

/**
 * 对齐所有场景, 构建完整时间轴
 *
 * @param {Array<{title:string, body:string, duration:number}>} scenes
 * @param {object} [opts]
 * @returns {Array<{word:string, start:number, end:number, sceneIndex:number}>}
 */
export function alignAllScenes(scenes, opts = {}) {
  let cursor = 0;
  const allWords = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const text = scene.title + (scene.body ? ". " + scene.body : "");
    const dur = scene.duration || 4;

    const aligned = alignWords(text, cursor, dur, opts);

    aligned.forEach((w) => {
      allWords.push({ ...w, sceneIndex: i });
    });

    cursor += dur;
  }

  return allWords;
}

// ── V2 智能对齐: 重点词占更多时间 ──

import { scoreWord } from "../lecture/highlight.js";

/**
 * 智能对齐: 重点词获得更多展示时间
 *
 * @param {string} text
 * @param {number} startTime
 * @param {number} duration
 * @param {object} [persona] - 人格配置 (含 pacing)
 * @returns {Array<{word:string, start:number, end:number, score:number}>}
 */
export function smartAlignWords(text, startTime, duration, persona = null) {
  const words = tokenize(text);
  if (words.length === 0) return [{ word: "", start: startTime, end: startTime + duration, score: 1 }];

  // 人格驱动的停顿
  const pauseAfterKey = persona?.pacing?.pause_after_keyword ?? 0.15;
  const pauseAfterSentence = persona?.pacing?.pause_after_sentence ?? 0.2;

  // 最小词停留时间 (防止闪烁)
  const MIN_WORD_DURATION = 0.28; // 280ms 最低

  // 计算每个词的分数权重
  const scores = words.map(scoreWord);
  const totalScore = scores.reduce((a, b) => a + b, 0);

  // 第一轮: 按比例分配. 第二轮: 拉升低于最小值的词
  const rawSlices = words.map((_, i) => (scores[i] / totalScore) * duration);
  
  // 找出低于最小值的词, 把差额从高分词里扣
  let deficit = 0;
  const adjusted = rawSlices.map((s) => {
    if (s < MIN_WORD_DURATION) {
      deficit += MIN_WORD_DURATION - s;
      return MIN_WORD_DURATION;
    }
    return s;
  });

  // 从高分词按比例扣除 deficit
  if (deficit > 0) {
    const aboveMin = adjusted.map((s, i) => ({ s, i })).filter((x) => x.s > MIN_WORD_DURATION);
    const totalAbove = aboveMin.reduce((a, x) => a + x.s, 0);
    for (const { i } of aboveMin) {
      const ratio = adjusted[i] / totalAbove;
      adjusted[i] -= deficit * ratio;
      if (adjusted[i] < MIN_WORD_DURATION) adjusted[i] = MIN_WORD_DURATION;
    }
  }

  const result = [];
  let cursor = startTime;

  // 计算总可用时间 (减去所有停顿)
  const totalPauseTime = words.length * (pauseAfterSentence);
  const availableForWords = Math.max(duration - totalPauseTime, duration * 0.7);
  
  // 按调整后的比例再缩放一次, 确保不超过可用时间
  const adjustedTotal = adjusted.reduce((a, b) => a + b, 0);
  const scaleFactor = adjustedTotal > 0 ? availableForWords / adjustedTotal : 1;
  
  // 如果超出太多, 减少停顿时间
  const pauseScale = Math.min(1, availableForWords / Math.max(1, adjustedTotal));
  const actualPause = pauseAfterSentence * pauseScale;
  const actualPauseKey = pauseAfterKey * pauseScale;

  for (let i = 0; i < words.length; i++) {
    const slice = adjusted[i] * scaleFactor;
    const end = cursor + slice;

    result.push({
      word: words[i],
      start: cursor,
      end: Math.min(end, startTime + duration),
      score: scores[i],
    });

    const pause = scores[i] >= 3 ? actualPauseKey : actualPause;
    cursor = end + pause;
  }

  // 最终修正: 确保不超出
  if (result.length > 0) {
    const last = result[result.length - 1];
    if (last.end > startTime + duration || last.start >= last.end) {
      last.end = Math.min(startTime + duration, last.start + 0.3);
    }
  }

  return result;
}

/**
 * 智能对齐所有场景 (接受人格参数)
 */
export function smartAlignAllScenes(scenes, persona = null) {
  let cursor = 0;
  const allWords = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const text = scene.title + (scene.body ? ". " + scene.body : "");
    const dur = scene.duration || 4;

    const aligned = smartAlignWords(text, cursor, dur, persona);

    aligned.forEach((w) => {
      allWords.push({ ...w, sceneIndex: i });
    });

    cursor += dur;
  }

  return allWords;
}
