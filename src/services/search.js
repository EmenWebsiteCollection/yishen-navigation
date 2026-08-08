// src/services/search.js — 网站搜索（Issue #19）
// 纯逻辑函数（normalizeQuery / rankWebsites / highlightHtml）零依赖，可直接用 Node 测试：
//   node search.test.js
// searchWebsites 通过动态 import 拉取 supabase，避免 Node 测试时加载浏览器环境。

const MAX_QUERY_LENGTH = 60;

export function normalizeQuery(q) {
  return String(q || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_QUERY_LENGTH);
}

/**
 * 客户端排序：按 标题 > URL > 描述 匹配打分，前缀命中加分，同分按点赞数。
 * @param {Array} websites 数据库返回的网站数组
 * @param {string} query 搜索词
 * @returns {Array} 仅包含有命中的网站，按分数降序
 */
export function rankWebsites(websites, query) {
  const q = normalizeQuery(query).toLowerCase();
  if (!q) return [];
  return websites
    .map((site) => {
      const title = (site.title || '').toLowerCase();
      const url = (site.url || '').toLowerCase();
      const desc = (site.description || '').toLowerCase();
      let score = 0;
      if (title.includes(q)) score += title.startsWith(q) ? 6 : 4;
      if (url.includes(q)) score += url.startsWith(q) ? 4 : 2;
      if (desc.includes(q)) score += 1;
      return { ...site, _score: score };
    })
    .filter((s) => s._score > 0)
    .sort((a, b) => b._score - a._score || (b.like_count || 0) - (a.like_count || 0));
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 安全高亮：先整体转义再包 <mark>，返回的 HTML 可直接用于 innerHTML。
 * ⚠️ 顺序不可调换：必须先 escape 再注入 mark，否则会产生 XSS（参考 md_note 安全加固）。
 * @param {string} text 原文
 * @param {string} query 搜索词
 * @returns {string} 安全 HTML（含 <mark class="ym-search-hl">）
 */
export function highlightHtml(text, query) {
  const q = normalizeQuery(query);
  if (!q || !text) return escapeHtml(text);
  const lower = String(text).toLowerCase();
  const target = q.toLowerCase();
  const idx = lower.indexOf(target);
  if (idx < 0) return escapeHtml(text);
  return (
    escapeHtml(text.slice(0, idx)) +
    '<mark class="ym-search-hl">' +
    escapeHtml(text.slice(idx, idx + q.length)) +
    '</mark>' +
    escapeHtml(text.slice(idx + q.length))
  );
}

// LIKE 通配符转义，避免用户输入的 % _ 变成模糊匹配（导出供 ideas.js 相似想法复用）
export function escapeLike(s) {
  return s.replace(/[\\%_]/g, (c) => '\\' + c);
}

/**
 * 搜索作品（服务端 ilike 过滤 + 客户端排序）。
 * 优先查 works_with_likes 视图；视图失败时降级查 works 表并手动统计点赞数。
 * @param {string} query 搜索词
 * @param {{limit?: number}} options
 * @returns {Promise<{results: Array, total: number, query: string}>}
 */
export async function searchWebsites(query, { limit = 8 } = {}) {
  const q = normalizeQuery(query);
  if (!q) return { results: [], total: 0, query: q };

  // 动态 import：浏览器端由 Vite 正常打包，Node 测试不会加载 supabase 环境
  const { supabase } = await import('./supabase.js');
  const like = '%' + escapeLike(q) + '%';
  const or = `title.ilike.${like},url.ilike.${like},description.ilike.${like}`;

  const { data, error } = await supabase
    .from('works_with_likes')
    .select(
      `
      id,
      url,
      title,
      description,
      image_url,
      created_at,
      updated_at,
      user_id,
      like_count,
      profiles ( username )
      `
    )
    .or(or)
    .order('like_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('⚠️ 搜索：视图查询失败，使用降级方案:', error.message);
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('works')
      .select(
        `
        id,
        url,
        title,
        description,
        image_url,
        created_at,
        updated_at,
        user_id,
        profiles ( username )
        `
      )
      .or(or)
      .limit(limit);
    if (fallbackError) throw fallbackError;
    const withLikes = await Promise.all(
      (fallbackData || []).map(async (item) => {
        let likeCount = 0;
        try {
          const { count } = await supabase
            .from('website_likes')
            .select('*', { count: 'exact', head: true })
            .eq('website_id', item.id);
          likeCount = count || 0;
        } catch (e) { /* 忽略 */ }
        return { ...item, like_count: likeCount };
      })
    );
    return { results: rankWebsites(withLikes, q), total: withLikes.length, query: q };
  }

  return { results: rankWebsites(data || [], q), total: (data || []).length, query: q };
}
