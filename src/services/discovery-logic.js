// src/services/discovery-logic.js
// Issue #39 P1：发现系统纯逻辑（无副作用，Node 直跑可测）。
// 对齐项目「纯逻辑 + Node 测试」范式（参考 ideas.test.js / search.test.js）。

// ---------- 常量 ----------
export const DISCOVERY_RAILS = [
  { id: 'latest', label: '最新发布', desc: '按发布时间倒序', requiresAuth: false },
  { id: 'rising', label: '本周新锐', desc: '7 天内发布且至少 1 赞', requiresAuth: false },
  { id: 'featured', label: '编辑精选', desc: '管理员每周人工精选', requiresAuth: false },
  { id: 'underrated', label: '小众宝藏', desc: '点赞少但收藏/评论亮眼', requiresAuth: false },
  { id: 'growing', label: '正在成长', desc: '互动在涨的中腰部作品', requiresAuth: false },
  { id: 'zero_comment', label: '零评论作品', desc: '等待第一个反馈', requiresAuth: false },
  { id: 'following', label: '关注动态', desc: '你关注创作者的近期作品', requiresAuth: true },
  { id: 'favorites', label: '收藏偏好', desc: '按你收藏过的标签推荐', requiresAuth: true },
];

export const RAIL_BY_ID = Object.fromEntries(DISCOVERY_RAILS.map((r) => [r.id, r]));

// 随机作品质量门槛：点赞≥1 或 被编辑精选
export const passesRandomGate = (work) => {
  if (!work) return false;
  return (work.like_count ?? 0) >= 1 || !!work.featured;
};

// ---------- 标签清洗 ----------
export const normalizeTagList = (arr, { max = 10, maxLen = 20 } = {}) => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const t = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!t) continue;
    if (t.length > maxLen) throw new Error(`标签「${t}」不能超过 ${maxLen} 字`);
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
};

// ---------- Wilson 下界（Reddit 热评式排序，小样本不虚高） ----------
export const wilsonLowerBound = (up, total, z = 1.96) => {
  const n = Number(total) || 0;
  const p = n === 0 ? 0 : (Number(up) || 0) / n;
  if (n === 0) return 0;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return Math.max(0, center - margin);
};

// ---------- 标签/风格/工具重叠打分 ----------
export const overlapScore = (work, seed = {}) => {
  const a = (work?.tags || []).filter((t) => (seed.tags || []).includes(t)).length;
  const b = (work?.styles || []).filter((t) => (seed.styles || []).includes(t)).length;
  const c = (work?.tools || []).filter((t) => (seed.tools || []).includes(t)).length;
  const d = seed.work_type && String(work?.work_type || '').split(',').includes(seed.work_type) ? 1 : 0;
  return a * 2 + b * 2 + c * 2 + d;
};

// ---------- rail 内作者去重（防大账号霸屏，借鉴 Behance 策展规则） ----------
export const dedupeByAuthor = (works, { maxPerAuthor = 2, limit = 12 } = {}) => {
  const counts = {};
  const out = [];
  for (const w of works || []) {
    const uid = w?.user_id;
    if (!uid) continue;
    if ((counts[uid] || 0) >= maxPerAuthor) continue;
    counts[uid] = (counts[uid] || 0) + 1;
    out.push(w);
    if (out.length >= limit) break;
  }
  return out;
};

// ---------- 已看去重（每日随机 / 多 rail 并集） ----------
export const excludeSeen = (works, seenIds) => {
  const s = new Set(seenIds || []);
  return (works || []).filter((w) => !s.has(w?.id));
};

// ---------- 列表内客户端降级排序（RPC 不可用时的兜底） ----------
export const sortRailFallback = (works, rail) => {
  const list = [...(works || [])];
  switch (rail) {
    case 'latest':
      return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    case 'rising':
      return list
        .filter((w) => new Date(w.created_at) >= new Date(Date.now() - 7 * 864e5) && (w.like_count || 0) >= 1)
        .sort((a, b) => b.like_count - a.like_count || new Date(b.created_at) - new Date(a.created_at));
    case 'featured':
      return list.filter((w) => w.featured).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    case 'underrated':
      return list
        .filter((w) => (w.like_count || 0) <= 10 && (w.favorite_count || 0) + (w.comment_count || 0) >= 2)
        .sort((a, b) => (b.favorite_count * 2 + b.comment_count) - (a.favorite_count * 2 + a.comment_count));
    case 'growing':
      return list
        .filter((w) => (w.like_count || 0) >= 5 && (w.like_count || 0) <= 50 && (w.favorite_count || 0) + (w.comment_count || 0) >= 1)
        .sort((a, b) => (b.favorite_count + b.comment_count) - (a.favorite_count + a.comment_count));
    case 'zero_comment':
      return list.filter((w) => (w.comment_count || 0) === 0).sort((a, b) => b.like_count - a.like_count);
    default:
      return list;
  }
};
