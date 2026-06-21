/**
 * AI 教师人格系统
 *
 * 不同人格 = 不同的"讲法":
 *   - TTS 语音/语速
 *   - 讲解节奏 (停顿/连接)
 *   - 重点词密度 (多少词被高亮)
 *   - 场景时长分配
 *   - 字幕风格 (字体/大小/颜色)
 *
 * 架构: 人格配置文件 + 运行时上下文
 */

/**
 * 人格定义
 */
export const PERSONAS = {
  /**
   * 🎓 教授风格 (Professor)
   * 严肃、系统、完整定义、语速慢
   * 适合: 技术教程、学术讲解、深度内容
   */
  professor: {
    name: "教授风格",
    name_en: "Professor",
    emoji: "🎓",

    // TTS
    tts: {
      voice_zh: "zh-CN-XiaoxiaoNeural",
      voice_en: "en-US-JennyNeural",
      rate: 1.0,       // 标准语速
      pitch: 1.0,      // 标准音高
    },

    // 节奏
    pacing: {
      pause_after_sentence: 0.4,  // 句末停顿 (秒)
      pause_after_keyword: 0.25,   // 关键词后停顿
      base_speed: 1.0,            // 基础语速
    },

    // 重点词 (密度越高, 越多词被高亮)
    highlight: {
      threshold: 1,       // score >= 1 就高亮 (所有词)
      intensity: 3,       // 高亮强度
      show_all: true,     // 每个词独立 Dialogue
    },

    // 叙事权重 (影响场景时长)
    narrative_weight: {
      hook:      1.0,
      explain:   1.2,   // 解释给更多时间
      deep_dive: 1.5,   // 深入剖析最长
      expand:    1.1,
      summary:   0.9,
    },

    // 字幕样式
    subtitle: {
      font_size: 34,
      font_color: "&H00FFFFFF",
      active_color: "&H00FFD700",  // 金色
      dim_color: "&H00888888",
      border: 2,
      shadow: 2,
    },

    description: "严肃、系统讲解，每个概念完整定义，语速适中偏慢",
  },

  /**
   * ⚡ 快速解说 (Explainer)
   * 精炼、去冗余、语速快
   * 适合: 产品介绍、快速科普、演示
   */
  explainer: {
    name: "快速解说",
    name_en: "Explainer",
    emoji: "⚡",

    tts: {
      voice_zh: "zh-CN-YunxiNeural",
      voice_en: "en-US-GuyNeural",
      rate: 1.2,       // 快速
      pitch: 1.1,      // 略高
    },

    pacing: {
      pause_after_sentence: 0.15,
      pause_after_keyword: 0.1,
      base_speed: 1.3,
    },

    highlight: {
      threshold: 2,       // 只高亮 score >= 2
      intensity: 2,
      show_all: true,
    },

    narrative_weight: {
      hook:      0.7,
      explain:   0.9,
      deep_dive: 0.8,
      expand:    0.7,
      summary:   0.6,
    },

    subtitle: {
      font_size: 30,
      font_color: "&H00FFFFFF",
      active_color: "&H0000FFFF",   // 青色
      dim_color: "&H00999999",
      border: 1,
      shadow: 1,
    },

    description: "精炼直接，去冗余，语速偏快",
  },

  /**
   * 🔬 科普风 (Science)
   * 生动、类比、讲故事
   * 适合: 科普视频、入门教程、公众演讲
   */
  science: {
    name: "科普风",
    name_en: "Science Communicator",
    emoji: "🔬",

    tts: {
      voice_zh: "zh-CN-XiaoyiNeural",
      voice_en: "en-US-AriaNeural",
      rate: 0.9,
      pitch: 1.15,     // 更活泼
    },

    pacing: {
      pause_after_sentence: 0.5,
      pause_after_keyword: 0.3,
      base_speed: 0.9,
    },

    highlight: {
      threshold: 1,
      intensity: 2,
      show_all: true,
    },

    narrative_weight: {
      hook:      1.3,    // 引入给更多时间 (讲故事)
      explain:   1.1,
      deep_dive: 1.0,
      expand:    1.2,
      summary:   1.0,
    },

    subtitle: {
      font_size: 36,
      font_color: "&H00FFFFFF",
      active_color: "&H0000FF88",   // 绿色
      dim_color: "&H00777777",
      border: 2,
      shadow: 3,
    },

    description: "生动类比，讲故事风格，语速偏慢但活泼",
  },

  /**
   * 🎯 教练风格 (Coach)
   * 问题驱动、强调重点、互动感
   * 适合: 面试准备、实操教学、技能培训
   */
  coach: {
    name: "教练风格",
    name_en: "Coach",
    emoji: "🎯",

    tts: {
      voice_zh: "zh-CN-YunyangNeural",
      voice_en: "en-US-DavisNeural",
      rate: 1.1,
      pitch: 1.05,
    },

    pacing: {
      pause_after_sentence: 0.3,
      pause_after_keyword: 0.35,   // 关键词后长停顿 (强调)
      base_speed: 1.1,
    },

    highlight: {
      threshold: 1,       // 全高亮
      intensity: 3,
      show_all: true,
    },

    narrative_weight: {
      hook:      1.1,
      explain:   1.0,
      deep_dive: 1.3,    // 深入剖析最重要
      expand:    1.0,
      summary:   1.2,    // 总结强调
    },

    subtitle: {
      font_size: 36,
      font_color: "&H00FFFFFF",
      active_color: "&H00FFAA00",   // 橙色
      dim_color: "&H00666666",
      border: 2,
      shadow: 2,
    },

    description: "问题驱动，重点突出，互动感强",
  },

  /**
   * 🖥 技术专家 (Tech Expert)
   * 架构视角、精准术语、系统思维
   * 适合: 技术深度讲解、架构分析、代码审查
   */
  tech_expert: {
    name: "技术专家",
    name_en: "Tech Expert",
    emoji: "🖥",

    tts: {
      voice_zh: "zh-CN-YunxiNeural",
      voice_en: "en-US-GuyNeural",
      rate: 1.05,
      pitch: 0.95,
    },

    pacing: {
      pause_after_sentence: 0.35,
      pause_after_keyword: 0.2,
      base_speed: 1.05,
    },

    highlight: {
      threshold: 1,
      intensity: 3,
      show_all: true,
    },

    narrative_weight: {
      hook:      0.9,
      explain:   1.1,
      deep_dive: 1.4,
      expand:    1.2,
      summary:   0.8,
    },

    subtitle: {
      font_size: 32,
      font_color: "&H00FFFFFF",
      active_color: "&H0000FF88",
      dim_color: "&H00888888",
      border: 2,
      shadow: 2,
    },

    description: "架构视角，精准术语，系统思维，语速平稳",
  },

  /**
   * 🕶 黑客风格 (Hacker)
   * 硬核、底层、直接、快节奏
   * 适合: 系统编程、安全分析、性能调优
   */
  hacker: {
    name: "黑客风格",
    name_en: "Hacker",
    emoji: "🕶",

    tts: {
      voice_zh: "zh-CN-YunyangNeural",
      voice_en: "en-US-DavisNeural",
      rate: 1.25,
      pitch: 0.9,
    },

    pacing: {
      pause_after_sentence: 0.1,
      pause_after_keyword: 0.05,
      base_speed: 1.4,
    },

    highlight: {
      threshold: 2,
      intensity: 3,
      show_all: true,
    },

    narrative_weight: {
      hook:      0.6,
      explain:   0.8,
      deep_dive: 1.6,
      expand:    0.7,
      summary:   0.5,
    },

    subtitle: {
      font_size: 28,
      font_color: "&H0000FF00",
      active_color: "&H00FFFFFF",
      dim_color: "&H00444444",
      border: 1,
      shadow: 1,
    },

    description: "硬核直接，快节奏，适合底层技术内容",
  },

  /**
   * 📖 故事叙述者 (Storyteller)
   * 叙事驱动、情感共鸣、案例丰富
   * 适合: 案例分享、经验总结、团队培训
   */
  storyteller: {
    name: "故事叙述者",
    name_en: "Storyteller",
    emoji: "📖",

    tts: {
      voice_zh: "zh-CN-XiaoxiaoNeural",
      voice_en: "en-US-JennyNeural",
      rate: 0.85,
      pitch: 1.1,
    },

    pacing: {
      pause_after_sentence: 0.6,
      pause_after_keyword: 0.3,
      base_speed: 0.85,
    },

    highlight: {
      threshold: 1,
      intensity: 2,
      show_all: true,
    },

    narrative_weight: {
      hook:      1.5,
      explain:   1.0,
      deep_dive: 0.9,
      expand:    1.1,
      summary:   1.3,
    },

    subtitle: {
      font_size: 36,
      font_color: "&H00FFFFFF",
      active_color: "&H00FF8888",
      dim_color: "&H00888888",
      border: 2,
      shadow: 3,
    },

    description: "叙事驱动，情感共鸣，节奏舒缓",
  },
};

/**
 * 获取人格配置 (带默认值保护)
 */
export function getPersona(name = "professor") {
  const p = PERSONAS[name];
  if (!p) {
    console.warn(`Unknown persona "${name}", falling back to professor`);
    return PERSONAS.professor;
  }
  return p;
}

/**
 * 列出所有人格
 */
export function listPersonas() {
  return Object.entries(PERSONAS).map(([key, val]) => ({
    id: key,
    name: val.name,
    emoji: val.emoji,
    description: val.description,
  }));
}
