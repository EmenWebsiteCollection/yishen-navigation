// src/services/discovery.js
// Issue #39 P1：发现系统服务层（rail 推荐 / 每日随机 / 编辑精选 / 灵感地图关系）
import { supabase } from './supabase.js';
import { sortRailFallback, dedupeByAuthor, passesRandomGate } from './discovery-logic.js';

// 展平 works_discovery 行 → 前端作品对象（与 works.js mapWork 保持字段一致）
export const mapDiscoveryWork = (item) => ({
  id: item.id,
  url: item.url || null,
  title: item.title,
  description: item.description || '',
  image_url: item.image_url || null,
  cover_url: item.cover_url || null,
  media_url: item.media_url || null,
  work_type: item.work_type || 'website',
  featured: !!item.featured,
  status: item.status || null,
  visibility: item.visibility || 'public',
  group_id: item.group_id || null,
  changelog: item.changelog || null,
  tags: item.tags || [],
  styles: item.styles || [],
  tools: item.tools || [],
  creative_type: item.creative_type || null,
  completion: item.completion ?? null,
  seeking_collab: !!item.seeking_collab,
  derivative_allowed: item.derivative_allowed !== false,
  commercial_use: !!item.commercial_use,
  ai_degree: item.ai_degree || 'unknown',
  audience: item.audience || null,
  content_warning: item.content_warning || [],
  created_at: item.created_at,
  updated_at: item.updated_at,
  user_id: item.user_id,
  username: item.username || '用户',
  avatar_url: item.avatar_url || null,
  like_count: item.like_count ?? 0,
  comment_count: item.comment_count ?? 0,
  favorite_count: item.favorite_count ?? 0,
});

const RPC_FIELDS = `
  id, url, title, description, image_url, cover_url, media_url, work_type,
  featured, status, visibility, group_id, changelog,
  tags, styles, tools, creative_type, completion,
  seeking_collab, derivative_allowed, commercial_use, ai_degree, audience, content_warning,
  created_at, updated_at, user_id, like_count, comment_count, favorite_count, username, avatar_url
`;

/**
 * 获取一个发现 rail
 * @param {string} rail - latest/rising/featured/underrated/growing/zero_comment/following/favorites
 * @param {object} opts - { userId, workId, limit, excludeIds, maxPerAuthor }
 * @returns {Promise<Array>}
 */
export const getDiscoveryRail = async (rail, opts = {}) => {
  const { userId = null, workId = null, limit = 12, excludeIds = [], maxPerAuthor = 2 } = opts;
  try {
    const { data, error } = await supabase.rpc('get_discovery_rail', {
      p_rail: rail,
      p_user_id: userId,
      p_work_id: workId,
      p_limit: limit,
      p_exclude_ids: excludeIds,
    });
    if (error) throw error;
    const works = (data || []).map(mapDiscoveryWork);
    return dedupeByAuthor(works, { maxPerAuthor, limit });
  } catch (e) {
    console.warn(`⚠️ get_discovery_rail(${rail}) RPC 失败，使用降级方案:`, e.message);
    // 降级：直查 works_discovery（仅公开）+ 前端排序
    let query = supabase
      .from('works_discovery')
      .select(RPC_FIELDS)
      .eq('visibility', 'public')
      .limit(100);
    const { data, error: qErr } = await query;
    if (qErr) throw qErr;
    const excluded = new Set(excludeIds);
    let works = (data || [])
      .filter((w) => !excluded.has(w.id))
      .map(mapDiscoveryWork);
    works = sortRailFallback(works, rail);
    return dedupeByAuthor(works, { maxPerAuthor, limit }).slice(0, limit);
  }
};

/**
 * 每日随机：「今天看点不一样的」—— 质量门槛后随机，避开已看过的作品
 * @param {Array<string>} seenIds - 本次会话已看过的作品 id
 * @param {number} minLikes - 质量门槛（默认 1）
 * @returns {Promise<object|null>}
 */
export const getRandomWork = async (seenIds = [], minLikes = 1) => {
  try {
    const { data, error } = await supabase.rpc('get_random_work', { p_min_likes: minLikes });
    if (error) throw error;
    const work = (data && data[0]) ? mapDiscoveryWork(data[0]) : null;
    if (work && seenIds.includes(work.id)) {
      // 随机撞上已看过的：再抽一次（最多一次重试）
      const { data: d2 } = await supabase.rpc('get_random_work', { p_min_likes: minLikes });
      if (d2 && d2[0]) return mapDiscoveryWork(d2[0]);
    }
    return work;
  } catch (e) {
    console.warn('⚠️ get_random_work RPC 失败，使用降级方案:', e.message);
    const { data, error: qErr } = await supabase
      .from('works_discovery')
      .select(RPC_FIELDS)
      .eq('visibility', 'public')
      .limit(200);
    if (qErr) throw qErr;
    const pool = (data || [])
      .filter((w) => passesRandomGate(mapDiscoveryWork(w)) && !seenIds.includes(w.id))
      .map(mapDiscoveryWork);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }
};

/**
 * 编辑精选（仅管理员；RPC 内做 is_admin 校验）
 */
export const setFeatured = async (workId, featured) => {
  const { error } = await supabase.rpc('set_featured', {
    p_work_id: workId,
    p_featured: !!featured,
  });
  if (error) throw error;
};

// ========== 灵感地图：显式关系（work_relations） ==========
export const RELATION_TYPES = [
  { id: 'derivative', label: '衍生二创', reverse: '被衍生' },
  { id: 'remix', label: '重混/改编', reverse: '被改编' },
  { id: 'adaptation', label: '改编', reverse: '被改编' },
  { id: 'same_inspiration', label: '同一灵感来源', reverse: '同一灵感来源' },
  { id: 'collab', label: '合作作品', reverse: '合作作品' },
];

export const getWorkRelations = async (workId) => {
  const { data, error } = await supabase
    .from('work_relations')
    .select('id, source_work_id, target_work_id, relation_type, created_by, created_at')
    .or(`source_work_id.eq.${workId},target_work_id.eq.${workId}`);
  if (error) throw error;
  return data || [];
};

export const addWorkRelation = async ({ sourceWorkId, targetWorkId, relationType }, userId) => {
  if (!sourceWorkId || !targetWorkId || sourceWorkId === targetWorkId) {
    throw new Error('关系两端作品不能相同');
  }
  if (!RELATION_TYPES.some((r) => r.id === relationType)) {
    throw new Error('未知的关系类型');
  }
  const { data, error } = await supabase
    .from('work_relations')
    .insert({
      source_work_id: sourceWorkId,
      target_work_id: targetWorkId,
      relation_type: relationType,
      created_by: userId,
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('该关系已存在');
    throw error;
  }
  return data;
};

export const deleteWorkRelation = async (relationId) => {
  const { error } = await supabase
    .from('work_relations')
    .delete()
    .eq('id', relationId);
  if (error) throw error;
};
