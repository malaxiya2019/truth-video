/**
 * 核心渲染管线 — 单文件渲染函数
 *
 * 被 cli.js 和 batch.js 共同使用
 */

import { parseMarkdown } from "./parser.js";
import { renderHTML } from "./renderer.js";
import { generateAllAudio } from "./tts.js";
import { buildTimeline, formatTimeline } from "./timeline.js";
import { encodeFromConcat } from "./encode.js";
import { getQuality, buildEncodeArgs } from "./quality.js";
import { smartAlignAllScenes } from "./subtitle/aligner.js";
import { analyzeKeywords } from "./subtitle/keywords.js";
import { createValidator } from "./truth/validator.js";
import { learnFromScenes } from "./truth/extractor.js";
import { getKG } from "./truth/kg.js";
import { toSRT, toASS, toKaraokeASS, toIntelligentASS, toLectureASS } from "./subtitle/generator.js";
import { burnSubtitle } from "./subtitle/burnin.js";
import { planLecture } from "./lecture/planner.js";
import { buildLectureTimeline, formatLectureTimeline } from "./lecture/timeline.js";
import { getPersona } from "./lecture/persona.js";
import { buildKnowledgeGraph } from "./graph/builder.js";
import { precomputeScenePositions, generateFrameSequence } from "./motion/graph_focus.js";
import { captureFrameSequence } from "./capture_graph.js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

/**
 * 渲染单个 Markdown 文件为教学视频
 *
 * @param {string} file    - .md 文件路径
 * @param {string} outDir  - 输出目录
 * @param {object} options
 * @param {string} options.persona   - 讲师人格
 * @param {string} options.truthMode - Truth Router 模式
 * @param {string} options.quality   - 画质 (draft|normal|high)
 * @param {boolean} options.hwAccel  - 是否启用 GPU 加速
 */
