/**
 * Highlight Scorer — 重点评分系统
 *
 * 为每个词计算"讲解重要性分数", 决定:
 *   - 高亮颜色 (金/青/白/灰)
 *   - 时间分配 (重点词停留更长)
 *   - 视觉权重 (粗体/大小)
 *
 * 评分维度:
 *   3 = 强高亮 (核心概念, 专有名词)
 *   2 = 高亮   (技术术语)
 *   1 = 普通   (填充词)
 */

/**
 * 评分规则 (与 planner.js 共享)
 */
const SCORE_RULES = [
  { test: (w) => /^[A-Z][a-z]{2,}$/.test(w),              score: 3 },
  { test: (w) => /^[A-Z]{2,}$/.test(w),                    score: 3 },
  { test: (w) => /[\u4e00-\u9fff]/.test(w) && w.length >= 4, score: 3 },
  { test: (w) => /\d/.test(w),                              score: 2 },
  { test: (w) => w.length > 6,                              score: 2 },
  { test: (w) => w.length > 4,                              score: 2 },
  { test: () => true,                                       score: 1 },
];

/**
 * 对单个词评分
 *
 * @param {string} word
 * @returns {number} 1-3
 */
export function scoreWord(word) {
  const clean = word.replace(/[.,!?;:。，！？、()（）]/g, "");
  if (!clean) return 1;

  for (const rule of SCORE_RULES) {
    if (rule.test(clean)) return rule.score;
  }
  return 1;
}

/**
 * 批量评分
 *
 * @param {string[]} words
 * @returns {number[]}
 */
export function scoreAll(words) {
  return words.map(scoreWord);
}

/**
 * 获取高亮颜色 (基于分数)
 *
 * score 3 → 金色 (#FFD700) 核心概念
 * score 2 → 青色 (#00FFFF) 技术术语
 * score 1 → 白色 (#FFFFFF) 普通
 */
export function getHighlightColor(score) {
  switch (score) {
    case 3: return "&H00FFD700";  // 金
    case 2: return "&H00FFFF00";  // 青
    default: return "&H00FFFFFF"; // 白
  }
}

/**
 * 获取灰化颜色 (非活跃词)
 *
 * score 3 → 深灰 (#666666)
 * score 2 → 深灰 (#666666)
 * score 1 → 浅灰 (#888888)
 */
export function getDimColor(score) {
  return score >= 2 ? "&H00666666" : "&H00888888";
}

/**
 * 获取 Truth Router 修正颜色
 */
export function getTruthColor(verified) {
  switch (verified) {
    case "error":         return "&H004444FF";  // 红
    case "questionable":  return "&H00FF8800";  // 橙
    case "verified":      return "&H0000FF88";  // 绿
    default:              return null;           // 不覆盖
  }
}
