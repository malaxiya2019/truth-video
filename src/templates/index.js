/**
 * 视频模板系统
 *
 * 控制图谱画面的视觉风格:
 *   - 背景色/渐变
 *   - 节点颜色 (活跃/关联/暗淡)
 *   - 字体
 *   - 标题样式
 *   - 发光效果强度
 *
 * 插件化: 在项目根目录创建 templates/ 目录,
 * 放入 .js 文件 export const TEMPLATES = { ... } 即可自动加载。
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = path.resolve(__dirname, "../../templates");

export const TEMPLATES = {
  /**
   * 🔵 科技 (Tech) — 默认
   * 深蓝黑背景, 蓝青色调, 发光节点
   */
  tech: {
    name: "科技",
    name_en: "Tech",
    emoji: "🔵",
    bg: {
      gradient: ["#0a1628", "#0d1117"],
      glow: "#1a3a6a",
    },
    node: {
      system:     { active: "#FFD700", connected: "#AA8800", dim: "#554400" },
      problem:    { active: "#FF4444", connected: "#AA2222", dim: "#551111" },
      solution:   { active: "#00FF88", connected: "#00AA55", dim: "#004422" },
      concept:    { active: "#4488FF", connected: "#3366AA", dim: "#223355" },
      capability: { active: "#FF8800", connected: "#AA5500", dim: "#553300" },
    },
    text: "#ffffff",
    titleBg: "rgba(0,0,0,0.5)",
    glowIntensity: 0.4,
    edgeColor: "#88aaff",
    legendBg: "#0a1628",
    description: "深蓝科技风, 发光节点",
  },

  /**
   * ⚪ 极简 (Minimal)
   * 浅色背景, 干净线条, 柔和色彩
   */
  minimal: {
    name: "极简",
    name_en: "Minimal",
    emoji: "⚪",
    bg: {
      gradient: ["#f5f5f5", "#e8e8e8"],
      glow: "#dddddd",
    },
    node: {
      system:     { active: "#2d7d46", connected: "#5a9e6f", dim: "#b0c4b5" },
      problem:    { active: "#d32f2f", connected: "#e57373", dim: "#f0c0c0" },
      solution:   { active: "#1976d2", connected: "#64b5f6", dim: "#b0d0f0" },
      concept:    { active: "#7b1fa2", connected: "#ba68c8", dim: "#d0c0e0" },
      capability: { active: "#f57c00", connected: "#ffb74d", dim: "#f0d8b0" },
    },
    text: "#222222",
    titleBg: "rgba(255,255,255,0.8)",
    glowIntensity: 0.15,
    edgeColor: "#999999",
    legendBg: "#f0f0f0",
    description: "浅色背景, 干净柔和",
  },

  /**
   * 🟠 教程 (Tutorial)
   * 暖色调, 友好亲切
   */
  tutorial: {
    name: "教程",
    name_en: "Tutorial",
    emoji: "📘",
    bg: {
      gradient: ["#1a1a2e", "#16213e"],
      glow: "#2a2a4e",
    },
    node: {
      system:     { active: "#FFD93D", connected: "#c9a820", dim: "#6b5a10" },
      problem:    { active: "#FF6B6B", connected: "#cc4444", dim: "#662222" },
      solution:   { active: "#6BCB77", connected: "#4a9e55", dim: "#254f2a" },
      concept:    { active: "#4D96FF", connected: "#3a75cc", dim: "#1d3a66" },
      capability: { active: "#FF8C42", connected: "#c96e34", dim: "#65371a" },
    },
    text: "#f0e6d0",
    titleBg: "rgba(26,26,46,0.8)",
    glowIntensity: 0.3,
    edgeColor: "#88aadd",
    legendBg: "#1a1a2e",
    description: "暖色调, 友好亲切",
  },

  /**
   * 🎤 演讲 (Presentation)
   * 高对比, 大字, 适合投影
   */
  presentation: {
    name: "演讲",
    name_en: "Presentation",
    emoji: "🎤",
    bg: {
      gradient: ["#0b0b0b", "#1a1a1a"],
      glow: "#222222",
    },
    node: {
      system:     { active: "#FFFFFF", connected: "#cccccc", dim: "#555555" },
      problem:    { active: "#FF4444", connected: "#aa2222", dim: "#551111" },
      solution:   { active: "#44FF44", connected: "#22aa22", dim: "#115511" },
      concept:    { active: "#4488FF", connected: "#2255aa", dim: "#112255" },
      capability: { active: "#FF8800", connected: "#aa5500", dim: "#553300" },
    },
    text: "#ffffff",
    titleBg: "rgba(0,0,0,0.6)",
    glowIntensity: 0.2,
    edgeColor: "#666666",
    legendBg: "#111111",
    description: "高对比, 白字黑底, 适合大屏",
  },

  /**
   * ✨ 现代 (Modern)
   * 毛玻璃效果, 渐变色彩, 柔和发光
   */
  modern: {
    name: "现代",
    name_en: "Modern",
    emoji: "✨",
    bg: {
      gradient: ["#1e1b4b", "#0f0d2e"],
      glow: "#312e81",
    },
    node: {
      system:     { active: "#FBBF24", connected: "#D97706", dim: "#78350F" },
      problem:    { active: "#FB7185", connected: "#E11D48", dim: "#73122A" },
      solution:   { active: "#34D399", connected: "#059669", dim: "#064E3B" },
      concept:    { active: "#60A5FA", connected: "#2563EB", dim: "#1E3A5F" },
      capability: { active: "#F472B6", connected: "#DB2777", dim: "#6B1140" },
    },
    text: "#f1f5f9",
    titleBg: "rgba(30,27,75,0.7)",
    glowIntensity: 0.5,
    edgeColor: "#818CF8",
    legendBg: "#1e1b4b",
    description: "毛玻璃紫, 渐变柔和, 现代感",
  },

  /**
   * 🌑 暗黑 (Dark)
   * 纯黑背景, 霓虹色彩, 高饱和
   */
  dark: {
    name: "暗黑",
    name_en: "Dark",
    emoji: "🌑",
    bg: {
      gradient: ["#000000", "#0a0a0a"],
      glow: "#1a1a2e",
    },
    node: {
      system:     { active: "#FF6B35", connected: "#CC5522", dim: "#552200" },
      problem:    { active: "#FF0040", connected: "#CC0033", dim: "#550011" },
      solution:   { active: "#00FF41", connected: "#00CC33", dim: "#005511" },
      concept:    { active: "#00D4FF", connected: "#00AACC", dim: "#004455" },
      capability: { active: "#FF00FF", connected: "#CC00CC", dim: "#550055" },
    },
    text: "#e0e0e0",
    titleBg: "rgba(0,0,0,0.8)",
    glowIntensity: 0.6,
    edgeColor: "#333355",
    legendBg: "#0a0a0a",
    description: "纯黑背景, 霓虹色彩, 赛博朋克",
  },
};

