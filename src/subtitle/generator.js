/**
 * 字幕生成器: SRT / ASS 双格式输出
 *
 * SRT — 通用兼容, 所有播放器支持
 * ASS — 高级样式 + Karaoke 逐词高亮
 */

import fs from "fs";
import { scoreWord, getHighlightColor, getDimColor, getTruthColor } from "../lecture/highlight.js";

/**
 * 时间格式化: 秒 → SRT 时间格式 (00:00:00,000)
 */
function fmtSRT(t) {
  const h = String(Math.floor(t / 3600)).padStart(2, "0");
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  const s = t % 60;
  const sec = String(Math.floor(s)).padStart(2, "0");
  const ms = String(Math.floor((s % 1) * 1000)).padStart(3, "0");
  return `${h}:${m}:${sec},${ms}`;
}

/**
 * 时间格式化: 秒 → ASS 时间格式 (0:00:00.00)
 */
function fmtASS(t) {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = (t % 60).toFixed(2);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(5, "0")}`;
}

/**
 * 检测是否包含中文
 */
function hasChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

/**
 * 选择字体
 */
function pickFont(texts) {
  const ZH = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc";
  const EN = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
  const needCN = texts.some((t) => hasChinese(t));
  return needCN && fs.existsSync(ZH) ? ZH : EN;
}

/**
 * 将词按场景分组
 */
function groupByScene(words) {
  const groups = [];
  let cur = [];
  for (const w of words) {
    if (cur.length === 0 || w.sceneIndex === cur[0].sceneIndex) {
      cur.push(w);
    } else {
      groups.push(cur);
      cur = [w];
    }
  }
  if (cur.length > 0) groups.push(cur);
  return groups;
}

/**
 * 将词分组为字幕行 (每行 4-8 个词, 尊重场景边界)
 */
function groupIntoLines(words, maxWordsPerLine = 6) {
  if (words.length === 0) return [];

  const sceneGroups = groupByScene(words);
  const lines = [];

  for (const group of sceneGroups) {
    let buf = [];
    let start = group[0].start;
    for (const w of group) {
      buf.push(w.word);
      if (buf.length >= maxWordsPerLine || w === group[group.length - 1]) {
        lines.push({ text: buf.join(" "), start, end: w.end });
        buf = [];
        start = w.end;
      }
    }
  }
  return lines;
}

// ── SRT ──

export function toSRT(words) {
  const lines = groupIntoLines(words);
  return lines
    .map((l, i) => `${i + 1}\n${fmtSRT(l.start)} --> ${fmtSRT(l.end)}\n${l.text}\n`)
    .join("\n");
}

// ── ASS 基础 (每行一句, 底部居中) ──

export function toASS(words) {
  const lines = groupIntoLines(words);
  const allTexts = lines.map((l) => l.text);
  const fontFile = pickFont(allTexts);
  const fontName = hasChinese(allTexts.join("")) ? "WenQuanYiZenHei" : "DejaVu Sans";

  const header = buildASSHeader(fontName, 28, "&H00FFFFFF");

  const events = lines
    .map((l) => `Dialogue: 0,${fmtASS(l.start)},${fmtASS(l.end)},Default,,0,0,0,,${l.text}`)
    .join("\n");

  return header + events + "\n";
}

// ── Karaoke ASS: 逐词高亮 (YouTube 风格) ──

/**
 * 生成逐词高亮字幕 (Karaoke ASS)
 *
 * 效果: 一行文字从左到右逐词高亮
 *   - 未读词: 白色
 *   - 已读词: 金色 (#FFD700)
 *
 * 原理: ASS \k 标签实现 karaoke 填充
 *   {\k100}词 — 该词持续 100 厘秒 (1秒)
 */
export function toKaraokeASS(words) {
  // 按场景分组, 每个场景一行
  const sceneGroups = groupByScene(words);
  const allTexts = sceneGroups.map((g) => g.map((w) => w.word).join(" "));
  const fontFile = pickFont(allTexts);
  const fontName = hasChinese(allTexts.join("")) ? "WenQuanYiZenHei" : "DejaVu Sans";

  const header = buildASSHeader(fontName, 32, "&H00FFFFFF", true);

  const events = sceneGroups
    .map((group) => {
      const start = fmtASS(group[0].start);
      const end = fmtASS(group[group.length - 1].end);

      // 构建 karaoke 文本: {\kXXX}word
      const karaokeText = group
        .map((w) => {
          const cs = Math.round((w.end - w.start) * 100); // 厘秒
          return `{\\k${cs}}${w.word}`;
        })
        .join(" ");

      return `Dialogue: 0,${start},${end},Karaoke,,0,0,0,,${karaokeText}`;
    })
    .join("\n");

  return header + events + "\n";
}

// ── ASS Header 构建 ──

function buildASSHeader(fontName, fontSize, primaryColor, karaoke = false) {
  const styleName = karaoke ? "Karaoke" : "Default";
  const secondaryColor = karaoke ? "&H00FFD700" : primaryColor; // 金色高亮

  return `[Script Info]
