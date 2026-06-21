/**
 * Truth Extractor — 从场景文本中提取事实声明
 *
 * 自动从 Markdown 内容中提取"事实"并注册到知识图谱:
 *   - "X 是 Y" → 关系 (X, is_a, Y)
 *   - "X 可以 Y" → 能力 (X, can, Y)
 *   - 专有名词 → 概念
 *
 * 每次渲染后知识图谱自动增长。
 */

import { getKG } from "./kg.js";

/**
 * 英语停用词 — 这些词即使在句首大写也不作为专有名词提取
 * 避免 "This", "Called", "Hello" 等噪音污染知识图谱
 */
const STOP_WORDS = new Set([
  "this", "that", "these", "those", "the", "a", "an",
  "called", "known", "named", "like",
  "hello", "hi", "hey", "welcome",
  "code", "file", "line", "text", "word", "name",
  "use", "uses", "used", "using",
  "support", "supports", "supported", "supporting",
  "enable", "enables", "enabled", "enabling",
  "key", "keys", "main", "major", "core",
  "new", "old", "big", "small", "large", "real",
  "fact", "facts", "feature", "features",
  "concept", "concepts", "idea", "ideas",
  "example", "examples", "type", "types",
  "part", "parts", "step", "steps",
  "technical", "technical",
  "system", "solution", "solutions",
  "method", "methods", "approach", "approaches",
  "way", "ways", "case", "cases",
  "important", "important", "common",
  "simple", "complex", "basic", "advanced",
  "first", "second", "third", "next", "last", "final",
  "start", "end", "begin", "finish",
  "one", "two", "three", "four", "five",
  "best", "worst", "better", "worse",
  "need", "needs", "needed",
  "help", "helps", "helpful",
  "work", "works", "working",
  "learn", "learns", "learning",
  "build", "builds", "building",
  "create", "creates", "creating", "created",
  "design", "designs", "designing", "designed",
  "improve", "improves", "improving", "improved",
  "different", "various", "multiple", "many",
  "also", "just", "very", "much", "even",
  "here", "there", "where", "what", "which",
  "another", "other", "others",
  "well", "good", "great", "ok", "yes",
  "let", "lets", "lets", "allow", "allows", "allowed",
  "could", "would", "should", "might", "must",
  "every", "each", "both", "all",
  "some", "any", "no", "not", "none",
  "about", "above", "after", "again", "against",
  "during", "within", "without", "through",
  "into", "onto", "upon", "over", "under",
  "between", "among", "before", "behind",
  // 中英文混合内容中常见但无意义的词
  "com", "www", "http", "https", "html", "css", "js", "ts",
  "md", "txt", "json", "xml", "yaml", "yml", "toml",
]);

/**
 * 判断一个词是否为无意义的通用词
 */
function isStopWord(word) {
  return STOP_WORDS.has(word.toLowerCase().trim());
}

/**
 * 从场景文本中提取并学习事实
 *
 * @param {Array<{title:string, body:string, index:number}>} scenes
 * @param {string} sourceFile - 源文件名
 */
export function learnFromScenes(scenes, sourceFile = "") {
  const kg = getKG();

  for (const scene of scenes) {
    const text = scene.title + " " + (scene.body || "");

    // 提取专有名词 (大写开头词) — 排除停用词
    const properNouns = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
    for (const pn of properNouns) {
      if (isStopWord(pn)) continue;
      const existing = kg.lookup(pn);
      if (!existing || existing.status === "unknown") {
        kg.learn(pn, "verified", `${pn} 是本文涉及的概念`, sourceFile, 0.5);
      }
    }

    // 提取技术缩写 (全大写 2-5 字符) — 排除停用词
    const acronyms = text.match(/\b[A-Z]{2,5}\b/g) || [];
    for (const ac of acronyms) {
      if (isStopWord(ac)) continue;
      const existing = kg.lookup(ac);
      if (!existing) {
        kg.learn(ac, "questionable", `${ac} 是缩写, 需要确认全称`, sourceFile, 0.3);
      }
    }

    // "X 是 Y" / "X 称为 Y" 模式 → 关系
    const isRelations = text.match(/([A-Za-z\u4e00-\u9fff]+)\s+(是|称为|叫|means?|is|are)\s+([A-Za-z\u4e00-\u9fff]+)/g);
    if (isRelations) {
      for (const rel of isRelations) {
        const parts = rel.split(/\s+(是|称为|叫|means?|is|are)\s+/);
        if (parts.length >= 2) {
          kg.addRelation(parts[0].trim(), parts[parts.length - 1].trim(), "is_a");
        }
      }
    }

    // "X 可以 Y" / "X 用于 Y" 模式 → 能力关系
    const canRelations = text.match(/([A-Za-z\u4e00-\u9fff]+)\s+(可以|用于|支持|supports?|enables?|uses?)\s+([A-Za-z\u4e00-\u9fff]+)/g);
    if (canRelations) {
      for (const rel of canRelations) {
        const parts = rel.split(/\s+(可以|用于|支持|supports?|enables?|uses?)\s+/);
        if (parts.length >= 2) {
          kg.addRelation(parts[0].trim(), parts[parts.length - 1].trim(), "capability");
        }
      }
    }
  }

  kg._save();
  return kg.stats();
}