// ── 插件模板加载 (启动时同步扫描) ──
try {
  if (fs.existsSync(PLUGIN_DIR)) {
    const files = fs.readdirSync(PLUGIN_DIR).filter((f) => f.endsWith(".js"));
    for (const file of files) {
      try {
        const filePath = path.join(PLUGIN_DIR, file);
        const fileUrl = new URL(`file://${filePath}`).href;
        // 使用 dynamic import 加载 — 因为这是模块顶层, await 可用
        const mod = await import(fileUrl);
        if (mod.TEMPLATES) {
          const keys = Object.keys(mod.TEMPLATES);
          Object.assign(TEMPLATES, mod.TEMPLATES);
          console.log(`  📦 模板插件: ${file} (${keys.length} 个: ${keys.join(", ")})`);
        }
      } catch (e) {
        console.warn(`  ⚠ 模板插件加载失败: ${file} — ${e.message}`);
      }
    }
  }
} catch {}

/**
 * 获取模板
 */
export function getTemplate(name = "tech") {
  const t = TEMPLATES[name];
  if (!t) {
    console.warn(`   ⚠ 未知模板 "${name}", 使用 tech`);
    return TEMPLATES.tech;
  }
  return t;
}

/**
 * 列出所有模板
 */
export function listTemplates() {
  return Object.entries(TEMPLATES).map(([key, val]) => ({
    id: key,
    name: val.name,
    emoji: val.emoji,
    description: val.description,
  }));
}
