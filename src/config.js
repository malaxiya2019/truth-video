/**
 * 配置层 — 从文件 + CLI 参数合并配置
 *
 * 优先级: CLI 参数 > 配置文件 > 默认值
 *
 * 配置查找路径:
 *   1. .truth-video.json (项目根)
 *   2. ~/.config/truth-video/config.json (用户级)
 */

import fs from "fs";
import path from "path";
import os from "os";

/** 默认配置 */
const DEFAULTS = {
  persona: "professor",
  truthMode: "normal",
  quality: "normal",
  outDir: "output",
  hwAccel: true,
  tts: {
    engine: "edge-tts",
    rate: 1.0,
    pitch: 1.0,
  },
  subtitle: {
    formats: ["srt", "ass", "karaoke", "intelligent", "lecture"],
    burnIn: true,
  },
  graph: {
    transitionSteps: 8,
    transitionDuration: 0.5,
    forceIterations: 60,
  },
  batch: {
    parallel: false,
    stopOnError: false,
  },
};

/**
 * 查找并加载配置文件
 */
function loadConfigFile() {
  const searchPaths = [
    path.join(process.cwd(), ".truth-video.json"),
    path.join(os.homedir(), ".config", "truth-video", "config.json"),
  ];

  for (const p of searchPaths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf8");
        const config = JSON.parse(raw);
        console.log(`   ⚙ 配置: ${p}`);
        return config;
      }
    } catch (e) {
      console.warn(`   ⚠ 配置加载失败: ${p} (${e.message})`);
    }
  }
  return {};
}

/**
 * 合并配置 (CLI 参数覆盖配置文件)
 *
 * @param {object} cliArgs - 从 CLI 解析的参数
 * @returns {object} 完整配置
 */
export function resolveConfig(cliArgs = {}) {
  const fileConfig = loadConfigFile();
  const merged = { ...DEFAULTS };

  // 文件配置
  for (const key of Object.keys(fileConfig)) {
    if (typeof fileConfig[key] === "object" && !Array.isArray(fileConfig[key])) {
      merged[key] = { ...merged[key], ...fileConfig[key] };
    } else {
      merged[key] = fileConfig[key];
    }
  }

  // CLI 参数覆盖 (只覆盖非 undefined 的值)
  for (const key of Object.keys(cliArgs)) {
    if (cliArgs[key] !== undefined && cliArgs[key] !== null) {
      merged[key] = cliArgs[key];
    }
  }

  return merged;
}

/**
 * 生成默认配置文件
 */
export function generateDefaultConfig(outPath = ".truth-video.json") {
  const config = {
    $schema: "./schema/config-schema.json",
    ...DEFAULTS,
    _description: "truth-video 项目配置",
    _docs: "https://github.com/truth-video/docs",
  };
  fs.writeFileSync(outPath, JSON.stringify(config, null, 2), "utf8");
  console.log(`  ✔ 默认配置已生成: ${outPath}`);
}

/**
 * 从 CLI 参数构建配置
 */
export function configFromArgs(args) {
  const persona = ((a) => a ? a.split("=")[1] : undefined)(args.find((a) => a.startsWith("--persona=")));
  const truthMode = ((a) => a ? a.split("=")[1] : undefined)(args.find((a) => a.startsWith("--truth-mode=")));
  const qualityName = ((a) => a ? a.split("=")[1] : undefined)(args.find((a) => a.startsWith("--quality=")));
  const outDir = ((a) => a ? a.split("=")[1] : undefined)(args.find((a) => a.startsWith("--out=")));

  return resolveConfig({
    persona,
    truthMode,
    quality: qualityName,
    outDir,
  });
}
