/**
 * AI Script Writer — 从主题自动生成教学稿
 *
 * 输入: 主题 (如 "什么是 RAG")
 * 输出: Markdown 格式的教学脚本
 *
 * 引擎:
 *   1. OpenAI (需 OPENAI_API_KEY)
 *   2. Anthropic (需 ANTHROPIC_API_KEY)
 *   3. 模板降级 (无 API Key 时)
 */

import fs from "fs";
import path from "path";
import os from "os";

/**
 * 生成教学稿
 *
 * @param {string} topic       - 主题
 * @param {object} options
 * @param {string} options.style - 风格 (academic|通俗|technical)
 * @param {number} options.scenes - 场景数 (3-8)
 * @returns {Promise<string>} Markdown 内容
 */
export async function writeScript(topic, options = {}) {
  const style = options.style || "通俗";
  const sceneCount = Math.min(8, Math.max(3, options.scenes || 5));

  // 尝试 AI 生成
  if (process.env.OPENAI_API_KEY) {
    try {
      return await generateWithOpenAI(topic, style, sceneCount);
    } catch (e) {
      console.log(`  ⚠ AI 生成失败 (${e.message}), 使用模板...`);
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await generateWithAnthropic(topic, style, sceneCount);
    } catch {
      console.log("  ⚠ Anthropic 生成失败, 使用模板...");
    }
  }

  // 降级: 模板生成
  return generateTemplate(topic, sceneCount);
}

/**
 * OpenAI 生成
 */
async function generateWithOpenAI(topic, style, sceneCount) {
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI();

  const prompt = `你是一个教学视频脚本写手。请为主题"${topic}"生成一个 ${style} 风格的教学视频脚本。

要求:
- 使用 Markdown 格式
- 标题为 "# ${topic}"
- 用 "## " 分隔 ${sceneCount} 个场景
- 每个场景包含一个核心观点和简短解释
- 语言流畅, 适合 TTS 朗读
- 总字数 200-400 字

格式:
# ${topic}

## 场景1标题

场景1解释内容

## 场景2标题

场景2解释内容

...`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 1500,
  });

  const content = resp.choices[0]?.message?.content || "";
  return cleanMarkdown(content);
}

/**
 * Anthropic 生成
 */
async function generateWithAnthropic(topic, style, sceneCount) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic();

  const prompt = `你是一个教学视频脚本写手。请为主题"${topic}"生成一个 ${style} 风格的教学视频脚本。

要求:
- 使用 Markdown 格式
- 标题为 "# ${topic}"
- 用 "## " 分隔 ${sceneCount} 个场景
- 每个场景包含一个核心观点和简短解释
- 语言流畅, 适合 TTS 朗读
- 总字数 200-400 字`;

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const content = resp.content[0]?.text || "";
  return cleanMarkdown(content);
}

/**
 * 模板生成 (无 API Key 降级)
 */
function generateTemplate(topic, sceneCount) {
  const templates = [
    { title: `什么是${topic}`, body: `${topic} 是一个重要的概念, 理解它有助于掌握相关领域知识。` },
    { title: `${topic}的核心原理`, body: `${topic} 的工作原理基于几个关键机制, 这些机制共同保证了它的有效性。` },
    { title: `${topic}的主要优势`, body: `相比传统方法, ${topic} 提供了更好的性能和可靠性。` },
    { title: `${topic}的实际应用`, body: `${topic} 已经在多个领域得到广泛应用, 包括技术、教育和商业。` },
    { title: `${topic}的未来发展`, body: `随着技术进步, ${topic} 将继续演进, 带来更多创新可能。` },
    { title: `如何开始使用${topic}`, body: `入门${topic} 需要理解基本概念, 然后通过实践逐步深入。` },
    { title: `${topic}的最佳实践`, body: `在实际使用中, 遵循最佳实践可以最大化${topic} 的价值。` },
    { title: `${topic}的常见问题`, body: `了解${topic} 的常见问题和解决方案, 可以帮助避免踩坑。` },
  ];

  const selected = templates.slice(0, sceneCount);
  const lines = [`# ${topic}`, ""];
  for (const t of selected) {
    lines.push(`## ${t.title}`, "", t.body, "");
  }

  return lines.join("\n");
}

/**
 * 清理 Markdown (去除 AI 可能的额外说明)
 */
function cleanMarkdown(content) {
  // 移除可能的包围代码块
  let clean = content.replace(/```markdown\n?/g, "").replace(/```\n?/g, "").trim();

  // 确保以 # 开头
  if (!clean.startsWith("#")) {
    clean = "# " + clean;
  }

  // 确保有 ## 分隔
  if (!clean.includes("## ")) {
    // 尝试按段落分割
    const paragraphs = clean.split("\n\n").filter(Boolean);
    if (paragraphs.length > 1) {
      clean = paragraphs[0] + "\n\n" + paragraphs.slice(1).map((p) => "## " + p.trim()).join("\n\n");
    }
  }

  return clean;
}

/**
 * 写入临时文件并返回路径
 */
export function writeTempFile(content) {
  const tmpDir = path.join(os.tmpdir(), "truth-video-scripts");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, `script_${Date.now()}.md`);
  fs.writeFileSync(tmpFile, content, "utf8");
  return tmpFile;
}
