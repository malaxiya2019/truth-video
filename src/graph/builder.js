/**
 * 知识图谱构建器: 统一的图构建入口
 *
 * 流程:
 *   text → extractor(实体+关系) → linker(图) → 输出
 *
 * 输出可以直接用于:
 *   - 课程路径规划
 *   - 节点高亮字幕
 *   - 图动画
 */

import { extractEntities, extractRelations } from "./extractor.js";
import { buildGraph, graphStats, graphToText } from "./linker.js";

/**
 * 从场景列表构建知识图谱
 *
 * @param {Array<{title:string, body:string, index:number}>} scenes
 * @returns {{graph, stats, text}}
 */
export function buildKnowledgeGraph(scenes) {
  const allEntities = [];
  const allRelations = [];

  for (const scene of scenes) {
    const text = scene.title + " " + (scene.body || "");
    if (!text.trim()) continue;

    const entities = extractEntities(text);
    const relations = extractRelations(text, entities);

    // 标记场景索引
    entities.forEach((e) => (e.sceneIndex = scene.index));
    allEntities.push(...entities);
    allRelations.push(...relations);
  }

  const graph = buildGraph(allEntities, allRelations);
  const stats = graphStats(graph);
  const text = graphToText(graph);

  return { graph, stats, text };
}
