# 🎓 truth-video

> **把 Markdown 自动编译成带知识图谱动画和 AI 讲解的教学视频。**
>
> LaTeX × Manim × AI Teacher — 但只需要 Markdown。

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 渲染示例视频 (中文)
node src/cli.js examples/demo_zh.md --out=./output

# 渲染示例视频 (英文)
node src/cli.js examples/demo.md --out=./output

# 启动 Web UI
npm run server
# → http://localhost:3000
```

## 📖 用法

### CLI

```bash
# 基本渲染
node src/cli.js <input.md> [options]

# 选讲师人格
node src/cli.js examples/demo_zh.md --persona=science

# 选视觉模板
node src/cli.js examples/demo_zh.md --template=dark

# 严格事实校验
node src/cli.js examples/demo_zh.md --truth-mode=strict

# 批量渲染目录下所有 .md
node src/cli.js --batch=examples/ --out=./renders

# AI 自动写稿 + 渲染 (需 API Key)
export OPENAI_API_KEY=sk-...
node src/cli.js --topic="RAG 检索增强生成"
```

### Web UI

```bash
npm run server
# 打开 http://localhost:3000
```

Web UI 支持：
- 📝 选择 Markdown 文件或输入主题
- ⚙️ 配置讲师人格 / 画质 / 校验模式
- 📊 实时查看渲染进度
- 📥 下载 5 种字幕版本的视频
- 🕸 知识图谱交互播放器
- 📋 渲染历史记录管理
- 📦 导出项目 (.tvproj)

## 🎭 讲师人格

| 人格 | ID | 语速 | 风格 |
|:----|:---|:-----|:-----|
| 🎓 教授 | `professor` | 1.0x | 严肃系统讲解 |
| ⚡ 快速解说 | `explainer` | 1.2x | 精炼直接 |
| 🔬 科普风 | `science` | 0.9x | 生动类比 |
| 🎯 教练 | `coach` | 1.1x | 问题驱动 |
| 🖥 技术专家 | `tech_expert` | 1.05x | 精准术语 |
| 🕶 黑客 | `hacker` | 1.25x | 硬核快节奏 |
| 📖 故事叙述者 | `storyteller` | 0.85x | 叙事驱动 |

## 🎨 视觉模板

| 模板 | ID | 风格 |
|:----|:---|:-----|
| 🔵 科技 | `tech` | 深蓝科技风 (默认) |
| ⚪ 极简 | `minimal` | 浅色干净 |
| 📘 教程 | `tutorial` | 暖色调亲切 |
| 🎤 演讲 | `presentation` | 高对比大字 |
| ✨ 现代 | `modern` | 毛玻璃紫 |
| 🌑 暗黑 | `dark` | 霓虹赛博朋克 |
| 🍵 抹茶 | `matcha` | 绿色柔和 (插件示例) |

自定义模板：在 `templates/` 下放 `.js` 文件，export `TEMPLATES` 对象即可自动加载。

## 🔍 Truth Router 事实校验

| 模式 | 说明 |
|:----|:-----|
| `normal` | 标准校验 (默认) |
| `strict` | 严格模式，低置信度标记为 questionable |
| `off` | 关闭校验 |

内置 25 条 AI/LLM 种子知识，渲染时自动学习新事实。

## 🔧 选项

| 参数 | 默认值 | 说明 |
|:----|:------|:-----|
| `--persona` | `professor` | 讲师人格 |
| `--template` | `tech` | 视觉模板 |
| `--truth-mode` | `normal` | 事实校验模式 |
| `--quality` | `normal` | 画质 (draft/normal/high) |
| `--out` | `output/` | 输出目录 |
| `--batch` | — | 批量渲染目录 |
| `--topic` | — | AI 自动写稿 + 渲染 |

## 📦 输出

每次渲染生成 **5 种字幕版本的 MP4** + 字幕文件：

```
output/
├── video.mp4               纯视频
├── video_sub.mp4           基础字幕
├── video_karaoke.mp4       卡拉 OK 逐词高亮
├── video_intelligent.mp4   智能字幕 (Truth Router 着色)
├── video_lecture.mp4       讲课节奏字幕
├── subtitles.srt           SRT 格式
├── subtitles.ass           ASS 格式
├── subtitles_karaoke.ass   卡拉 OK ASS
├── subtitles_intelligent.ass 智能 ASS
├── subtitles_lecture.ass   讲课 ASS
├── video.html              图谱动画 HTML
└── knowledge-graph.json    知识图谱数据
```

## 🏗 架构

```
输入: examples/demo_zh.md
  │
  1. 解析 Markdown → 场景列表
  2. 构建知识图谱 → 实体 + 关系
  3. 渲染 HTML storyboard
  4. 生成力导向动画帧序列 (SVG)
  5. 截取帧序列 (Playwright)
  6. 生成 TTS 语音 (edge-tts)
  7. 构建时间轴
  8. ffmpeg 编码视频
  9. 讲课规划 (人格适配)
  10. 生成字幕 (5 种格式)
  11. 烧录字幕
  │
  ▼
输出: MP4 + SRT/ASS
```

## 🧪 测试

```bash
npm test
# 27 测试, 11 套件
```

## 📋 环境要求

- **Node.js** ≥ 18
- **ffmpeg** — 视频编码
- **Playwright** — 帧截图 (`npx playwright install chromium`)
- **edge-tts** — AI 语音 (`pip install edge-tts`)
- **OpenAI API Key** (可选) — AI 写稿

## 📄 License

MIT
