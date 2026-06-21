<div align="center">

# 🎓 truth-video

**Turn Markdown into AI-generated educational videos with knowledge graph animations.**

**把 Markdown 自动编译成带知识图谱动画和 AI 讲解的教学视频。**

[![npm](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

</div>

---

## ✨ Features / 特性

| English | 中文 |
|---------|------|
| 🧠 **Knowledge Graph** — Auto-extract entities & relations, render force-directed layout animations | 🧠 **知识图谱** — 自动提取实体关系，力导向布局动画 |
| 🎓 **7 AI Lecturers** — Professor, Explainer, Science Communicator, Coach, Tech Expert, Hacker, Storyteller | 🎓 **7 种 AI 讲师人格** — 教授、解说、科普、教练、专家、黑客、故事叙述者 |
| 🎨 **7 Visual Themes** — Tech, Minimal, Tutorial, Presentation, Modern, Dark, Matcha (extensible) | 🎨 **7 种视觉模板** — 科技、极简、教程、演讲、现代、暗黑、抹茶 (可扩展) |
| 🔍 **Truth Router** — 3-level fact-checking with persistent knowledge graph | 🔍 **事实校验** — 3 级校验模式 + 持久化知识图谱 |
| 🎤 **TTS Voice** — edge-tts natural speech (Chinese & English) | 🎤 **AI 语音** — edge-tts 自然语音 (中英文) |
| 📝 **5 Subtitle Formats** — SRT, ASS, Karaoke, Intelligent, Lecture | 📝 **5 种字幕格式** — SRT/ASS/卡拉OK/智能/讲课 |
| 🌐 **Web UI** — Online editing, real-time progress, video download | 🌐 **Web 界面** — 在线操作、实时进度、视频下载 |
| 🤖 **AI Script Writing** — Generate teaching scripts from a topic (OpenAI/Anthropic) | 🤖 **AI 写稿** — 输入主题自动生成教学脚本 |
| 📦 **Batch Render** — Process multiple Markdown files at once | 📦 **批量渲染** — 一次性处理多个文件 |

---

## 🚀 Quick Start / 快速开始

### Prerequisites / 环境要求

```bash
# Node.js ≥ 18
# ffmpeg — video encoding / 视频编码
# playwright — frame capture / 帧截图
# edge-tts — AI voice / AI 语音

npm install
npx playwright install chromium
pip install edge-tts
```

### Render a Video / 渲染视频

```bash
# Chinese demo / 中文示例
node src/cli.js examples/demo_zh.md --out=./myvideo

# English demo / 英文示例
node src/cli.js examples/demo.md --out=./myvideo

# With different lecturer / 选讲师人格
node src/cli.js examples/demo_zh.md --persona=science

# With different theme / 选视觉模板
node src/cli.js examples/demo_zh.md --template=dark

# Strict fact-checking / 严格校验
node src/cli.js examples/demo_zh.md --truth-mode=strict

# Batch render all examples / 批量渲染
node src/cli.js --batch=examples/ --out=./renders

# AI script + render (requires API key) / AI 写稿 + 渲染
export OPENAI_API_KEY=sk-...
node src/cli.js --topic="RAG 检索增强生成"
```

### Web UI / Web 界面

```bash
npm run server
# → http://localhost:3000
```

---

## 🏗 Architecture / 架构

```
Input: examples/demo_zh.md
  │
  1. Parse Markdown → scenes    解析 Markdown 为场景
  2. Build Knowledge Graph      构建知识图谱
  3. Render HTML storyboard     渲染 HTML
  4. Generate animation frames  生成力导向动画帧
  5. Capture frames (Playwright) 截取帧序列
  6. Generate TTS audio         生成语音
  7. Build timeline              构建时间轴
  8. Encode video (ffmpeg)       编码视频
  9. Plan lecture (persona)      讲课规划
  10. Generate subtitles (×5)    生成字幕
  11. Burn subtitles             烧录字幕
  │
  ▼
Output: MP4 + SRT/ASS
```

## 🎭 Lecturers / 讲师人格

| ID | Name / 名称 | Speed / 语速 | Style / 风格 |
|:---|:-----------|:-------------|:------------|
| `professor` | 🎓 Professor / 教授 | 1.0x | Formal, systematic / 严肃系统 |
| `explainer` | ⚡ Explainer / 解说 | 1.2x | Concise, direct / 精炼直接 |
| `science` | 🔬 Science / 科普 | 0.9x | Storytelling, analogies / 生动类比 |
| `coach` | 🎯 Coach / 教练 | 1.1x | Question-driven / 问题驱动 |
| `tech_expert` | 🖥 Tech Expert / 专家 | 1.05x | Precise terminology / 精准术语 |
| `hacker` | 🕶 Hacker / 黑客 | 1.25x | Fast-paced, raw / 硬核快节奏 |
| `storyteller` | 📖 Storyteller / 叙述者 | 0.85x | Narrative-driven / 叙事驱动 |

## 🎨 Themes / 视觉模板

| ID | Name / 名称 | Style / 风格 |
|:---|:-----------|:------------|
| `tech` | 🔵 Tech / 科技 | Deep blue, glowing nodes (default) |
| `minimal` | ⚪ Minimal / 极简 | Clean, light background |
| `tutorial` | 📘 Tutorial / 教程 | Warm, friendly |
| `presentation` | 🎤 Presentation / 演讲 | High contrast, large text |
| `modern` | ✨ Modern / 现代 | Frosted glass, gradient |
| `dark` | 🌑 Dark / 暗黑 | Cyberpunk neon |
| `matcha` | 🍵 Matcha / 抹茶 | Green, soft (plugin example) |

Custom themes: put `.js` files in `templates/` exporting `TEMPLATES` object. Auto-loaded.

---

## 🔍 Truth Router / 事实校验

| Mode / 模式 | Description / 说明 |
|:-----------|:------------------|
| `normal` | Standard verification / 标准校验 (default) |
| `strict` | Low-confidence terms flagged as questionable / 严格 |
| `off` | Disabled / 关闭 |

Built-in 25 seed facts about AI/LLM. Learns new facts during rendering.

## 📦 Output / 输出

Each render produces **5 subtitle variants**:

```
output/
├── video.mp4               Pure video / 纯视频
├── video_sub.mp4           Basic subtitles / 基础字幕
├── video_karaoke.mp4       Karaoke word-highlight / 卡拉 OK
├── video_intelligent.mp4   Truth-colored subtitles / 智能字幕
├── video_lecture.mp4       Lecture-paced / 讲课节奏
├── subtitles.srt / .ass    Subtitle files / 字幕文件
└── knowledge-graph.json    Graph data / 图谱数据
```

---

## 🔧 Options / 参数

| Flag / 参数 | Default / 默认 | Description / 说明 |
|:-----------|:--------------|:------------------|
| `--persona` | `professor` | Lecturer persona / 讲师人格 |
| `--template` | `tech` | Visual theme / 视觉模板 |
| `--truth-mode` | `normal` | Fact-checking mode / 校验模式 |
| `--quality` | `normal` | Quality: draft / normal / high / 画质 |
| `--out` | `output/` | Output directory / 输出目录 |
| `--batch` | — | Batch render directory / 批量渲染 |
| `--topic` | — | AI script + render / AI 写稿 |

## 🧪 Tests / 测试

```bash
npm test
# 27 tests, 11 suites / 27 测试, 11 套件
```

## 📁 Project Structure / 项目结构

```
truth-video/
├── src/
│   ├── cli.js                CLI entry / 命令行入口
│   ├── render_pipeline.js    11-step pipeline / 核心管线
│   ├── server.js             Web UI server
│   ├── graph/                Knowledge graph / 知识图谱
│   ├── lecture/              Lecture system / 讲课系统
│   ├── motion/               Graph animation / 图谱动画
│   ├── subtitle/             Subtitle generation / 字幕生成
│   └── truth/                Truth Router / 事实校验
├── examples/                 Demo Markdown files
├── templates/                Custom themes / 自定义模板
├── tests/                    Test suite / 测试
└── schema/                   Type definitions / 类型定义
```

## 🤝 Contributing / 贡献

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License / 许可证

[MIT](LICENSE) © malaxiya2019
