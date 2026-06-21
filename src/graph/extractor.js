/**
 * 知识图谱提取器: 从文本中提取实体和关系
 *
 * 策略:
 *   1. 专有名词识别 (大写/缩写)
 *   2. 技术术语匹配
 *   3. 中文概念提取
 *   4. 关系推断 (动词连接)
 */

import { TECH_TERMS } from "../subtitle/keywords.js";

/**
 * 规则: 词 → 实体类型
 */
const ENTITY_TYPES = {
  // 系统/框架名
  "truth": "system", "router": "system",
  "truth router": "system",

  // 问题
  "hallucination": "problem", "幻觉": "problem",
  "error": "problem", "错误": "problem",

  // 解决方案
  "knowledge graph": "solution", "知识图谱": "solution",
  "verification": "solution", "验证": "solution",
  "rag": "solution",

  // 概念
  "llm": "concept", "ai": "concept", "大模型": "concept",
  "reliability": "concept", "可靠性": "concept",

  // 能力
  "validation": "capability", "验证器": "capability",
  "detection": "capability",
};

/**
 * 提取实体
 *
 * @param {string} text
 * @returns {Array<{word:string, type:string, confidence:number}>}
 */
export function extractEntities(text) {
  if (!text) return [];

  const cleaned = text.replace(/[，。！？、；：""''（）【】《》.,!?;:()\[\]{}]/g, " ");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const seen = new Set();
  const entities = [];

  for (const w of words) {
    const key = w.toLowerCase();
    if (seen.has(key)) continue;

    // 多词匹配 (先检查 bigram)
    seen.add(key);

    // 判断类型
    let type = null;
    let confidence = 0;

    if (ENTITY_TYPES[key]) {
      type = ENTITY_TYPES[key];
      confidence = 0.9;
    } else if (/^[A-Z][a-z]{2,}$/.test(w)) {
      type = "concept";
      confidence = 0.7;
    } else if (/^[A-Z]{2,}$/.test(w)) {
      type = "concept";
      confidence = 0.7;
    } else if (w.length > 6 && /^[a-z]/.test(w)) {
      type = "concept";
      confidence = 0.5;
    } else if (/[\u4e00-\u9fff]/.test(w) && w.length >= 3) {
      type = "concept";
      confidence = 0.5;
    }

    if (type) {
      entities.push({ word: w, type, confidence, raw: w });
    }
  }

  return entities;
}

/**
 * 提取关系对 (两个实体之间的动词连接)
 *
 * @param {string} text
 * @param {Array} entities
 * @returns {Array<{from:string, to:string, relation:string}>}
 */
export function extractRelations(text, entities) {
  if (!text || entities.length < 2) return [];

  const entityWords = entities.map((e) => e.word.toLowerCase());
  const relations = [];

  // 按句子处理
  const sentences = text.split(/[。！？.!?\n]/).filter(Boolean);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const found = entityWords.filter((w) => lower.includes(w));

    if (found.length >= 2) {
      // 取前两个实体, 中间找动词
      const e1 = found[0];
      const e2 = found[1];
      const between = sentence.substring(
        sentence.toLowerCase().indexOf(e1) + e1.length,
        sentence.toLowerCase().indexOf(e2)
      ).trim();

      // 提取动词
      const verbs = extractVerbs(between);
      const relation = verbs.length > 0 ? verbs[0] : "related_to";

      relations.push({
        from: entities.find((e) => e.word.toLowerCase() === e1)?.word || e1,
        to: entities.find((e) => e.word.toLowerCase() === e2)?.word || e2,
        relation,
      });
    }
  }

  return relations;
}

/**
 * 从文本中提取动词 (简化版)
 */
function extractVerbs(text) {
  const verbPatterns = [
    /(detects?|detect|检测)/i,
    /(improves?|improve|提升|优化)/i,
    /(uses?|use|使用|利用)/i,
    /(validates?|validate|验证)/i,
    /(generates?|generate|生成)/i,
    /(produces?|produce|产生)/i,
    /(supports?|support|支持)/i,
    /(is|are|was|were|be|是)/i,
    /(has|have|had|有|包含)/i,
    /(calls?|call|called|称为)/i,
    /(means?|mean|意思|意味着)/i,
  ];

  const found = [];
  for (const pattern of verbPatterns) {
    const match = text.match(pattern);
    if (match) {
      found.push(match[1].toLowerCase());
    }
  }
  return found;
}
