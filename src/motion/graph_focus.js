/**
 * Graph Focus Engine v3 — 力导向布局 + 中文优化 + 节点间动画过渡
 *
 * 新增:
 *   6. 预计算所有场景的节点位置
 *   7. lerp 插值生成过渡帧
 *   8. 帧元数据 (scene frame / transition frame / duration)
 */

import fs from "fs";
import { getTemplate } from "../templates/index.js";

const W = 1280, H = 720;
const CX = W / 2, CY = H / 2;

function hasChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

function getNodeRadius(label, isActive, isConn) {
  const base = isActive ? 48 : isConn ? 30 : 20;
  const cn = hasChinese(label) ? (isActive ? 8 : 4) : 0;
  return base + cn;
}

function getFontSize(label, isActive) {
  if (isActive) return hasChinese(label) ? 20 : 16;
  return hasChinese(label) ? 14 : 12;
}

// ── 力导向布局 ──

function forceDirectedLayout(nodes, edges, activeIds, connectedIds) {
  const hasCN = nodes.some((n) => hasChinese(n.label));
  const REPULSION = hasCN ? 12000 : 8000;
  const ATTRACTION = 0.005;
  const GRAVITY = 0.01;
  const IDEAL_LENGTH = hasCN ? 180 : 150;
  const DAMPING = 0.85;
  const ITERATIONS = 60;

  const pos = {};
  for (const n of nodes) {
    if (activeIds.has(n.id)) {
      pos[n.id] = { x: CX + (Math.random() - 0.5) * 60, y: CY + (Math.random() - 0.5) * 60 };
    } else if (connectedIds.has(n.id)) {
      pos[n.id] = { x: CX + (Math.random() - 0.5) * 200, y: CY + (Math.random() - 0.5) * 150 };
    } else {
      pos[n.id] = { x: Math.random() * W, y: Math.random() * H };
    }
  }

  const vel = {};
  for (const n of nodes) vel[n.id] = { x: 0, y: 0 };

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (const n of nodes) {
      let fx = 0, fy = 0;
      const p1 = pos[n.id];
      for (const other of nodes) {
        if (other.id === n.id) continue;
        const p2 = pos[other.id];
        let dx = p1.x - p2.x, dy = p1.y - p2.y;
        let dist = Math.sqrt(dx * dx + dy * dy) + 1;
        const force = REPULSION / (dist * dist);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }
      for (const edge of edges) {
        let target = null;
        if (edge.from === n.id) target = pos[edge.to];
        if (edge.to === n.id) target = pos[edge.from];
        if (!target) continue;
        let dx = target.x - p1.x, dy = target.y - p1.y;
        let dist = Math.sqrt(dx * dx + dy * dy) + 1;
        const displacement = dist - IDEAL_LENGTH;
        fx += (dx / dist) * displacement * ATTRACTION;
        fy += (dy / dist) * displacement * ATTRACTION;
      }
      fx += (CX - p1.x) * GRAVITY;
      fy += (CY - p1.y) * GRAVITY;
      vel[n.id].x = (vel[n.id].x + fx) * DAMPING;
      vel[n.id].y = (vel[n.id].y + fy) * DAMPING;
      p1.x += vel[n.id].x;
      p1.y += vel[n.id].y;
      p1.x = Math.max(60, Math.min(W - 60, p1.x));
      p1.y = Math.max(60, Math.min(H - 60, p1.y));
    }
  }
  return pos;
}

// ── 模板颜色 ──

let _template = null;

function getNodeColors() {
  const t = _template || getTemplate("tech");
  return {
    system:     { ...t.node.system,     label: "系统" },
    problem:    { ...t.node.problem,    label: "问题" },
    solution:   { ...t.node.solution,   label: "方案" },
    concept:    { ...t.node.concept,    label: "概念" },
    capability: { ...t.node.capability, label: "能力" },
  };
}

function nodeColor(type, state) {
  const colors = getNodeColors();
  const c = colors[type] || colors.concept;
  return c[state] || c.active;
}

function getTemplateObj() {
  return _template || getTemplate("tech");
}

// ── 插值 ──

