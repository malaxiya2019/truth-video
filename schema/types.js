/**
 * truth-video 核心类型定义 (JSDoc)
 *
 * 所有模块共享的数据结构。
 * 在 VS Code / WebStorm 中可获得完整类型提示。
 */

/**
 * @typedef {'cover'|'slide'} SceneType
 */

/**
 * @typedef {Object} Scene
 * @property {SceneType} type
 * @property {string} title
 * @property {string} body
 * @property {number} index
 */

/**
 * @typedef {Object} AlignedWord
 * @property {string} word
 * @property {number} start       - 开始时间 (秒)
 * @property {number} end         - 结束时间 (秒)
 * @property {number} sceneIndex  - 所属场景
 * @property {number} [score]     - 重点评分 1-3
 * @property {string} [importance] - 'key'|'normal'
 * @property {string} [verified]   - Truth Router: 'verified'|'error'|'questionable'|'unknown'
 * @property {number} [confidence] - 置信度 0-1
 */

/**
 * @typedef {Object} KnowledgeGraph
 * @property {GraphNode[]} nodes
 * @property {GraphEdge[]} edges
 */

/**
 * @typedef {Object} GraphNode
 * @property {string} id
 * @property {string} label
 * @property {'system'|'problem'|'solution'|'concept'|'capability'} type
 * @property {number} confidence
 * @property {number} [sceneIndex]
 * @property {number} weight
 */

/**
 * @typedef {Object} GraphEdge
 * @property {string} from
 * @property {string} to
 * @property {string} relation
 */

/**
 * @typedef {Object} TimelineEntry
 * @property {number} index
 * @property {string} title
 * @property {string} body
 * @property {number} startSec
 * @property {number} endSec
 * @property {number} duration
 * @property {string} [audioFile]
 */

/**
 * @typedef {Object} LecturePlan
 * @property {number} scene_index
 * @property {string} title
 * @property {string} goal       - 教学目的
 * @property {'hook'|'explain'|'deep_dive'|'expand'|'summary'} narrative
 * @property {Array<{word:string, score:number}>} key_terms
 * @property {number} importance
 * @property {number} duration
 */

/**
 * @typedef {Object} Persona
 * @property {string} name
 * @property {string} name_en
 * @property {string} emoji
 * @property {object} tts
 * @property {string} tts.voice_zh
 * @property {string} tts.voice_en
 * @property {number} tts.rate
 * @property {object} pacing
 * @property {number} pacing.pause_after_sentence
 * @property {number} pacing.pause_after_keyword
 * @property {object} highlight
 * @property {number} highlight.threshold
 * @property {object} subtitle
 * @property {number} subtitle.font_size
 * @property {string} subtitle.active_color
 * @property {object} narrative_weight
 */

/**
 * @typedef {Object} FrameMeta
 * @property {string} html       - 完整 HTML 内容
 * @property {'scene'|'transition'} type
 * @property {number} sceneIndex
 * @property {number} duration   - 展示时长 (秒)
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} word
 * @property {number} sceneIndex
 * @property {number} confidence
 * @property {string} [explanation]
 */

/**
 * @typedef {Object} ValidationResult
 * @property {AlignedWord[]} wordResults
 * @property {Object.<number, {total:number, errors:number, questionable:number, verified:number}>} sceneScores
 * @property {ValidationError[]} errors
 * @property {string[]} warnings
 */

/**
 * @typedef {'professor'|'explainer'|'science'|'coach'} PersonaName
 * @typedef {'normal'|'strict'|'off'} TruthMode
 * @typedef {'draft'|'normal'|'high'} QualityMode
 */

/**
 * @typedef {Object} RenderOptions
 * @property {PersonaName} [persona='professor']
 * @property {TruthMode} [truthMode='normal']
 * @property {QualityMode} [quality='normal']
 * @property {string} [outDir='output']
 * @property {boolean} [hwAccel=true]
 */

export default {};
