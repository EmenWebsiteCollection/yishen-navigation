// netlify/functions/data-proxy.mjs
// 公开读接口缓存中转（issue #127）。
// 背景：浏览器直连 Supabase 受 DNS 污染影响，简单查询也要 2-3.5s。
// 方案：浏览器 → Netlify（快）→ 函数 → Supabase（服务器间直连不受污染影响），
//       结果缓存到 Netlify Blobs，命中缓存秒开，TTL 5 分钟。
//
// 只做「公开读」缓存：列表/轮播/高分榜/分区均为匿名可读数据，不含任何用户私有数据。
// 使用 ANON KEY（非 service role）查询，RLS 照常生效，与浏览器直连权限完全一致。
//
// 契约：GET /.netlify/functions/data-proxy?op=<op>&<params>
//   op=works_list  params: page, pageSize, type, sort(new|hot)
//   op=new_works   params: limit, maxDays
//   op=top_works   params: limit, pool
//   op=partitions  （无参数）
// 响应：{ ok, cached, data, count? }；错误返回 { ok:false, error } 与 4xx/5xx。
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const CACHE_TTL_MS = 5 * 60 * 1000; // 缓存 5 分钟（issue 建议 5-10 分钟）
const CACHE_STORE = 'data-proxy';

// 与 src/services/works.js 的 VIEW_SELECT 保持一致（视图查询字段）
const VIEW_SELECT = `
  id, url, title, description, image_url, cover_url, media_url,
  work_type, featured, status, visibility, group_id, changelog,
  tags, styles, tools, creative_type, completion, seeking_collab,
  derivative_allowed, commercial_use, ai_degree, audience, content_warning,
  created_at, updated_at, user_id, view_count, source_idea_id, video_url, deploy_url, deploy_updated_at,
  like_count, username, avatar_url
`;

const clamp = (n, lo, hi, def) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return def;
  return Math.min(hi, Math.max(lo, Math.floor(v)));
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
  });
}

async function getCached(store, key) {
  try {
    const cached = await store.get(key, { type: 'json' });
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
  } catch {
    // 缓存读失败视为未命中
  }
  return null;
}

// ---------- 各操作：与前端查询保持一致 ----------

async function opWorksList(sb, p) {
  const page = clamp(p.page, 1, 100000, 1);
  const pageSize = clamp(p.pageSize, 1, 50, 10);
  const type = String(p.type || '').trim();
  const sort = p.sort === 'hot' ? 'hot' : 'new';
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = sb.from('works_with_likes').select(VIEW_SELECT, { count: 'exact' });
  if (type) q = q.eq('work_type', type);
  q = q.eq('visibility', 'public');
  if (sort === 'hot') q = q.order('like_count', { ascending: false });
  else q = q.order('created_at', { ascending: false });
  q = q.range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

async function opNewWorks(sb, p) {
  const limit = clamp(p.limit, 1, 30, 8);
  const maxDays = clamp(p.maxDays, 1, 90, 14);
  const since = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from('works_with_likes')
    .select(VIEW_SELECT)
    .eq('visibility', 'public')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit * 2);
  if (error) throw error;
  return { data: data || [] };
}

async function opTopWorks(sb, p) {
  const limit = clamp(p.limit, 1, 30, 8);
  const pool = clamp(p.pool, limit, 200, limit);
  const { data, error } = await sb
    .from('works_with_likes')
    .select(VIEW_SELECT)
    .eq('visibility', 'public')
    .order('like_count', { ascending: false })
    .limit(pool);
  if (error) throw error;
  return { data: data || [] };
}

async function opPartitions(sb) {
  const { data, error } = await sb
    .from('partitions')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return { data: data || [] };
}

const OPS = {
  works_list: opWorksList,
  new_works: opNewWorks,
  top_works: opTopWorks,
  partitions: opPartitions,
};

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method Not Allowed' }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json({ error: '缺少 Supabase 环境变量' }, 500);
  }

  const u = new URL(req.url);
  const op = u.searchParams.get('op') || '';
  const params = Object.fromEntries(u.searchParams);
  const handler = OPS[op];
  if (!handler) return json({ error: '未知 op' }, 400);

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let store = null;
  try {
    store = getStore(CACHE_STORE);
  } catch {
    // Blobs 不可用则跳过缓存
  }

  const key = createHash('sha256').update(`${op}:${JSON.stringify(params)}`).digest('hex');

  if (store) {
    const cached = await getCached(store, key);
    if (cached) return json({ ok: true, cached: true, ...cached });
  }

  try {
    const result = await handler(sb, params);
    if (store) {
      try {
        await store.set(key, JSON.stringify({ at: Date.now(), data: result }));
      } catch {
        // 缓存写失败忽略
      }
    }
    return json({ ok: true, cached: false, ...result });
  } catch (err) {
    console.error(`data-proxy ${op} 失败:`, err.message);
    return json({ ok: false, error: '查询失败，请稍后重试' }, 502);
  }
};
