/**
 * Truth Knowledge Graph — 持久化知识图谱
 *
 * 相比 subtitle/truth.js:
 *   1. 持久化存储 (JSON 文件, 跨会话)
 *   2. 置信度评分 (0.0 ~ 1.0)
 *   3. 来源追踪 (记载每个事实的来源场景)
 *   4. 动态更新 (每次渲染注入新知识)
 */

import fs from "fs";
import path from "path";

const DB_PATH = ".hermes/truth_kg.json";

/**
 * 种子知识库 — 预置高置信度的 AI/LLM 事实
 * 首次启动时自动写入，确保 Truth Router 有基准知识
 */
const SEED_KNOWLEDGE = [
  // ── LLM / AI 基础 ──
  ["llm",       "verified", 0.95, "Large Language Model — 大规模语言模型"],
  ["large language model", "verified", 0.95, "LLM 全称, 基于海量文本训练的神经网络语言模型"],
  ["gpt",       "verified", 0.95, "Generative Pre-trained Transformer — OpenAI 的生成式预训练模型"],
  ["transformer", "verified", 0.90, "Transformer — 基于自注意力机制的神经网络架构, 2017 年提出"],
  ["attention", "verified", 0.85, "Attention 机制 — 让模型关注输入中的重要部分"],
  ["neural network", "verified", 0.90, "神经网络 — 受生物神经元启发的计算模型"],
  ["深度学习",  "verified", 0.90, "Deep Learning — 使用多层神经网络进行机器学习的方法"],

  // ── 大模型幻觉相关 ──
  ["hallucination", "verified", 0.90, "大模型幻觉 — 模型生成看似合理但与事实不符的内容"],
  ["幻觉",     "verified", 0.90, "大模型幻觉 — 模型生成看似合理但与事实不符的内容"],
  ["rag",       "verified", 0.90, "Retrieval-Augmented Generation — 检索增强生成"],
  ["检索增强生成", "verified", 0.85, "RAG 的中文译名, 通过检索外部知识库辅助生成"],
  ["知识图谱",  "verified", 0.90, "Knowledge Graph — 以图结构组织的事实知识库"],
  ["knowledge graph", "verified", 0.85, "知识图谱, 以实体为节点、关系为边的结构化知识库"],

  // ── Truth Router ──
  ["truth",     "verified", 0.95, "Truth Router — 事实校验与可信路由系统"],
  ["truth router", "verified", 0.95, "Truth Router — 通过多源证据和知识图谱验证事实的系统"],
  ["验证器",    "verified", 0.85, "Validator — 校验事实正确性的组件"],
  ["validator", "verified", 0.85, "验证器, 对比事实与知识图谱以判断准确性"],
  ["router",    "verified", 0.80, "Router v6 — 可信路由管道, 调度验证流程"],
  ["可信度",    "verified", 0.80, "置信度评分, 衡量事实可靠性的 0~1 数值"],

  // ── 常见技术概念 ──
  ["api",       "verified", 0.90, "Application Programming Interface — 应用程序编程接口"],
  ["ai",        "verified", 0.85, "Artificial Intelligence — 人工智能"],
  ["人工智能",  "verified", 0.85, "AI 的中文译名"],
  ["ml",        "verified", 0.85, "Machine Learning — 机器学习"],
  ["机器学习",  "verified", 0.85, "Machine Learning 的中文译名"],

  // ── 错误知识 (用于演示校验) ──
  ["error_term", "error", 1.0, "Known error term for testing — 用于测试的错误词条"],
];

/**
 * 知识图谱数据库
 */
class TruthKnowledgeGraph {
  constructor(dbPath = DB_PATH) {
    this.dbPath = dbPath;
    this.data = this._load();
    this._seedIfEmpty();
  }

  /**
   * 如果知识图谱为空, 用种子数据初始化
   */
  _seedIfEmpty() {
    if (Object.keys(this.data.facts).length === 0) {
      console.log("   🌱 Truth KG: seeding knowledge base...");
      for (const [term, status, confidence, explanation] of SEED_KNOWLEDGE) {
        const key = term.toLowerCase().trim();
        this.data.facts[key] = {
          term: key,
          status,
          confidence,
          explanation: explanation || "",
          source: "seed",
          count: 1,
          created_at: Date.now(),
        };
      }
      this._save();
      console.log(`   📚 ${SEED_KNOWLEDGE.length} seed facts loaded`);
    }
  }

  _load() {
    try {
      if (fs.existsSync(this.dbPath)) {
        return JSON.parse(fs.readFileSync(this.dbPath, "utf8"));
      }
    } catch {}
    return {
      version: 2,
      updated_at: Date.now(),
      facts: {},      // term → {status, confidence, source, explanation, count}
      relations: [],  // [{from, to, relation, confidence}]
    };
  }

  _save() {
    try {
      const dir = path.dirname(this.dbPath);
      fs.mkdirSync(dir, { recursive: true });
      this.data.updated_at = Date.now();
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), "utf8");
    } catch (e) {
      console.warn(`  ⚠ Truth KG save failed: ${e.message}`);
    }
  }

  /**
   * 查询一个词条
   */
  lookup(term) {
    const key = term.toLowerCase().trim();
    return this.data.facts[key] || null;
  }

  /**
   * 注册/更新一个事实
   */
  learn(term, status, explanation, source = "", confidence = 0.8) {
    const key = term.toLowerCase().trim();
    if (!key) return;

    if (this.data.facts[key]) {
      // 更新已有
      this.data.facts[key].count += 1;
      this.data.facts[key].confidence = Math.min(1, this.data.facts[key].confidence + 0.1);
      if (status !== "unknown") this.data.facts[key].status = status;
      if (explanation) this.data.facts[key].explanation = explanation;
    } else {
      this.data.facts[key] = {
        term: key,
        status,        // "verified" | "questionable" | "error" | "unknown"
        confidence,
        explanation: explanation || "",
        source: source || "",
        count: 1,
        created_at: Date.now(),
      };
    }
    this._save();
  }

  /**
   * 验证一个词
   */
  verify(term) {
    const result = this.lookup(term);
    if (!result) return { status: "unknown", confidence: 0, explanation: "" };
    return { status: result.status, confidence: result.confidence, explanation: result.explanation };
  }

  /**
   * 添加关系
   */
  addRelation(from, to, relation, confidence = 0.5) {
    this.data.relations.push({
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      relation,
      confidence,
      created_at: Date.now(),
    });
    this._save();
  }

  /**
   * 获取统计
   */
  stats() {
    const facts = this.data.facts;
    const counts = { verified: 0, questionable: 0, error: 0, unknown: 0 };
    for (const f of Object.values(facts)) {
      counts[f.status] = (counts[f.status] || 0) + 1;
    }
    return {
      total_facts: Object.keys(facts).length,
      total_relations: this.data.relations.length,
      ...counts,
    };
  }

  /**
   * 清除所有数据
   */
  clear() {
    this.data = { version: 2, updated_at: Date.now(), facts: {}, relations: [] };
    this._save();
  }
}

// 单例
let _instance = null;
export function getKG(dbPath) {
  if (!_instance) _instance = new TruthKnowledgeGraph(dbPath);
  return _instance;
}

export function resetKG() {
  _instance = null;
}
