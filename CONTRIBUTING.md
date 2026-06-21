# Contributing / 贡献指南

Thanks for your interest in truth-video! Here's how to contribute.

## Code Style / 代码规范

- JavaScript (ESM) — `import/export` syntax
- 2-space indentation
- JSDoc comments for all exports
- Chinese comments for Chinese logic, English for international

## Development / 开发

```bash
# Install
npm install

# Run tests
npm test

# Render a demo to verify
node src/cli.js examples/demo_zh.md --quality=draft --out=./test
```

## Pull Request Process / PR 流程

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Run `npm test` — must pass
5. Push and open a PR

## Adding a Lecturer / 添加讲师人格

Edit `src/lecture/persona.js`, add a new entry to `PERSONAS` with:
- TTS voice settings
- Pacing (pauses, speed)
- Highlight threshold
- Narrative weights
- Subtitle style (font/color)

## Adding a Theme / 添加视觉模板

Create a `.js` file in `templates/`:
```js
export const TEMPLATES = {
  mytheme: {
    name: "My Theme",
    emoji: "🎨",
    bg: { gradient: ["#000", "#111"], glow: "#222" },
    node: { system: { active: "#FFD700", ... }, ... },
    text: "#ffffff",
    edgeColor: "#88aaff",
    ...
  }
};
```

## Reporting Issues / 报告问题

Open an issue with:
- Steps to reproduce / 复现步骤
- Expected behavior / 预期行为
- Actual behavior / 实际行为
- Console output / 控制台输出
