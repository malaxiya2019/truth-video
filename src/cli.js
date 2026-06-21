#!/usr/bin/env node

/**
 * truth-video CLI — 知识图谱教学视频编译器
 *
 * 用法:
 *   node src/cli.js <input.md> [options]
 *   node src/cli.js --batch=<dir> [options]
 *
 * 选项:
 *   --persona=<name>   讲师人格
 *   --truth-mode=<mode> Truth Router 校验模式
 *   --batch=<dir>      批量渲染目录下所有 .md
 *   --out=<dir>        输出目录 (默认 output/)
 *   --help, -h         显示帮助
 *   --version, -v      显示版本
 */

import { renderOne } from "./render_pipeline.js";
import { batchRender } from "./batch.js";
import { getPersona, listPersonas } from "./lecture/persona.js";
import { listTemplates } from "./templates/index.js";
import { getKG, resetKG } from "./truth/kg.js";
import { writeScript, writeTempFile } from "./writer/index.js";
import fs from "fs";
import path from "path";

const VERSION = "3.0.0-alpha";

const args = process.argv.slice(2);

// ── 帮助 ──
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
  truth-video v${VERSION} — 知识图谱教学视频编译器

  用法:
    node src/cli.js <input.md> [options]
    node src/cli.js --batch=<dir> [options]

  参数:
    input.md               Markdown 输入文件

  选项:
    --persona=<name>       讲师人格 (professor|explainer|science|coach|hacker|storyteller)
    --truth-mode=<mode>    校验模式 (normal|strict|off)
    --template=<name>      视觉模板 (tech|minimal|tutorial|presentation|modern|dark|matcha)
    --quality=<name>       画质 (draft|normal|high)
    --topic="<主题>"       AI 自动写稿 + 渲染
    --batch=<dir>          批量渲染目录
    --out=<dir>            输出目录 (默认: output/)
    --personas             列出讲师人格
    --templates            列出视觉模板
    --truth-kg-clear       清除知识图谱缓存
    --version, -v          版本
    --help, -h             帮助

  示例:
    node src/cli.js examples/demo.md
    node src/cli.js --batch=examples/ --out=./renders
    node src/cli.js examples/demo_zh.md --persona=explainer
    node src/cli.js examples/demo_zh.md --template=dark --persona=hacker
    node src/cli.js examples/demo_zh.md --template=matcha
    node src/cli.js examples/demo_zh.md --truth-mode=strict --quality=high
`);
  process.exit(0);
}
if (args.includes("--version") || args.includes("-v")) { console.log(`truth-video v${VERSION}`); process.exit(0); }
if (args.includes("--templates")) {
  console.log("\n可用视觉模板:\n");
  for (const t of listTemplates()) console.log(`  ${t.emoji}  ${t.id.padEnd(14)} ${t.name.padEnd(8)} ${t.description}`);
  console.log("\n  使用: --template=tech|minimal|tutorial|presentation\n");
  process.exit(0);
}
if (args.includes("--personas")) {
  console.log("\n可用讲师人格:\n");
  for (const p of listPersonas()) console.log(`  ${p.emoji}  ${p.id.padEnd(14)} ${p.name.padEnd(8)} ${p.description}`);
  console.log();
  process.exit(0);
}

// ── 选项 ──
const personaName = ((a) => a ? a.split("=")[1] : "professor")(args.find((a) => a.startsWith("--persona=")));
const truthMode = ((a) => a ? a.split("=")[1] : "normal")(args.find((a) => a.startsWith("--truth-mode=")));
const qualityName = ((a) => a ? a.split("=")[1] : "normal")(args.find((a) => a.startsWith("--quality=")));
const batchDir = ((a) => a ? a.split("=")[1] : null)(args.find((a) => a.startsWith("--batch=")));
const topic = ((a) => a ? a.split("=").slice(1).join("=") : null)(args.find((a) => a.startsWith("--topic=")));
const outDir = ((a) => a ? a.split("=")[1] : "output")(args.find((a) => a.startsWith("--out=")));

if (args.includes("--truth-kg-clear")) {
  try { fs.unlinkSync(".hermes/truth_kg.json"); } catch {}
  resetKG();
  console.log("  🗑 Truth KG 已清除");
}

const templateName = ((a) => a ? a.split("=")[1] : "tech")(args.find((a) => a.startsWith("--template=")));
const options = { persona: personaName, truthMode, outDir, quality: qualityName, hwAccel: true, template: templateName };

// ══════════════════════════════════════
//  批量模式
// ══════════════════════════════════════
if (batchDir) {
  const results = await batchRender(batchDir, outDir, options, async (file, fileOutDir, opts) => {
    await renderOne(file, fileOutDir, opts);
  });

  const ok = results.filter(r => r.success).length;
  const fail = results.filter(r => !r.success).length;
  console.log(`\n  📊 总计: ${results.length} 文件 | ✅ ${ok} | ❌ ${fail}`);
  if (fail > 0) {
    for (const r of results.filter(r => !r.success)) {
      console.log(`    ❌ ${r.file}: ${r.error}`);
    }
  }
  process.exit(fail > 0 ? 1 : 0);
}

// ══════════════════════════════════════
//  交互式生成: --topic
// ══════════════════════════════════════
if (topic) {
  console.log(`\n  🤖 AI 写稿: "${topic}"\n`);
  const script = await writeScript(topic, { style: "通俗", scenes: 5 });
  const tmpFile = writeTempFile(script);
  console.log(`   📝 脚本已生成 (${script.length} 字符)`);
  console.log(script.slice(0, 300) + "...\n");
  await renderOne(tmpFile, outDir, options);
  try { fs.unlinkSync(tmpFile); } catch {}
  process.exit(0);
}

// ══════════════════════════════════════
//  单文件模式
// ══════════════════════════════════════
const file = args.find((a) => !a.startsWith("--")) || "examples/demo.md";
if (!fs.existsSync(file)) {
  console.error(`✖ 文件未找到: ${file}`);
  process.exit(1);
}

await renderOne(file, outDir, options);
