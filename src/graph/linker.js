/**
 * 实体连接器: 将实体通过关系连接为图
 *
 * 输入: 实体列表 + 关系列表
 * 输出: 完整的图结构 (nodes + edges)
 * 附加: 邻居推荐、路径规划
 */

/**
 * 构建知识图谱
 *
 * @param {Array} entities  - [{word, type, confidence}]
 * @param {Array} relations - [{from, to, relation}]
 * @returns {{nodes: Array, edges: Array}}
 */
export function buildGraph(entities, relations) {
  const nodeMap = new Map();
  const edgeSet = new Set();

  // 去重节点
  for (const e of entities) {
    const id = e.word.toLowerCase().replace(/\s+/g, "_");
    if (!nodeMap.has(id)) {
      nodeMap.set(id, {
        id,
        label: e.word,
        type: e.type || "concept",
        confidence: e.confidence || 0.5,
        sceneIndex: e.sceneIndex ?? -1,
        weight: 1,
      });
    } else {
      nodeMap.get(id).weight += 1;
    }
  }

  // 去重边
  for (const r of relations) {
    const fromId = r.from.toLowerCase().replace(/\s+/g, "_");
    const toId = r.to.toLowerCase().replace(/\s+/g, "_");
    const edgeKey = `${fromId}→${toId}`;

    if (!edgeSet.has(edgeKey) && nodeMap.has(fromId) && nodeMap.has(toId)) {
      edgeSet.add(edgeKey);
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeSet).map((key) => {
      const [from, to] = key.split("→");
      return { from, to, relation: "related_to" };
    }),
  };
}

/**
 * 获取节点的邻居
 *
 * @param {string} nodeId
 * @param {{nodes:Array, edges:Array}} graph
 * @returns {Array<{node, edge}>}
 */
export function getNeighbors(nodeId, graph) {
  const neighbors = [];

  for (const edge of graph.edges) {
    if (edge.from === nodeId) {
      const node = graph.nodes.find((n) => n.id === edge.to);
      if (node) neighbors.push({ node, edge, direction: "out" });
    }
    if (edge.to === nodeId) {
      const node = graph.nodes.find((n) => n.id === edge.from);
      if (node) neighbors.push({ node, edge, direction: "in" });
    }
  }

  return neighbors;
}

/**
 * 按重要性排序节点
 */
export function getImportantNodes(graph, topK = 10) {
  return [...graph.nodes]
    .sort((a, b) => {
      // 权重 + 连接数
      const aDegree = graph.edges.filter((e) => e.from === a.id || e.to === a.id).length;
      const bDegree = graph.edges.filter((e) => e.from === b.id || e.to === b.id).length;
      return b.weight + bDegree - (a.weight + a.degree);
    })
    .slice(0, topK);
}

/**
 * 生成图统计
 */
export function graphStats(graph) {
  const typeCount = {};
  for (const n of graph.nodes) {
    typeCount[n.type] = (typeCount[n.type] || 0) + 1;
  }

  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    types: typeCount,
    density: graph.edges.length / Math.max(1, graph.nodes.length),
  };
}

/**
 * 格式化图可视化
 */
export function graphToText(graph) {
  const lines = ["知识图谱:"];

  for (const n of graph.nodes) {
    const neighbors = getNeighbors(n.id, graph);
    if (neighbors.length > 0) {
      const conn = neighbors
        .slice(0, 4)
        .map((nb) => `${nb.node.label}(${nb.direction === "out" ? "→" : "←"})`)
        .join(", ");
      lines.push(`  ${n.label} [${n.type}] → ${conn}`);
    } else {
      lines.push(`  ${n.label} [${n.type}]`);
    }
  }

  return lines.join("\n");
}
