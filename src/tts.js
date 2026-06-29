import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

/**
 * TTS: 为每个场景生成自然语音音频
 *
 * 引擎优先级:
 *   1. edge-tts — 微软神经语音, 中英文都好, 免费
 *   2. OPENAI_API_KEY — OpenAI TTS (需付费)
 *   3. espeak — 降级, 机器人音 (Termux 可用)
 */

let _ttsEngine = null;

function detectTTS() {
  if (_ttsEngine) return _ttsEngine;

  // edge-tts: 仅检测二进制是否存在, 不联网查询列表 (避免超时)
  try {
    execSync("which edge-tts", { stdio: "pipe" });
    // 快速验证: 仅请求1行帮助
    execSync("edge-tts --help 2>/dev/null | head -1", { stdio: "pipe", timeout: 5_000 });
    _ttsEngine = "edge";
    return _ttsEngine;
  } catch {}

  try { execSync("which espeak", { stdio: "pipe" }); _ttsEngine = "espeak"; return _ttsEngine; } catch {}
  try { execSync("which say", { stdio: "pipe" }); _ttsEngine = "say"; return _ttsEngine; } catch {}

  _ttsEngine = "silence";
  return _ttsEngine;
}

function hasChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

function pickVoice(text) {
  if (hasChinese(text)) return "zh-CN-XiaoxiaoNeural";
  return "en-US-AriaNeural";
}

async function generateAudio(text, out, index) {
  const engine = detectTTS();

  if (engine === "edge") {
    try {
      const voice = pickVoice(text);
      const tmpMp3 = out.replace(/\.wav$/, ".mp3");
      execSync(
        `edge-tts --voice "${voice}" --text "${text.replace(/"/g, '\\"')}" --write-media "${tmpMp3}"`,
        { stdio: "ignore", timeout: 60_000 }
      );
      execSync(
        `ffmpeg -y -i "${tmpMp3}" -ac 1 -ar 22050 "${out}"`,
        { stdio: "ignore", timeout: 10_000 }
      );
      try { fs.unlinkSync(tmpMp3); } catch {}
      console.log(`  [${index}] edge-tts (${voice}) → ${path.basename(out)}`);
      return;
    } catch (e) {
      console.log(`  [${index}] edge-tts failed (${e.message}), fallback...`);
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI();
      const resp = await openai.audio.speech.create({
        model: "tts-1", voice: "alloy", input: text,
      });
      const buffer = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(out, buffer);
      console.log(`  [${index}] OpenAI TTS → ${path.basename(out)}`);
      return;
    } catch (e) {
      console.log(`  [${index}] OpenAI TTS failed (${e.message}), fallback...`);
    }
  }

  if (engine === "espeak") {
    const tmp = path.join(os.tmpdir(), `tts_${index}.txt`);
    fs.writeFileSync(tmp, text, "utf8");
    execSync(`espeak -w "${out}" -f "${tmp}"`, { stdio: "ignore", timeout: 30_000 });
    fs.unlinkSync(tmp);
    console.log(`  [${index}] espeak → ${path.basename(out)}`);
    return;
  }

  if (engine === "say") {
    execSync(
      `say -o "${out}" --data-format=LEI16@22050 "${text}"`,
      { stdio: "ignore", timeout: 30_000 }
    );
    console.log(`  [${index}] say → ${path.basename(out)}`);
    return;
  }

  console.log(`  [${index}] (no TTS engine) → silence`);
  execSync(
    `ffmpeg -y -f lavfi -i anullsrc=r=22050:cl=mono -t 3 "${out}"`,
    { stdio: "ignore", timeout: 10_000 }
  );
}

export async function generateAllAudio(scenes, dir = "renders") {
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (let i = 0; i < scenes.length; i++) {
    const text = scenes[i].title + (scenes[i].body ? "。 " + scenes[i].body : "");
    const out = path.join(dir, `audio_${String(i).padStart(3, "0")}.wav`);
    await generateAudio(text, out, i);
    files.push(out);
  }
  return files;
}
