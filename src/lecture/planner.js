/**
 * Lecture Planner — 讲课规划器
 *
 * 核心职能:
 *   不是"把文字变视频", 而是"把知识变讲解"
 *
 * 输入: 原始 Scene[]
 * 输出: 带教学策略的 LecturePlan
 *
 * 每个场景获得:
 *   - goal: 教学目的 (引入/解释/深化/总结)
 *   - key_terms: 核心概念列表
 *   - importance: 场景权重 (影响时长分配)
 *   - style: 讲解风格 (叙述/论证/举例)
 */

/**
 * 内置重点词评分规则
 */
const KEYWORD_RULES = [
  // 大写专有名词 (Truth, Router, API...)
  { test: (w) => /^[A-Z][a-z]{2,}$/.test(w),      score: 3 },
  // 全大写缩写 (AI, LLM, RAG...)
  { test: (w) => /^[A-Z]{2,}$/.test(w),             score: 3 },
  // 技术术语长度 6+ (hallucination, verification...)
  { test: (w) => w.length > 6 && /^[a-z]/.test(w),  score: 2 },
  // 带数字的 (v6, GPT-4...)
  { test: (w) => /\d/.test(w),                       score: 2 },
  // 中文长词 ≥ 3字
  { test: (w) => /[\u4e00-\u9fff]/.test(w) && w.length >= 3, score: 2 },
  // 默认
  { test: () => true,                                 score: 1 },
];

/**
 * 提取重点词并评分
 */
function extractKeyTerms(text) {
  if (!text) return [];

  const words = text
    .replace(/[，。！？、；：""''（）【】《》.,!?;:()\[\]{}]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const seen = new Set();
  const terms = [];

  for (const w of words) {
    const key = w.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    for (const rule of KEYWORD_RULES) {
      if (rule.test(w)) {
        if (rule.score >= 2) {
          terms.push({ word: w, score: rule.score });
        }
        break;
      }
    }
  }

  return terms.sort((a, b) => b.score - a.score);
}

/**
 * 判断场景教学目的
 */
function inferGoal(scene) {
  const text = (scene.title + " " + (scene.body || "")).toLowerCase();
  const idx = scene.index;

  if (idx === 0) return { goal: "引入主题", narrative: "hook" };
  if (idx <= 2) return { goal: "解释概念", narrative: "explain" };

  const lastIdx = idx; // 由调用者判断是否为最后一个

  const deepIndicators = ["how", "why", "原理", "机制", "核心", "detail", "deep"];
  const hasDeep = deepIndicators.some((d) => text.includes(d));

  if (hasDeep) return { goal: "深入剖析", narrative: "deep_dive" };

  return { goal: "扩展应用", narrative: "expand" };
}

/**
 * 为所有场景生成讲课计划
 *
 * @param {Array<{title:string, body:string, index:number}>} scenes
 * @returns {Array<{scene, goal, key_terms, importance, narrative}>}
 */
export function planLecture(scenes) {
  const sceneCount = scenes.length;

  return scenes.map((scene, i) => {
    const fullText = scene.title + " " + (scene.body || "");
    const keyTerms = extractKeyTerms(fullText);
    const { goal, narrative } = inferGoal(scene);

    // 最后一个场景自动设为总结
    const finalGoal = i === sceneCount - 1
      ? { goal: "总结回顾", narrative: "summary" }
      : { goal, narrative };

    // 场景 importance: 关键概念场景权重更高
    const importance = keyTerms.length > 0
      ? Math.min(1, 0.5 + keyTerms[0].score * 0.15)
      : 0.5;

    return {
      scene_index: i,
      title: scene.title,
      goal: finalGoal.goal,
      narrative: finalGoal.narrative,
      key_terms: keyTerms,
      importance: importance,
    };
  });
}