Title: Truth Video Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ${styleName},${fontName},${fontSize},${primaryColor},${secondaryColor},&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,2,2,20,20,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

// ── Intelligent ASS: AI 重点词 + Truth Router 验证 ──

/**
 * 颜色映射:
 *   - key + verified     → 金色 #FFD700  (重点且已验证)
 *   - key + unknown      → 青色 #00FFFF  (重点但未验证)
 *   - error              → 红色 #FF4444  (事实错误)
 *   - normal             → 灰色 #888888  (普通词)
 *
 * 非活跃词统一灰色 #666666
 */
const HIGHLIGHT_COLORS = {
  "key:verified":     "&H00FFD700",
  "key:unknown":      "&H00FFFF00",
  "key:questionable": "&H00FF8800",
  "normal:verified":  "&H00FFD700",
  "normal:unknown":   "&H00888888",
  "normal:questionable": "&H00888888",
  "error":            "&H004444FF",
};

/**
 * 为每个词生成高亮颜色 (基于 importance + verified)
 */
function getWordHighlightColor(word) {
  if (word.verified === "error") return HIGHLIGHT_COLORS.error;
  const key = `${word.importance || "normal"}:${word.verified || "unknown"}`;
  return HIGHLIGHT_COLORS[key] || "&H00888888";
}

/**
 * 构建智能高亮 ASS
 *
 * 每词一个 Dialogue: 显示完整句子, 当前词高亮, 其余变灰
 * 效果: "Truth → Router → improves → ..." 逐词推进
 */
export function toIntelligentASS(words) {
  const phrases = groupIntoPhrases(words, 3);
  if (phrases.length === 0) return "";

  const allTexts = phrases.map((p) => p.words.map((w) => w.word).join(" "));
  const fontFile = pickFont(allTexts);
  const fontName = hasChinese(allTexts.join("")) ? "WenQuanYiZenHei" : "DejaVu Sans";
  const header = buildASSHeader(fontName, 32, "&H00FFFFFF");

  let events = "";
  for (const activePhrase of phrases) {
    const sceneWords = phrases
      .filter((p) => p.sceneIndex === activePhrase.sceneIndex)
      .flatMap((p) => p.words);
    const activeWordSet = new Set(activePhrase.words);
    const textParts = sceneWords.map((w) => {
      if (activeWordSet.has(w)) {
        const color = getWordHighlightColor(w);
        return `{\\c${color}\\b1}${w.word}{\\b0}`;
      }
      return `{\\c&H00666666}${w.word}`;
    });
    events += `Dialogue: 0,${fmtASS(activePhrase.start)},${fmtASS(activePhrase.end)},Default,,0,0,0,,${textParts.join(" ")}\n`;
  }
  return header + events;
}

/**
 * 生成完整字幕报告 (调试用)
 */
