/**
 * 关键词分析器: 识别文本中的重点词/术语
 *
 * 策略 (多层, 越靠前优先级越高):
 *   1. 大写/专有名词 (Truth Router, API, AI 等)
 *   2. 技术术语库匹配
 *   3. 长度 > 4 的中文词
 *   4. LLM 辅助识别 (可选)
 */

/**
 * 技术术语库
 */
export const TECH_TERMS = new Set([
  "truth", "router", "api", "ai", "llm", "rag", "gpt",
  "algorithm", "neural", "network", "knowledge", "graph",
  "database", "validation", "verification", "inference",
  "embedding", "transformer", "attention", "token",
  "pipeline", "workflow", "orchestrator", "microservice",
  "大模型", "幻觉", "知识图谱", "验证器", "神经网络",
  "机器学习", "深度学习", "算法", "数据", "模型",
  "推理", "训练", "预测", "分类", "识别",
]);

/**
 * 判断是否为技术/重点词
 *
 * @param {string} word - 单个词
 * @param {number} index - 词在场景中的位置
 * @param {string[]} allWords - 场景中所有词
 * @returns {string} "key" | "normal"
 */
function classifyWord(word, index, allWords) {
  const clean = word.replace(/[.,!?;:。，！？、]/g, "").toLowerCase();

  // 规则 1: 技术术语库命中
  if (TECH_TERMS.has(clean) || TECH_TERMS.has(word)) {
    return "key";
  }

  // 规则 2: 首字母大写英文词 (专有名词)
  if (/^[A-Z][a-z]{2,}/.test(word)) {
    return "key";
  }

  // 规则 3: 全大写缩写 (API, AI, LLM)
  if (/^[A-Z]{2,}$/.test(clean)) {
    return "key";
  }

  // 规则 4: 中文词长度 ≥ 4
  if (/[\u4e00-\u9fff]/.test(word) && word.length >= 4) {
    return "key";
  }

  // 规则 5: 数字相关 (v6, 1.0 等)
  if (/^[a-zA-Z]*\d+/.test(clean)) {
    return "key";
  }

  return "normal";
}

/**
 * 分析所有场景, 为每个词标记重要性
 *
 * @param {Array<{title:string, body:string}>} scenes
 * @param {Array<{word:string, start:number, end:number, sceneIndex:number}>} alignedWords
 * @returns {Array<{word, start, end, sceneIndex, importance}>}
 */
export function analyzeKeywords(scenes, alignedWords) {
  return alignedWords.map((w) => {
    const scene = scenes[w.sceneIndex];
    const sceneText = (scene.title + " " + (scene.body || "")).toLowerCase();

    // 找到这个词在场景中的所有同位置词
    const sceneWords = sceneText.split(/\s+/).filter(Boolean);
    const importances = w.word
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => classifyWord(part, 0, sceneWords));

    // 取最高优先级
    const importance = importances.includes("key") ? "key" : "normal";

    return {
      ...w,
      importance,
    };
  });
}
