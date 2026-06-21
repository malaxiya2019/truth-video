/**
 * 🍵 抹茶 (Matcha) — 模板插件示例
 *
 * 绿色主题, 柔和护眼
 * 放置在 truth-video/templates/matcha.js 即可自动加载
 */

export const TEMPLATES = {
  matcha: {
    name: "抹茶",
    name_en: "Matcha",
    emoji: "🍵",
    bg: {
      gradient: ["#1a2e1a", "#0d1f0d"],
      glow: "#2d4a2d",
    },
    node: {
      system:     { active: "#C8E6C9", connected: "#81C784", dim: "#3a5a3a" },
      problem:    { active: "#FF8A80", connected: "#D32F2F", dim: "#5a2020" },
      solution:   { active: "#A5D6A7", connected: "#66BB6A", dim: "#2d5a2d" },
      concept:    { active: "#90CAF9", connected: "#42A5F5", dim: "#1a3a5a" },
      capability: { active: "#FFCC80", connected: "#FFA726", dim: "#5a3a1a" },
    },
    text: "#e8f5e9",
    titleBg: "rgba(26,46,26,0.7)",
    glowIntensity: 0.35,
    edgeColor: "#66BB6A",
    legendBg: "#1a2e1a",
    description: "抹茶绿, 柔和护眼",
  },
};