export function subtitleReport(words) {
  const lines = words.map((w) => {
    const color = getWordHighlightColor(w);
    return `  ${w.word.padEnd(20)} ${w.start.toFixed(2)}s → ${w.end.toFixed(2)}s  [${w.importance || "normal"}] [${w.verified || "unknown"}]`;
  });
  return lines.join("\n");
}

// ── V2 Lecture ASS: 评分驱动的高亮 ──

/**
 * 将词按短语分组 (2-4词一组, 尊重场景边界)
 * 
 * 替代旧的逐词高亮, 改为短语级高亮
 * 效果: 整组词同时高亮 + 停留, 视觉更稳定
 */
function groupIntoPhrases(words, maxPhraseWords = 3) {
  if (words.length === 0) return [];

  // 按场景分组
  const sceneGroups = [];
  let cur = [];
  for (const w of words) {
    if (cur.length === 0 || w.sceneIndex === cur[0].sceneIndex) {
      cur.push(w);
    } else {
      sceneGroups.push(cur);
      cur = [w];
    }
  }
  if (cur.length > 0) sceneGroups.push(cur);

  const phrases = [];

  for (const group of sceneGroups) {
    let phrase = [];
    for (const w of group) {
      phrase.push(w);
      if (phrase.length >= maxPhraseWords || w === group[group.length - 1]) {
        phrases.push({
          words: phrase,
          start: phrase[0].start,
          end: phrase[phrase.length - 1].end,
          sceneIndex: group[0].sceneIndex,
          // 取短语内最高分作为短语的代表分数
          score: Math.max(...phrase.map((pw) => pw.score || 1)),
          verified: phrase.some((pw) => pw.verified === "error") ? "error"
                 : phrase.some((pw) => pw.verified === "verified") ? "verified"
                 : "unknown",
        });
        phrase = [];
      }
    }
  }

  return phrases;
}

/**
 * 生成讲课级 ASS 字幕 (短语级高亮, 防闪烁)
 *
 * 每个短语一个 Dialogue, 一整个短语同时高亮
 * 同一短语内的词一起亮起, 一起变灰
 * 效果: 不再逐词闪烁, 而是词组节奏
 */
export function toLectureASS(words, persona = null) {
  const phrases = groupIntoPhrases(words, 3);

  if (phrases.length === 0) return "";

  const allTexts = phrases.map((p) => p.words.map((w) => w.word).join(" "));
  const fontFile = pickFont(allTexts);
  const fontName = hasChinese(allTexts.join("")) ? "WenQuanYiZenHei" : "DejaVu Sans";

  const subStyle = persona?.subtitle || {};
  const fontSize = subStyle.font_size || 34;
  const primaryColor = subStyle.font_color || "&H00FFFFFF";
  const activeOveride = subStyle.active_color || null;
  const dimOveride = subStyle.dim_color || null;

  const header = buildASSHeader(fontName, fontSize, primaryColor);
  let events = "";

  for (const activePhrase of phrases) {
    // 当前短语内的词: 高亮色
    // 短语外的词: 灰色
    // 同一场景的所有词
    const sceneWords = phrases
      .filter((p) => p.sceneIndex === activePhrase.sceneIndex)
      .flatMap((p) => p.words);

    // 计算短语内最高分来决定高亮色
    const phraseScore = Math.max(...activePhrase.words.map((w) => w.score || 1));
    let activeColor = activeOveride;
    if (!activeColor) activeColor = getTruthColor(activePhrase.verified);
    if (!activeColor) activeColor = getHighlightColor(phraseScore);
    const dimColor = dimOveride || "&H00666666";

    // 构建句子: 当前短语内的词金色高亮, 其余灰色
    const activeWordSet = new Set(activePhrase.words);
    const textParts = sceneWords.map((w) => {
      if (activeWordSet.has(w)) {
        return `{\\c${activeColor}\\b1}${w.word}{\\b0}`;
      }
      return `{\\c${dimColor}}${w.word}`;
    });

    events += `Dialogue: 0,${fmtASS(activePhrase.start)},${fmtASS(activePhrase.end)},Default,,0,0,0,,${textParts.join(" ")}\n`;
  }

  return header + events;
}
