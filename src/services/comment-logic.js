// src/services/comment-logic.js
// Issue #39 P2：结构化评论 + 局部批注纯逻辑（无副作用，Node 直跑可测）

export const FEEDBACK_TYPES = [
  { id: 'appreciate', label: '单纯欣赏' },
  { id: 'suggestion', label: '具体建议' },
  { id: 'technical', label: '技术问题' },
  { id: 'plot', label: '剧情讨论' },
  { id: 'style', label: '风格分析' },
  { id: 'error', label: '错误指出' },
  { id: 'collab', label: '合作邀请' },
  { id: 'consult', label: '商业咨询' },
];

export const FEEDBACK_BY_ID = Object.fromEntries(FEEDBACK_TYPES.map((f) => [f.id, f]));
export const feedbackLabel = (id) => FEEDBACK_BY_ID[id]?.label || id || '';

// 创作者反馈预设（Issue 三.1）
export const CREATOR_FEEDBACK_MODES = [
  { id: 'any', label: '欢迎任何评价' },
  { id: 'encourage', label: '只接受鼓励' },
  { id: 'strict', label: '希望得到严格批评' },
  { id: 'professional', label: '希望获得专业建议' },
  { id: 'no_suggestion', label: '暂不接受修改建议' },
];

export const validateFeedbackType = (type) => {
  if (!type) return 'appreciate';
  if (!FEEDBACK_BY_ID[type]) throw new Error('未知的反馈类型');
  return type;
};

// 评论内容：非空、≤1000 字、换行 ≤10
export const validateCommentContent = (content) => {
  const trimmed = String(content || '').trim();
  if (!trimmed) throw new Error('评论不能为空');
  if (trimmed.length > 1000) throw new Error('评论不能超过 1000 字');
  const newlines = (trimmed.match(/\n/g) || []).length;
  if (newlines > 10) throw new Error('评论中的换行不能超过 10 个');
  return trimmed;
};

const isFiniteNum = (v) => typeof v === 'number' && Number.isFinite(v);
const in01 = (v) => isFiniteNum(v) && v >= 0 && v <= 1;

// 批注锚点校验（四类：image/text/video/audio/component）
export const validateAnchor = (anchor) => {
  if (anchor == null || anchor === '') return null;
  if (typeof anchor !== 'object' || Array.isArray(anchor)) throw new Error('批注格式不正确');

  const { kind } = anchor;
  if (kind === 'image') {
    const { x, y, w, h } = anchor;
    if (!in01(x) || !in01(y) || !in01(w) || !in01(h)) throw new Error('图片批注坐标需为 0-1 之间的数值');
    if (w <= 0 || h <= 0) throw new Error('图片批注区域需大于 0');
    return { kind: 'image', x, y, w, h };
  }
  if (kind === 'text') {
    const { start, end, quote } = anchor;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
      throw new Error('文字批注位置不正确');
    }
    const q = String(quote || '').slice(0, 500);
    return { kind: 'text', start, end, quote: q };
  }
  if (kind === 'video' || kind === 'audio') {
    const { start_sec, end_sec } = anchor;
    if (!isFiniteNum(start_sec) || start_sec < 0) throw new Error('媒体批注开始时间不正确');
    if (end_sec != null) {
      if (!isFiniteNum(end_sec) || end_sec < start_sec) throw new Error('媒体批注结束时间不正确');
      return { kind, start_sec, end_sec };
    }
    return { kind, start_sec };
  }
  if (kind === 'component') {
    const path = String(anchor.path || '').trim().slice(0, 200);
    if (!path) throw new Error('组件批注缺少目标路径');
    return { kind: 'component', path };
  }
  throw new Error('未知的批注类型');
};

// 文本批注失配检测：作品内容已改版时给出提示
export const checkTextQuoteMismatch = (anchor, currentText) => {
  if (!anchor || anchor.kind !== 'text') return false;
  const slice = String(currentText || '').slice(anchor.start, anchor.end);
  if (!slice) return true; // 区间已越界
  return !anchor.quote || slice !== anchor.quote;
};

// 展示辅助：把时间秒格式化为 mm:ss
export const formatTime = (sec) => {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};
