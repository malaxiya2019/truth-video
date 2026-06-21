/**
 * Truth Validator — 事实校验器 (深度集成版)
 *
 * 核心升级:
 *   1. 三级置信度: verified / questionable / error
 *   2. 阈值控制: --truth-mode strict|normal|off
 *   3. 场景级评分: 检测场景错误密度
 *   4. 自动学习: 注册新事实到知识图谱
 */

import { getKG } from "./kg.js";

/**
 * 校验模式
 */
const MODES = {
  strict: {
    label: "严格",
    minConfidence: 0.6,     // 低于此置信度 → error
    flagThreshold: 0.2,     // 错误占比超过此值 → 场景警告
    colorError: "&H004444FF",    // 红
    colorQuestionable: "&H00FF8800", // 橙
    colorVerified: "&H0000FF88",  // 绿
    colorUnknown: "&H00FFFF00",   // 青
  },
  normal: {
    label: "标准",
    minConfidence: 0.3,
    flagThreshold: 0.4,
    colorError: "&H004444FF",
    colorQuestionable: "&H00FF8800",
    colorVerified: "&H0000FF88",
    colorUnknown: "&H00FFFF00",
  },
  off: {
    label: "关闭",
    minConfidence: 0,
    flagThreshold: 1.0,
    colorError: "&H00FFFFFF",
    colorQuestionable: "&H00FFFFFF",
    colorVerified: "&H00FFFFFF",
    colorUnknown: "&H00FFFFFF",
  },
};

/**
 * 验证结果
 */
class ValidationResult {
  constructor() {
    this.wordResults = [];     // [{word, status, confidence}]
    this.sceneScores = {};    // {sceneIndex: {total, errors, questionable}}
    this.errors = [];         // 需关注的错误
    this.warnings = [];       // 场景级警告
  }
}

/**
 * 校验器
 */
export class TruthValidator {
  constructor(mode = "normal", kg = null) {
    this.mode = MODES[mode] || MODES.normal;
    this.kg = kg || getKG();
    this.modeName = mode;
  }

  /**
   * 验证所有对齐词
   *
   * @param {Array} alignedWords - [{word, sceneIndex, start, end}]
   * @param {Array} scenes - 原始场景
   * @returns {{words: Array, result: ValidationResult}}
   */
  validateAll(alignedWords, scenes) {
    const result = new ValidationResult();

    const enrichedWords = alignedWords.map((w) => {
      const clean = w.word.replace(/[.,!?;:。，！？、()（）\/\\]/g, "").toLowerCase().trim();

      let { status, confidence, explanation } = this.kg.verify(clean);

      // off 模式: 全部标记 unknown
      if (this.modeName === "off") {
        status = "unknown";
        confidence = 0;
      }

      // 阈值调整
      if (status === "verified" && confidence < this.mode.minConfidence) {
        status = "questionable";
      }

      // 记录场景统计
      const si = w.sceneIndex;
      if (!result.sceneScores[si]) result.sceneScores[si] = { total: 0, errors: 0, questionable: 0, verified: 0 };
      result.sceneScores[si].total++;

      if (status === "error") {
        result.sceneScores[si].errors++;
        result.errors.push({ word: w.word, sceneIndex: si, confidence, explanation });
      } else if (status === "questionable") {
        result.sceneScores[si].questionable++;
      } else if (status === "verified") {
        result.sceneScores[si].verified++;
      }

      return { ...w, verified: status, confidence, explanation };
    });

    // 场景级警告
    for (const [si, score] of Object.entries(result.sceneScores)) {
      const errorRate = score.errors / Math.max(1, score.total);
      if (errorRate >= this.mode.flagThreshold) {
        const scene = scenes[parseInt(si)];
        const warning = `场景 "${scene?.title || si}" 错误率 ${(errorRate * 100).toFixed(0)}% — 建议检查内容`;
        result.warnings.push(warning);
      }
    }

    result.wordResults = enrichedWords;
    return { words: enrichedWords, result };
  }

  /**
   * 获取高亮颜色 (基于状态)
   */
  getHighlightColor(status) {
    switch (status) {
      case "error": return this.mode.colorError;
      case "questionable": return this.mode.colorOrange;
      case "verified": return this.mode.colorVerified;
      default: return this.mode.colorUnknown;
    }
  }

  /**
   * 格式化报告
   */
  formatReport(result) {
    const lines = [];
    const stats = this.kg.stats();

    lines.push(`  Truth Router v3 (${this.mode.label}模式)`);
    lines.push(`  知识图谱: ${stats.total_facts} 事实, ${stats.total_relations} 关系`);
    lines.push(`  校验结果: ${stats.verified} ✓  ${stats.error} ✗  ${stats.questionable} ?`);

    if (result.errors.length > 0) {
      lines.push("");
      lines.push("  发现错误:");
      for (const e of result.errors.slice(0, 10)) {
        lines.push(`    ✗ "${e.word}" (场景 ${e.sceneIndex})${e.explanation ? ` — ${e.explanation}` : ""}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push("");
      lines.push("  场景警告:");
      for (const w of result.warnings) {
        lines.push(`    ⚠ ${w}`);
      }
    }

    return lines.join("\n");
  }
}

/**
 * 创建默认校验器
 */
export function createValidator(mode = "normal", kg = null) {
  return new TruthValidator(mode, kg);
}
