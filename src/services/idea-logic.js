// src/services/idea-logic.js
// Issue #12 纯逻辑模块：常量 + 校验/打分函数，零依赖，可直接用 Node 测试：
//   node src/services/ideas.test.js
import { normalizeQuery } from './search.js';

export const IDEA_CATEGORIES = [
  { id: 'website', label: '网站' },
  { id: 'tool', label: '工具' },
  { id: 'ai', label: 'AI' },
  { id: 'game', label: '游戏' },
  { id: 'illustration', label: '插画' },
  { id: 'writing', label: '写作' },
  { id: 'community', label: '社区' },
  { id: 'other', label: '其他' },
];

export const IDEA_STATUSES = [
  { id: 'idea', label: '灵感' },
  { id: 'developing', label: '开发中' },
  { id: 'done', label: '已实现' },
  { id: 'closed', label: '已关闭' },
];

export const IDEA_STATUS_COLOR = {
  idea: '#7A8794',
  developing: '#9C6B2E',
  done: '#5C7A3A',
  closed: '#8B3A2E',
};

export const ideaCategoryLabel = (c) =>
  IDEA_CATEGORIES.find((x) => x.id === c)?.label || c || '其他';

export const ideaStatusLabel = (s) =>
  IDEA_STATUSES.find((x) => x.id === s)?.label || s || '';

// 标签：支持中英文逗号/顿号/换行分隔，去重、限 10 个、单个 ≤20 字
export function normalizeTags(raw) {
  const list = String(raw || '')
    .split(/[,，、\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const t of list) {
    if (t.length > 20) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 10) break;
  }
  return out;
}

export function validateIdeaInput({ title = '', description = '', category = '', tags = [] } = {}) {
  const errors = [];
  const trimmedTitle = String(title || '').trim();
  if (!trimmedTitle) errors.push('标题不能为空');
  else if (trimmedTitle.length > 80) errors.push('标题不能超过 80 字');

  const trimmedDesc = String(description || '').trim();
  if (trimmedDesc.length > 2000) errors.push('描述不能超过 2000 字');
  if ((trimmedDesc.match(/\n/g) || []).length > 50) errors.push('描述中的换行不能超过 50 个');

  if (!IDEA_CATEGORIES.some((c) => c.id === category)) errors.push('请选择有效的分类');
  if (!Array.isArray(tags)) errors.push('标签格式不正确');
  else {
    if (tags.length > 10) errors.push('标签不能超过 10 个');
    if (tags.some((t) => t.length > 20)) errors.push('单个标签不能超过 20 字');
  }
  return errors;
}

export function checkIdeaRateLimit(recent1h, recent24h) {
  if (recent1h >= 3) return '发布太频繁：1 小时内最多发布 3 条想法，请稍后再试';
  if (recent24h >= 10) return '发布太频繁：24 小时内最多发布 10 条想法，请稍后再试';
  return null;
}

// 相似想法打分：标题命中 > 描述 > 标签（对齐 search.js 的 rank 思路）
export function rankSimilarIdeas(ideas, query) {
  const q = normalizeQuery(query).toLowerCase();
  if (!q) return [];
  return ideas
    .map((idea) => {
      const title = String(idea.title || '').toLowerCase();
      const desc = String(idea.description || '').toLowerCase();
      const tags = (idea.tags || []).join(' ').toLowerCase();
      let score = 0;
      if (title.includes(q)) score += title.startsWith(q) ? 8 : 6;
      if (desc.includes(q)) score += 2;
      if (tags.includes(q)) score += 1;
      return { ...idea, _score: score };
    })
    .filter((i) => i._score > 0)
    .sort((a, b) => b._score - a._score || new Date(b.created_at) - new Date(a.created_at));
}
