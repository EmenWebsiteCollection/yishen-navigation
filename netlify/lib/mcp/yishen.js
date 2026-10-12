// 伊神导航站——公开数据访问层。
//
// 数据来源：站点自己的公开只读接口 data-proxy（Netlify Function，匿名权限 + 5 分钟缓存）。
// 全程只用匿名权限，RLS 照常生效——能看到的数据和浏览器访客完全一致，
// 不碰任何用户私有数据（收藏/评论/私有作品）。

const DEFAULT_BASE_URL = 'https://zesty-sunflower-9ba9c1.netlify.app';

// Netlify 会自动注入 URL（站点主地址）；部署在同站时走内部调用，省一次公网往返。
const BASE_URL = (process.env.YISHEN_BASE_URL || process.env.URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const PROXY_PATH = '/.netlify/functions/data-proxy';
const REQUEST_TIMEOUT_MS = 20000;

// 搜索用的取数池：接口没有搜索 op，改为把全站作品拉下来本地过滤。
// 两个实测约束（2026-10-12 线上验证）：
//   1. 单页上限 50 条，超出会被接口 clamp；
//   2. 页码越界（from 超过总作品数）接口直接回 502——所以必须先拿总数再定页数。
const SEARCH_PAGE_SIZE = 50;
const SEARCH_MAX_PAGES = 10; // 保护上限：最多扫 500 条，站点长大也不会打爆接口

/** 作品详情页地址（前端路由 /website/:id） */
export const workPageUrl = (id) => `${BASE_URL}/website/${id}`;

/** 调用 data-proxy 的某个 op，返回 { data, count } */
async function callProxy(op, params = {}) {
  const url = new URL(PROXY_PATH, BASE_URL);
  url.searchParams.set('op', op);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    throw new Error(`连接伊神站数据接口失败（${op}）：${err.message}`);
  }
  if (!res.ok) throw new Error(`伊神站数据接口返回 HTTP ${res.status}（${op}）`);

  const body = await res.json();
  if (!body || body.ok === false) {
    throw new Error(`伊神站数据接口报错：${(body && body.error) || '未知错误'}`);
  }
  return { data: body.data || [], count: body.count };
}

/** 把接口原始记录精简成给模型看的字段——原始记录 30+ 字段，全塞进去会灌爆上下文 */
function slimWork(w) {
  if (!w) return null;
  const item = {
    id: w.id,
    title: w.title || '（无标题）',
    author: w.username || null,
    type: w.work_type || null,
    summary: w.description ? String(w.description).slice(0, 200) : null,
    tags: w.tags || [],
    likes: w.like_count ?? 0,
    views: w.view_count ?? 0,
    url: workPageUrl(w.id),
    cover: w.cover_url || w.image_url || null,
    created_at: w.created_at || null,
  };
  if (w.styles && w.styles.length) item.styles = w.styles;
  if (w.tools && w.tools.length) item.tools = w.tools;
  if (w.deploy_url) item.deploy_url = w.deploy_url;
  return item;
}

/** 列出所有分区 */
export async function listPartitions() {
  const { data } = await callProxy('partitions');
  return data.map((p) => ({ name: p.name, work_type: p.work_type, id: p.id }));
}

/** 分页浏览作品 */
export async function listWorks({ page = 1, page_size = 10, work_type, sort = 'new' } = {}) {
  const { data, count } = await callProxy('works_list', {
    page,
    pageSize: page_size,
    type: work_type,
    sort,
  });
  return {
    page,
    page_size,
    sort,
    work_type: work_type || '全部分区',
    // mixed 排序走的是候选池（pageSize×4），接口回的 count 是池子大小而非全站总数，
    // 报 null 交给上层，免得把假数当总数用（实测踩过）
    total: sort === 'mixed' ? null : (count ?? null),
    works: data.map(slimWork),
  };
}

/** 最近 N 天的新作品 */
export async function recentWorks({ days = 14, limit = 8 } = {}) {
  const { data } = await callProxy('new_works', { maxDays: days, limit });
  return { days, works: data.slice(0, limit).map(slimWork) };
}

/** 点赞榜 */
export async function topWorks({ limit = 8 } = {}) {
  const { data } = await callProxy('top_works', { limit, pool: Math.max(limit, 50) });
  return { works: data.slice(0, limit).map(slimWork) };
}

/** 关键词搜索（标题/简介/标签/风格/工具/作者）——把全站作品拉下来本地过滤 */
export async function searchWorks({ keyword, limit = 10 } = {}) {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) throw new Error('搜索关键词不能为空');

  // 第一页顺带拿到全站总数（只有 new/hot 排序会回真实 count）
  const first = await listWorks({ page: 1, page_size: SEARCH_PAGE_SIZE, sort: 'new' });
  const total = first.total ?? first.works.length;
  const pageCount = Math.max(1, Math.min(Math.ceil(total / SEARCH_PAGE_SIZE), SEARCH_MAX_PAGES));

  // 其余页并发拉；单页失败不影响整体（越界页会 502，容错跳过）
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, i) =>
      listWorks({ page: i + 2, page_size: SEARCH_PAGE_SIZE, sort: 'new' }).catch(() => ({ works: [] })),
    ),
  );

  const pool = new Map();
  for (const work of [...first.works, ...rest.flatMap((r) => r.works)]) {
    if (!pool.has(work.id)) pool.set(work.id, work);
  }

  const matched = [...pool.values()].filter((w) => haystack(w).includes(kw));
  // 热度排序：点赞权重 1，浏览权重 0.5
  matched.sort((a, b) => b.likes + b.views * 0.5 - (a.likes + a.views * 0.5));

  return {
    keyword,
    site_total: total,
    scanned: pool.size,
    matched: matched.length,
    works: matched.slice(0, limit),
  };
}

const haystack = (w) =>
  [
    w.title,
    w.summary,
    w.author,
    w.type,
    ...(w.tags || []),
    ...(w.styles || []),
    ...(w.tools || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
