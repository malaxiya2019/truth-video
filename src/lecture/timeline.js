/**
 * Lecture Timeline — 讲课时间轴
 *
 * 核心变化:
 *   - 不再是"每帧等长"
 *   - 而是根据教学策略设计节奏
 *
 * 叙事节奏 (narrative → 时间权重):
 *   hook       → 短 (引入, 抓住注意力)
 *   explain    → 中 (解释概念)
 *   deep_dive  → 长 (深入剖析)
 *   expand     → 中 (扩展应用)
 *   summary    → 短 (总结回顾)
 */

const NARRATIVE_PACING = {
  "hook":      { weight: 0.8,  desc: "快速引入" },
  "explain":   { weight: 1.0,  desc: "概念解释" },
  "deep_dive": { weight: 1.4,  desc: "深入剖析" },
  "expand":    { weight: 1.0,  desc: "扩展应用" },
  "summary":   { weight: 0.7,  desc: "总结回顾" },
};

/**
 * 计算场景权重 (基于叙事类型 + 关键词密度)
 */
function calcWeight(narrative, keyTerms, importance) {
  const base = NARRATIVE_PACING[narrative]?.weight || 1.0;
  const keyBoost = Math.min(0.5, keyTerms.length * 0.1);
  return base + keyBoost;
}

/**
 * 构建讲课时间轴 (接受人格参数)
 *
 * @param {Array} lecturePlan
 * @param {number} totalDuration
 * @param {object} [persona] - 人格配置, 影响叙事权重
 * @returns {Array}
 */
export function buildLectureTimeline(lecturePlan, totalDuration, persona = null) {
  // 使用人格驱动的叙事权重
  const personaWeights = persona?.narrative_weight || {};

  // 1. 计算原始权重
  const weights = lecturePlan.map((p) => {
    const personaNarrWeight = personaWeights[p.narrative] || 1.0;
    const baseWeight = NARRATIVE_PACING[p.narrative]?.weight || 1.0;
    const keyBoost = Math.min(0.5, p.key_terms.length * 0.1);
    return (baseWeight + keyBoost) * personaNarrWeight;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // 2. 分配时间
  let cursor = 0;
  return lecturePlan.map((plan, i) => {
    const rawDuration = (weights[i] / totalWeight) * totalDuration;
    const duration = Math.max(2.5, Math.round(rawDuration * 10) / 10);

    const segment = {
      ...plan,
      rawWeight: weights[i],
      duration,
      startSec: cursor,
      endSec: cursor + duration,
    };

    cursor += duration;
    return segment;
  });
}

/**
 * 格式化时间轴报告
 */
export function formatLectureTimeline(timeline) {
  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(4, "0")}`;
  };

  return timeline
    .map((t) => {
      const keyTerms = t.key_terms.map((k) => k.word).join(", ");
      return (
        `  ${fmt(t.startSec)} → ${fmt(t.endSec)}  ` +
        `[${t.duration.toFixed(1)}s] ${t.narrative.padEnd(10)} ` +
        `${t.goal}  ` +
        (keyTerms ? `✦ ${keyTerms}` : "")
      );
    })
    .join("\n");
}
