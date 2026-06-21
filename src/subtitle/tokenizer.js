/**
 * 分词器: 将文本切分为单词序列
 *
 * 支持中文 (逐字+词组) 和英文 (按空格)
 */

/**
 * 判断是否为中文字符
 */
function isChineseChar(c) {
  return c >= '\u4e00' && c <= '\u9fff';
}

/**
 * 将文本切分为单词/词组列表
 *
 * 策略:
 *   - 中文 → 按短句切分 (每个分句作为一个"词", 避免逐字太碎)
 *   - 英文 → 按空格切分
 *   - 混合 → 各按各的规则
 *
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  if (!text) return [];

  // 1. 标准化分隔符
  let s = text
    .replace(/[，。！？、；：""''（）【】《》]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!s) return [];

  // 2. 中英文混合检测
  const hasChinese = /[\u4e00-\u9fff]/.test(s);

  if (hasChinese) {
    return tokenizeChinese(s);
  }

  // 纯英文: 按空格 + 标点拆
  return s.split(/\s+/).filter(Boolean);
}

/**
 * 中文分词: 按标点分句, 长句按字数分块
 */
function tokenizeChinese(text) {
  // 先按空格/标点分成块
  const parts = text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(part => {
      // 如果这个块太长 (>8 字), 按小句再分
      if (/[\u4e00-\u9fff]/.test(part) && part.length > 8) {
        return splitLongChinese(part);
      }
      return [part];
    });

  return parts.filter(Boolean);
}

/**
 * 将长中文按逗号/分号/2-4字词组切分
 */
function splitLongChinese(text) {
  // 按常见停顿词分
  const segments = text.split(/(?<=的|了|是|在|与|和|或|以|及|有|将|对|从|把|被|让|使)/);
  if (segments.length > 1) {
    return segments.map(s => s.trim()).filter(Boolean);
  }
  return [text];
}

/**
 * 统计词数 (用于时间分配)
 */
export function wordCount(text) {
  return tokenize(text).length;
}