function lerp(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function interpolatePositions(posA, posB, t) {
  const result = {};
  for (const id of Object.keys(posA)) {
    if (posB[id]) {
      result[id] = lerp(posA[id], posB[id], t);
    } else {
      result[id] = { ...posA[id] };
    }
  }
  for (const id of Object.keys(posB)) {
    if (!result[id]) result[id] = { ...posB[id] };
  }
  return result;
}

// ── SVG 渲染 ──

function renderSVG(graph, pos, activeIds, connectedIds, templateName = "tech") {
  _template = getTemplate(templateName);
  const t = _template;
  const colors = getNodeColors();
  const activeSet = new Set(activeIds);
  const connSet = new Set(connectedIds);
  const hasCN = graph.nodes.some((n) => hasChinese(n.label));
  const fontFamily = hasCN ? "'WenQuanYi Zen Hei',sans-serif" : "sans-serif";

  const edgesSVG = graph.edges
    .filter((e) => pos[e.from] && pos[e.to])
    .map((e) => {
      const p1 = pos[e.from], p2 = pos[e.to];
      const isActive = activeSet.has(e.from) || activeSet.has(e.to);
      const opacity = isActive ? 0.6 : 0.1;
      const strokeW = isActive ? 2.5 : 1;
      const mx = (p1.x + p2.x) / 2 + (Math.random() - 0.5) * 20;
      const my = (p1.y + p2.y) / 2 - 30;
      const edgeColor = isActive ? t.edgeColor : "#444";
      return `<path d="M${p1.x},${p1.y} Q${mx},${my} ${p2.x},${p2.y}" fill="none" stroke="${edgeColor}" stroke-width="${strokeW}" stroke-opacity="${opacity}" marker-end="url(#arrow)"/>`;
    })
    .join("\n");

  const nodeLabels = Object.keys(colors);
  const glowIntensity = t.glowIntensity;

  const nodesSVG = graph.nodes
    .filter((n) => pos[n.id])
    .map((n) => {
      const p = pos[n.id];
      const isActive = activeSet.has(n.id);
      const isConn = connSet.has(n.id);
      let state = "dim";
      if (isActive) state = "active";
      else if (isConn) state = "connected";
      const color = nodeColor(n.type, state);
      const r = getNodeRadius(n.label, isActive, isConn);
      const opacity = isActive ? 1 : isConn ? 0.7 : 0.15;
      const fontSize = getFontSize(n.label, isActive);
      const strokeW = isActive ? 3 : 1;
      const isCN = hasChinese(n.label);
      const textY = p.y + (isCN ? fontSize * 0.35 : 4);
      const textColor = t.text;
      const glowId = `glow-${n.id.replace(/[^a-zA-Z0-9]/g, "")}`;
      let glow = "";
      if (isActive && glowIntensity > 0) {
        glow = `<radialGradient id="${glowId}"><stop offset="0%" stop-color="${color}" stop-opacity="${glowIntensity}"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
      }
      return `
        ${glow ? `<defs>${glow}</defs>` : ""}
        ${glow ? `<circle cx="${p.x}" cy="${p.y}" r="${r + 35}" fill="url(#${glowId})"/>` : ""}
        <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${color}" fill-opacity="${opacity}" stroke="${textColor}" stroke-width="${strokeW}" stroke-opacity="${opacity}" />
        <text x="${p.x}" y="${textY}" text-anchor="middle" fill="${textColor}" font-size="${fontSize}" font-weight="${isActive ? "bold" : "normal}"} opacity="${opacity}" font-family="${fontFamily}">${n.label}</text>
      `;
    })
    .join("\n");

  const legendSVG = `
    <g transform="translate(1090, 640)">
      <rect x="-10" y="-10" width="180" height="${nodeLabels.length * 22 + 25}" rx="8" fill="${t.legendBg}" fill-opacity="0.85"/>
      <text x="0" y="10" fill="${t.text}" opacity="0.6" font-size="12" font-weight="bold" font-family="${fontFamily}">图例</text>
      ${Object.entries(colors).map(([type, v], i) =>
        `<circle cx="5" cy="${28 + i * 20}" r="5" fill="${v.active}"/><text x="16" y="${32 + i * 20}" fill="${t.text}" opacity="0.7" font-size="11" font-family="${fontFamily}">${v.label}</text>`
      ).join("\n")}
    </g>
  `;

  const bgFrom = t.bg.gradient[0];
  const bgTo = t.bg.gradient[1];
  const bgGlowColor = t.bg.glow;

  return `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="font-family:${fontFamily}">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="${t.edgeColor}" fill-opacity="0.5"/>
        </marker>
        <radialGradient id="bgGlow"><stop offset="0%" stop-color="${bgGlowColor}" stop-opacity="0.6"/><stop offset="100%" stop-color="${bgTo}" stop-opacity="1"/></radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="${bgTo}"/>
      <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>
      ${edgesSVG}
      ${nodesSVG}
      ${legendSVG}
    </svg>
  `;
}

// ── 核心 API ──

/**
 * 预计算所有场景的节点位置
 *
 * @param {object} graph
 * @param {Array<{title:string, body:string}>} scenes
 * @returns {Array<{pos: object, activeIds: string[], connectedIds: string[], title: string}>}
 */
export function precomputeScenePositions(graph, scenes) {
  return scenes.map((scene) => {
    const text = scene.title + " " + (scene.body || "");
    const sceneWords = text.toLowerCase().split(/\s+/).filter(Boolean);
    const activeNodes = graph.nodes.filter((n) =>
      sceneWords.some((w) => n.label.toLowerCase().includes(w) || w.includes(n.label.toLowerCase()))
    );
    const activeIds = activeNodes.map((n) => n.id);
    const connectedIds = [];
    for (const edge of graph.edges) {
      if (activeIds.includes(edge.from) && !activeIds.includes(edge.to)) connectedIds.push(edge.to);
      if (activeIds.includes(edge.to) && !activeIds.includes(edge.from)) connectedIds.push(edge.from);
    }
    const pos = forceDirectedLayout(graph.nodes, graph.edges, new Set(activeIds), new Set(connectedIds));
    return { pos, activeIds, connectedIds, title: scene.title };
  });
}

/**
 * 生成完整的帧序列 (场景帧 + 过渡帧)
 *
 * @param {object} graph
 * @param {Array} scenePositions - precomputeScenePositions 的输出
 * @param {number} transitionSteps - 每两场景间的过渡帧数
 * @param {Array<number>} [sceneDurations] - 每个场景的时长 (秒), 默认 3s
 * @returns {Array<{html:string, type:'scene'|'transition', sceneIndex:number, duration:number}>}
 */
export function generateFrameSequence(graph, scenePositions, transitionSteps = 8, sceneDurations = null, templateName = "tech") {
  const frames = [];
  const TRANSITION_DUR = 0.5;
  const transStepDur = TRANSITION_DUR / transitionSteps;

  for (let i = 0; i < scenePositions.length; i++) {
    const current = scenePositions[i];
    const sceneDur = (sceneDurations && sceneDurations[i]) || 3.0;

    const sceneSvg = renderSVG(graph, current.pos, current.activeIds, current.connectedIds, templateName);
    const sceneHtml = wrapHtml(sceneSvg, current.title, templateName);
    frames.push({ html: sceneHtml, type: "scene", sceneIndex: i, duration: Math.max(0.5, sceneDur - TRANSITION_DUR) });

    // 过渡帧: 当前 → 下一个
    if (i < scenePositions.length - 1) {
      const next = scenePositions[i + 1];
      for (let step = 1; step <= transitionSteps; step++) {
        const t = step / (transitionSteps + 1);
        const interpPos = interpolatePositions(current.pos, next.pos, t);

        // 过渡中逐渐切换到下一个场景的活跃节点
        const activeBlend = t > 0.5 ? next.activeIds : current.activeIds;
        const connBlend = t > 0.5 ? next.connectedIds : current.connectedIds;

        const transSvg = renderSVG(graph, interpPos, activeBlend, connBlend, templateName);
        const transHtml = wrapHtml(transSvg, `${current.title} → ${next.title}`, templateName);
        frames.push({ html: transHtml, type: "transition", sceneIndex: i, duration: transStepDur });
      }
    }
  }

  return frames;
}

function wrapHtml(svg, title, templateName = "tech") {
  const isCN = hasChinese(title);
  const t = getTemplate(templateName);
  const ZH_FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc";
  const bodyBg = t.bg.gradient[1];
  const textColor = t.text;
  const titleBg = t.titleBg;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{margin:0;background:${bodyBg};overflow:hidden;width:1280px;height:720px}
@font-face{font-family:'WenQuanYi Zen Hei';src:url('${ZH_FONT}') format('truetype')}
</style></head><body>
<div class="title" style="position:absolute;top:25px;left:50%;transform:translateX(-50%);color:${textColor};font-size:${isCN ? 28 : 26}px;font-weight:bold;text-align:center;text-shadow:0 0 30px rgba(0,0,0,0.9);background:${titleBg};padding:8px 24px;border-radius:8px;z-index:10;font-family:'WenQuanYi Zen Hei',sans-serif">${title}</div>
${svg}
</body></html>`;
}

/**
 * 将帧序列写入 HTML 文件 (用于预览)
 */
export function writeFrameFiles(frames, dir = "output") {
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (let i = 0; i < frames.length; i++) {
    const out = `${dir}/graph_seq_${String(i).padStart(4, "0")}.html`;
    fs.writeFileSync(out, frames[i].html, "utf8");
    files.push(out);
  }
  return files;
}

// ── 兼容旧 API ──

export function renderGraphFrame(graph, sceneText, title, outPath) {
  const scenes = [{ title, body: sceneText.replace(title, "") }];
  const positions = precomputeScenePositions(graph, scenes);
  const frames = generateFrameSequence(graph, positions, 0); // no transitions
  fs.writeFileSync(outPath, frames[0].html, "utf8");
}

export function renderAllGraphFrames(graph, scenes) {
  const positions = precomputeScenePositions(graph, scenes);
  const frames = generateFrameSequence(graph, positions, 0);
  const files = writeFrameFiles(frames, "output");
  // 重命名为 graph_frame_X.html 保持兼容
  for (let i = 0; i < scenes.length; i++) {
    const src = `output/graph_seq_${String(i).padStart(4, "0")}.html`;
    const dst = `output/graph_frame_${i}.html`;
    if (fs.existsSync(src)) fs.renameSync(src, dst);
  }
  return scenes.map((_, i) => `output/graph_frame_${i}.html`);
}
