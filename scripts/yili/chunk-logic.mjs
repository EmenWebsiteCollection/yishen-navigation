// scripts/yili/chunk-logic.mjs
// 依力语料「句群切块」纯逻辑（零依赖，Node 直跑可测）
//
// 目标：把流水式口语语料切成 400-800 字/块的「句群」，
//       保留语气词/口癖，不做任何重写；相邻块重叠 1 句保证语义连续。

export const SENTENCE_END = /[。！？…]+[”’」』）】]*/g;

// 按句子结束标点切句，保留标点。
// 输入为纯文本；换行视为软边界（直接并入，句子以标点为准）。
export function splitIntoSentences(text) {
  const t = String(text || '');
  const out = [];
  let last = 0;
  SENTENCE_END.lastIndex = 0;
  let m;
  while ((m = SENTENCE_END.exec(t)) !== null) {
    const end = m.index + m[0].length;
    const piece = t.slice(last, end).trim();
    if (piece) out.push(piece);
    last = end;
  }
  const tail = t.slice(last).trim();
  if (tail) out.push(tail);
  return out;
}

// 超长单句（> maxChars）：按次要标点（，、；：）切成子片，尽量 ≤ maxChars。
export function splitLongSentence(sentence, maxChars) {
  if (sentence.length <= maxChars) return [sentence];
  const parts = sentence.split(/(?<=[，、；：])/); // 保留分隔符
  const out = [];
  let cur = '';
  for (const p of parts) {
    if (cur && cur.length + p.length > maxChars) {
      if (cur) out.push(cur);
      cur = p;
    } else {
      cur += p;
    }
  }
  if (cur) out.push(cur);
  // 兜底：极端情况仍超长则硬切
  const final = [];
  for (const c of out) {
    if (c.length <= maxChars) final.push(c);
    else {
      for (let i = 0; i < c.length; i += maxChars) final.push(c.slice(i, i + maxChars));
    }
  }
  return final;
}

// 句群切块：贪心聚合句子到 [minChars, maxChars]。
// overlap=true 时，相邻两块共享前一块的最后一句（保证语义连续）。
export function buildChunks(sentences, { minChars = 400, maxChars = 800, overlap = true } = {}) {
  const chunks = [];
  let cur = [];
  let curLen = 0;

  const flush = () => {
    if (cur.length === 0) return;
    chunks.push(cur.join(''));
    cur = [];
    curLen = 0;
  };

  for (const s of sentences) {
    // 超长单句先拆
    const pieces = splitLongSentence(s, maxChars);
    for (const piece of pieces) {
      if (curLen === 0) {
        cur = [piece];
        curLen = piece.length;
      } else if (curLen + piece.length <= maxChars || curLen < minChars) {
        cur.push(piece);
        curLen += piece.length;
      } else {
        flush();
        cur = [piece];
        curLen = piece.length;
      }
    }
  }
  flush();

  if (overlap && chunks.length > 1) {
    const withOverlap = [];
    let prevLast = '';
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      if (i > 0 && prevLast && c.length + prevLast.length <= maxChars + 200) {
        withOverlap.push(prevLast + c);
      } else {
        withOverlap.push(c);
      }
      // 记录本块最后一句
      const ss = splitIntoSentences(c);
      prevLast = ss.length > 0 ? ss[ss.length - 1] : '';
    }
    return withOverlap;
  }
  return chunks;
}

// 对整篇文本做句群切块：返回 [{content, token_count}]
export function chunkCorpusText(text, options) {
  const sentences = splitIntoSentences(text);
  const chunks = buildChunks(sentences, options);
  return chunks.map((content) => ({
    content,
    token_count: estimateTokens(content),
  }));
}

// 粗略 token 估计：中文字符按 1，ASCII 按 0.5（仅用于统计/排序，非计费精确值）
export function estimateTokens(text) {
  const zh = (String(text).match(/[\u4e00-\u9fa5]/g) || []).length;
  const ascii = (String(text).match(/[A-Za-z0-9]/g) || []).length;
  return zh + Math.ceil(ascii / 2);
}