export async function renderOne(file, outDir, options = {}) {
  const persona = getPersona(options.persona || "professor");
  const truthMode = options.truthMode || "normal";
  const qualityName = options.quality || "normal";
  const hwAccel = options.hwAccel !== false;
  const qualityConfig = getQuality(qualityName);
  const startTime = Date.now();

  console.log(`\n  🎓 truth-video  —  "${path.basename(file)}"`);
  console.log(`  ${persona.emoji} ${persona.name}  —  ${persona.description}\n`);

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync("renders", { recursive: true });

  // 1. 解析
  process.stdout.write("1. 解析 Markdown... ");
  const scenes = parseMarkdown(file);
  console.log(`${scenes.length} 场景`);

  // 2. 知识图谱
  process.stdout.write("2. 构建知识图谱... ");
  const { graph, stats } = buildKnowledgeGraph(scenes);
  console.log(`${stats.nodes} 节点, ${stats.edges} 边`);

  const kg = getKG();
  const kgBefore = kg.stats().total_facts;
  learnFromScenes(scenes, file);
  const kgAfter = kg.stats().total_facts;
  if (kgAfter - kgBefore > 0) console.log(`   Truth Router: 学习 ${kgAfter - kgBefore} 个新事实 (共 ${kgAfter} 个)`);

  // 保存图谱数据到输出目录 (供交互播放器使用)
  const kgDataPath = path.join(outDir, "knowledge-graph.json");
  fs.writeFileSync(kgDataPath, JSON.stringify({ graph, stats, scenes, kgStats: kg.stats() }, null, 2), "utf8");

  // 3. HTML
  process.stdout.write("3. 渲染 HTML... ");
  renderHTML(scenes, `${outDir}/video.html`);
  console.log("OK");

  // 4. 帧序列
  process.stdout.write("4. 生成动画帧序列... ");
  const scenePositions = precomputeScenePositions(graph, scenes);
  const templateName = options.template || "tech";
  // 动态分配每场景时长: 默认每场景 3s (过渡帧另计 0.5s/段)
  const defaultSceneDur = scenes.map(() => 3.0);
  const frameMetas = generateFrameSequence(graph, scenePositions, 8, defaultSceneDur, templateName);
  const totalFrameDur = frameMetas.reduce((s, f) => s + f.duration, 0);
  console.log(`${frameMetas.length} 帧 (${totalFrameDur.toFixed(1)}s)`);

  // 5. 截图
  console.log("5. Playwright 截取帧序列...");
  const vpW = Math.round(1280 * qualityConfig.viewportScale);
  const vpH = Math.round(720 * qualityConfig.viewportScale);
  const scaleFactor = qualityName === "high" ? 2 : 1;
  console.log(`   ${vpW}x${vpH} @${scaleFactor}x`);
  const { concatFile } = await captureFrameSequence(frameMetas, "renders", vpW, vpH, scaleFactor);

  // 6. TTS
  console.log("6. 生成语音...");
  const audioFiles = await generateAllAudio(scenes);
  console.log(`   ${audioFiles.length} 音频文件`);

  // 7. 时间轴
  console.log("7. 构建时间轴...");
  const timeline = buildTimeline(audioFiles, scenes);
  console.log(formatTimeline(timeline));

  // 8. 编码
  console.log("8. 编码视频...");
  const hasAudio = audioFiles.some((f) => fs.statSync(f).size > 1024);
  let audioFile = null;
  if (hasAudio) {
    const lines = timeline.filter(t => t.audioFile && fs.existsSync(t.audioFile))
      .map(t => `file '${path.resolve(t.audioFile)}'`);
    fs.writeFileSync("renders/audio_concat.txt", lines.join("\n"), "utf8");
    execSync(`ffmpeg -y -f concat -safe 0 -i renders/audio_concat.txt -c copy renders/audio_mixed.wav`,
      { stdio: "ignore", timeout: 30_000 });
    try { fs.unlinkSync("renders/audio_concat.txt"); } catch {}
    audioFile = "renders/audio_mixed.wav";
    console.log("   ✔ 音频已合并");
  }
  const encodeOpts = buildEncodeArgs(qualityName, audioFile, `${outDir}/video.mp4`, hwAccel);
  await encodeFromConcat(concatFile, audioFile, `${outDir}/video.mp4`, encodeOpts);

  // 9. 讲课规划
  console.log("9. 讲课规划...");
  const lecturePlan = planLecture(scenes);
  const totalDuration = timeline.reduce((s, t) => s + t.duration, 0);
  const lectureTimeline = buildLectureTimeline(lecturePlan, totalDuration, persona);
  console.log(formatLectureTimeline(lectureTimeline));

  // 10. 字幕
  console.log("10. 生成字幕...");
  const sceneTimeline = lectureTimeline.map((t) => ({
    title: t.title, body: scenes[t.scene_index]?.body || "", duration: t.duration,
  }));
  const alignedWords = smartAlignAllScenes(sceneTimeline, persona);
  const enrichedWords = analyzeKeywords(scenes, alignedWords);
  const validator = createValidator(truthMode);
  const { words: verifiedWords, result: truthResult } = validator.validateAll(enrichedWords, scenes);
  console.log(`   Truth Router: ${truthMode} 模式`);
  if (truthResult.warnings.length > 0) {
    for (const w of truthResult.warnings) console.log(`   ⚠ ${w}`);
  }
  // 从当前校验结果计算统计 (而非全局 kg.stats())
  const sceneScores = Object.values(truthResult.sceneScores);
  const currentStats = {
    total: sceneScores.reduce((s, v) => s + v.total, 0),
    verified: sceneScores.reduce((s, v) => s + (v.verified || 0), 0),
    error: sceneScores.reduce((s, v) => s + (v.errors || 0), 0),
    questionable: sceneScores.reduce((s, v) => s + (v.questionable || 0), 0),
  };
  console.log(`   当前校验: ${currentStats.verified} ✓  ${currentStats.error} ✗  ${currentStats.questionable} ?  (共 ${currentStats.total} 词)`);

  fs.writeFileSync(`${outDir}/subtitles.srt`, toSRT(alignedWords), "utf8");
  fs.writeFileSync(`${outDir}/subtitles.ass`, toASS(alignedWords), "utf8");
  fs.writeFileSync(`${outDir}/subtitles_karaoke.ass`, toKaraokeASS(alignedWords), "utf8");
  fs.writeFileSync(`${outDir}/subtitles_intelligent.ass`, toIntelligentASS(verifiedWords), "utf8");
  fs.writeFileSync(`${outDir}/subtitles_lecture.ass`, toLectureASS(verifiedWords, persona), "utf8");
  console.log("   ✔ 5 个字幕文件");

  // 11. 烧录
  console.log("11. 烧录字幕...");
  burnSubtitle(`${outDir}/video.mp4`, `${outDir}/subtitles.srt`, `${outDir}/video_sub.mp4`);
  burnSubtitle(`${outDir}/video.mp4`, `${outDir}/subtitles_karaoke.ass`, `${outDir}/video_karaoke.mp4`);
  burnSubtitle(`${outDir}/video.mp4`, `${outDir}/subtitles_intelligent.ass`, `${outDir}/video_intelligent.mp4`);
  burnSubtitle(`${outDir}/video.mp4`, `${outDir}/subtitles_lecture.ass`, `${outDir}/video_lecture.mp4`);

  // ── 报告 ──
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  ✨ 完成! (${elapsed}s)`);
  const sizes = [
    `${outDir}/video.mp4`, `${outDir}/video_sub.mp4`,
    `${outDir}/video_karaoke.mp4`, `${outDir}/video_intelligent.mp4`, `${outDir}/video_lecture.mp4`,
  ];
  for (const f of sizes) {
    if (fs.existsSync(f)) {
      const size = (fs.statSync(f).size / 1024).toFixed(0);
      console.log(`     ${path.basename(f).padEnd(25)} ${size} KB`);
    }
  }
  if (truthResult.errors.length > 0) {
    console.log(`\n  🔍 Truth Router 发现 ${truthResult.errors.length} 个待关注项:`);
    for (const e of truthResult.errors.slice(0, 3)) {
      console.log(`    ✗ "${e.word}" — ${e.explanation || "待验证"}`);
    }
    if (truthResult.errors.length > 3) console.log(`    ... 还有 ${truthResult.errors.length - 3} 个`);
  }
  console.log();
}
