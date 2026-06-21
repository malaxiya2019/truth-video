/**
 * truth-video 测试套件
 *
 * 运行: node tests/run.js
 * 使用 Node 内置 test runner (Node >= 18)
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── 工具: 动态导入源码 ──
async function importMod(name) {
  return await import(path.join(ROOT, "src", name));
}

// ════════════════════════════════════════════════════════════════
//  1. parser.js — Markdown 解析
// ════════════════════════════════════════════════════════════════
describe("parser.js", async () => {
  const { parseMarkdown } = await importMod("parser.js");

  it("应解析 Markdown 为场景列表", () => {
    const md = `# Title\n\n## Scene 1\n\nContent 1\n\n## Scene 2\n\nContent 2`;
    const scenes = parseMarkdown(md);
    assert.equal(scenes.length, 3); // cover + 2 slides
    assert.equal(scenes[0].type, "cover");
    assert.equal(scenes[0].title, "Title");
    assert.equal(scenes[1].type, "slide");
    assert.equal(scenes[1].title, "Scene 1");
    assert.equal(scenes[1].body, "Content 1");
  });

  it("应处理空 body", () => {
    const md = `# Title\n\n## Scene 1`;
    const scenes = parseMarkdown(md);
    assert.equal(scenes.length, 2);
    assert.equal(scenes[1].body, "");
  });

  it("应处理空文件", () => {
    const scenes = parseMarkdown("");
    assert.equal(scenes.length, 1);
    assert.equal(scenes[0].type, "cover");
  });
});

// ════════════════════════════════════════════════════════════════
//  2. tokenizer.js — 分词
// ════════════════════════════════════════════════════════════════
describe("subtitle/tokenizer.js", async () => {
  const { tokenize, wordCount } = await importMod("subtitle/tokenizer.js");

  it("应切分英文句子", () => {
    const tokens = tokenize("Truth Router detects hallucination");
    assert.ok(tokens.length >= 3);
    assert.ok(tokens.includes("Truth"));
    assert.ok(tokens.includes("hallucination"));
  });

  it("应切分中文句子", () => {
    const tokens = tokenize("知识图谱验证事实");
    assert.ok(tokens.length > 0);
    assert.ok(tokens.some((t) => t.includes("知识")) || tokens.some((t) => t.includes("知识图谱")));
  });

  it("应处理空文本", () => {
    assert.equal(tokenize("").length, 0);
    assert.equal(tokenize("   ").length, 0);
  });
});

// ════════════════════════════════════════════════════════════════
//  3. aligner.js — 时间对齐
// ════════════════════════════════════════════════════════════════
describe("subtitle/aligner.js", async () => {
  const { alignWords, smartAlignWords } = await importMod("subtitle/aligner.js");

  it("alignWords 应均匀分配时间", () => {
    const words = alignWords("A B C", 0, 3);
    assert.equal(words.length, 3);
    assert.equal(words[0].start, 0);
    assert.ok(words[2].end <= 3);
  });

  it("smartAlignWords 应按分数分配时间", () => {
    const words = smartAlignWords("Truth Router v6", 0, 3);
    assert.equal(words.length, 3);
    // Truth 和 Router 分数高, 应占更多时间
    const total = words.reduce((s, w) => s + (w.end - w.start), 0);
    assert.ok(total > 1.0, "总时长应大于 1s");
    assert.ok(words[0].end - words[0].start >= 0.28, "最小词时长应 ≥ 280ms");
  });

  it("应处理单词", () => {
    const words = smartAlignWords("Hello", 0, 2);
    assert.equal(words.length, 1);
    assert.equal(words[0].word, "Hello");
  });
});

// ════════════════════════════════════════════════════════════════
//  4. graph/builder.js — 知识图谱构建
// ════════════════════════════════════════════════════════════════
describe("graph/builder.js", async () => {
  const { buildKnowledgeGraph } = await importMod("graph/builder.js");

  it("应从场景中提取实体和关系", () => {
    const scenes = [
      { title: "Truth Router", body: "detects hallucination", index: 0 },
    ];
    const { graph, stats } = buildKnowledgeGraph(scenes);
    assert.ok(stats.nodes >= 3);
    assert.ok(stats.edges >= 0);
  });

  it("应处理空场景", () => {
    const { graph, stats } = buildKnowledgeGraph([]);
    assert.equal(stats.nodes, 0);
    assert.equal(stats.edges, 0);
  });
});

// ════════════════════════════════════════════════════════════════
//  5. lecture/planner.js — 讲课规划
// ════════════════════════════════════════════════════════════════
describe("lecture/planner.js", async () => {
  const { planLecture } = await importMod("lecture/planner.js");

  it("应为每个场景生成教学计划", () => {
    const scenes = [
      { title: "Intro", body: "", index: 0 },
      { title: "Concept", body: "explanation", index: 1 },
    ];
    const plan = planLecture(scenes);
    assert.equal(plan.length, 2);
    assert.ok(plan[0].goal);
    assert.ok(plan[0].narrative);
  });

  it("最后一个场景应为 summary", () => {
    const scenes = [
      { title: "A", body: "", index: 0 },
      { title: "B", body: "", index: 1 },
      { title: "C", body: "", index: 2 },
    ];
    const plan = planLecture(scenes);
    assert.equal(plan[2].goal, "总结回顾");
  });
});

// ════════════════════════════════════════════════════════════════
//  6. lecture/persona.js — 人格系统
// ════════════════════════════════════════════════════════════════
describe("lecture/persona.js", async () => {
  const { getPersona, listPersonas } = await importMod("lecture/persona.js");

  it("应返回有效人格", () => {
    const p = getPersona("professor");
    assert.equal(p.name, "教授风格");
    assert.ok(p.tts);
    assert.ok(p.pacing);
    assert.ok(p.highlight);
  });

  it("未知人格应降级到默认", () => {
    const p = getPersona("unknown_style");
    assert.equal(p.name, "教授风格");
  });

  it("listPersonas 应返回所有人格", () => {
    const list = listPersonas();
    assert.ok(list.length >= 4);
  });
});

// ════════════════════════════════════════════════════════════════
//  7. truth/validator.js — Truth Router
// ════════════════════════════════════════════════════════════════
describe("truth/validator.js", async () => {
  const { createValidator } = await importMod("truth/validator.js");
  const { getKG, resetKG } = await importMod("truth/kg.js");

  it("应验证词条状态", () => {
    const kg = getKG();
    kg.learn("truth", "verified", "test concept");
    kg.learn("error_term", "error", "known error");

    const validator = createValidator("strict");
    const { words } = validator.validateAll([
      { word: "truth", sceneIndex: 0, start: 0, end: 1 },
      { word: "error_term", sceneIndex: 0, start: 1, end: 2 },
      { word: "unknown", sceneIndex: 0, start: 2, end: 3 },
    ], [{ title: "Test", body: "", index: 0 }]);

    assert.equal(words[0].verified, "verified");
    assert.equal(words[1].verified, "error");
    assert.equal(words[2].verified, "unknown");

    resetKG();
  });
});

// ════════════════════════════════════════════════════════════════
//  8. subtitle/generator.js — 字幕生成
// ════════════════════════════════════════════════════════════════
describe("subtitle/generator.js", async () => {
  const { toSRT, toASS, toKaraokeASS } = await importMod("subtitle/generator.js");

  const mockWords = [
    { word: "Hello", start: 0, end: 1, sceneIndex: 0 },
    { word: "World", start: 1, end: 2, sceneIndex: 0 },
  ];

  it("toSRT 应生成有效 SRT", () => {
    const srt = toSRT(mockWords);
    assert.ok(srt.includes("00:00:00,000 --> 00:00:02,000"));
    assert.ok(srt.includes("Hello World"));
    assert.ok(srt.match(/\d+\n\d{2}:\d{2}:\d{2},\d{3}/), "应包含时间戳格式");
  });

  it("toASS 应生成有效 ASS", () => {
    const ass = toASS(mockWords);
    assert.ok(ass.includes("[Script Info]"));
    assert.ok(ass.includes("[Events]"));
    assert.ok(ass.includes("Dialogue:"));
  });

  it("toKaraokeASS 应包含 \\k 标签", () => {
    const kara = toKaraokeASS(mockWords);
    assert.ok(kara.includes("\\k100"));
  });
});

// ════════════════════════════════════════════════════════════════
//  9. quality.js — 画质配置
// ════════════════════════════════════════════════════════════════
describe("quality.js", async () => {
  const { getQuality, QUALITY_PRESETS } = await importMod("quality.js");

  it("应返回所有画质预设", () => {
    assert.ok(QUALITY_PRESETS.draft);
    assert.ok(QUALITY_PRESETS.normal);
    assert.ok(QUALITY_PRESETS.high);
  });

  it("draft 应比 normal 分辨率低", () => {
    assert.ok(QUALITY_PRESETS.draft.width < QUALITY_PRESETS.normal.width);
    assert.ok(QUALITY_PRESETS.draft.crf > QUALITY_PRESETS.normal.crf);
  });

  it("未知画质应返回 normal", () => {
    const q = getQuality("unknown");
    assert.equal(q.width, 1280);
  });
});

// ════════════════════════════════════════════════════════════════
//  10. config.js — 配置层
// ════════════════════════════════════════════════════════════════
describe("config.js", async () => {
  const { resolveConfig } = await importMod("config.js");

  it("应返回默认配置", () => {
    const cfg = resolveConfig({});
    assert.equal(cfg.persona, "professor");
    assert.equal(cfg.truthMode, "normal");
    assert.equal(cfg.quality, "normal");
    assert.ok(cfg.subtitle);
    assert.ok(cfg.graph);
  });

  it("CLI 参数应覆盖默认值", () => {
    const cfg = resolveConfig({ persona: "explainer", quality: "draft" });
    assert.equal(cfg.persona, "explainer");
    assert.equal(cfg.quality, "draft");
    assert.equal(cfg.truthMode, "normal"); // 未覆盖, 保留默认
  });

  it("应包含所有必要字段", () => {
    const cfg = resolveConfig({});
    const required = ["persona", "truthMode", "quality", "outDir", "tts", "subtitle", "graph"];
    for (const key of required) {
      assert.ok(cfg[key] !== undefined, `缺少字段: ${key}`);
    }
  });
});

// ════════════════════════════════════════════════════════════════
//  11. 集成测试: 完整场景流转
// ════════════════════════════════════════════════════════════════
describe("integration", async () => {
  it("Markdown → Scene → 知识图谱 → 字幕 应无异常", async () => {
    const { parseMarkdown } = await importMod("parser.js");
    const { buildKnowledgeGraph } = await importMod("graph/builder.js");
    const { planLecture } = await importMod("lecture/planner.js");
    const { smartAlignAllScenes } = await importMod("subtitle/aligner.js");
    const { analyzeKeywords } = await importMod("subtitle/keywords.js");
    const { toSRT } = await importMod("subtitle/generator.js");

    const md = `# Test\n\n## Concept A\n\nExplanation A\n\n## Concept B\n\nExplanation B`;
    const scenes = parseMarkdown(md);
    assert.equal(scenes.length, 3);

    const { graph } = buildKnowledgeGraph(scenes);
    assert.ok(graph.nodes.length > 0);

    const plan = planLecture(scenes);
    assert.equal(plan.length, 3);

    const words = smartAlignAllScenes(scenes.map((s, i) => ({
      title: s.title, body: s.body, duration: 3,
    })));
    assert.ok(words.length > 0);

    const enriched = analyzeKeywords(scenes, words);
    assert.ok(enriched.length === words.length);

    const srt = toSRT(words);
    assert.ok(srt.includes("00:00:00,000"));
  });
});
