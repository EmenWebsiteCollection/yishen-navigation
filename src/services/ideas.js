// src/services/ideas.js
// Issue #12「灵感」：想法发布 / 投票(一人一票) / 收藏(=关注) / 评论 /
// 进展时间线 / 相似想法提示 / 管理员合并 / 想法→作品孵化闭环
import { supabase } from './supabase.js';
import { normalizeQuery, escapeLike } from './search.js';
import { getProfile } from './users.js';
import { isAdmin as isAdminRpc } from './works.js';

// ========== 常量与纯逻辑（定义见 idea-logic.js，Node 可直测） ==========
import {
  IDEA_CATEGORIES,
  IDEA_STATUSES,
  IDEA_STATUS_COLOR,
  normalizeTags,
  validateIdeaInput,
  checkIdeaRateLimit,
  rankSimilarIdeas,
  ideaCategoryLabel,
  ideaStatusLabel,
} from './idea-logic.js';

export {
  IDEA_CATEGORIES,
  IDEA_STATUSES,
  IDEA_STATUS_COLOR,
  normalizeTags,
  validateIdeaInput,
  checkIdeaRateLimit,
  rankSimilarIdeas,
  ideaCategoryLabel,
  ideaStatusLabel,
};
// ========== 查询 ==========
const IDEA_VIEW_SELECT = `
  id, user_id, title, description, category, tags, status,
  related_work_id, pinned, created_at, updated_at,
  username, avatar_url,
  vote_count, comment_count, favorite_count,
  related_work_title, related_work_url, related_work_type
`;

const mapIdea = (item) => ({
  id: item.id,
  user_id: item.user_id,
  title: item.title,
  description: item.description || '',
  category: item.category || 'other',
  tags: item.tags || [],
  status: item.status || 'idea',
  related_work_id: item.related_work_id || null,
  pinned: !!item.pinned,
  created_at: item.created_at,
  updated_at: item.updated_at,
  username: item.username || '用户',
  avatar_url: item.avatar_url || null,
  vote_count: item.vote_count ?? 0,
  comment_count: item.comment_count ?? 0,
  favorite_count: item.favorite_count ?? 0,
  related_work_title: item.related_work_title || null,
  related_work_url: item.related_work_url || null,
  related_work_type: item.related_work_type || null,
});

/**
 * 想法列表（置顶优先；sort=latest 按最新，hot 按票数）
 * @param {{page?:number, pageSize?:number, category?:string, status?:string, sort?:'latest'|'hot', query?:string, userId?:string}} options
 */
export const getIdeas = async ({
  page = 1,
  pageSize = 10,
  category = null,
  status = null,
  sort = 'latest',
  query = null,
  userId = null,
} = {}) => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from('ideas_with_stats')
    .select(IDEA_VIEW_SELECT, { count: 'exact' });

  if (category) q = q.eq('category', category);
  if (status) q = q.eq('status', status);
  else q = q.neq('status', 'closed'); // 默认不显示已关闭的想法
  if (userId) q = q.eq('user_id', userId);
  if (query) {
    const like = `"%${escapeLike(normalizeQuery(query))}%"`;
    q = q.or(`title.ilike.${like},description.ilike.${like}`);
  }

  if (sort === 'hot') {
    q = q.order('pinned', { ascending: false })
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: false });
  } else {
    q = q.order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
  }
  q = q.range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;
  return { ideas: (data || []).map(mapIdea), total: count || 0 };
};

export const getIdeaById = async (id, currentUserId = null) => {
  const { data, error } = await supabase
    .from('ideas_with_stats')
    .select(IDEA_VIEW_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  if (!data) return null;
  const idea = mapIdea(data);
  // 补充：已导出的 GitHub Issue 编号（独立字段，不在视图中）
  try {
    const { data: ext } = await supabase
      .from('ideas')
      .select('github_issue_number')
      .eq('id', id)
      .maybeSingle();
    idea.github_issue_number = ext?.github_issue_number ?? null;
  } catch (_) {
    idea.github_issue_number = null;
  }
  if (currentUserId) {
    idea.has_voted = await hasVotedIdea(id, currentUserId);
    idea.has_favorited = await hasFavoritedIdea(id, currentUserId);
  }
  return idea;
};

export const hasVotedIdea = async (ideaId, userId) => {
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from('idea_votes')
      .select('id')
      .eq('idea_id', ideaId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  } catch (e) {
    console.warn('检查投票状态失败:', e.message);
    return false;
  }
};

export const hasFavoritedIdea = async (ideaId, userId) => {
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from('idea_favorites')
      .select('id')
      .eq('idea_id', ideaId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  } catch (e) {
    console.warn('检查关注状态失败:', e.message);
    return false;
  }
};

// ========== 投票 / 收藏（=关注） ==========
export const toggleIdeaVote = async (ideaId, userId) => {
  if (!userId) throw new Error('请先登录');
  const voted = await hasVotedIdea(ideaId, userId);
  if (voted) {
    const { error } = await supabase
      .from('idea_votes')
      .delete()
      .eq('idea_id', ideaId)
      .eq('user_id', userId);
    if (error) throw error;
    return { voted: false };
  }
  const { error } = await supabase
    .from('idea_votes')
    .insert({ idea_id: ideaId, user_id: userId });
  if (error) {
    if (error.code === '23505') throw new Error('你已经投过票啦');
    throw error;
  }
  return { voted: true };
};

export const toggleIdeaFavorite = async (ideaId, userId) => {
  if (!userId) throw new Error('请先登录');
  const favorited = await hasFavoritedIdea(ideaId, userId);
  if (favorited) {
    const { error } = await supabase
      .from('idea_favorites')
      .delete()
      .eq('idea_id', ideaId)
      .eq('user_id', userId);
    if (error) throw error;
    return { favorited: false };
  }
  const { error } = await supabase
    .from('idea_favorites')
    .insert({ idea_id: ideaId, user_id: userId });
  if (error) {
    if (error.code === '23505') throw new Error('已经在关注这个想法啦');
    throw error;
  }
  return { favorited: true };
};

// ========== 发布（含服务端速率限制） ==========
export const createIdea = async (payload, userId) => {
  if (!userId) throw new Error('请先登录');
  const errors = validateIdeaInput(payload);
  if (errors.length) throw new Error(errors[0]);

  const now = Date.now();
  const h1 = new Date(now - 3600 * 1000).toISOString();
  const d1 = new Date(now - 24 * 3600 * 1000).toISOString();

  const [{ count: recent1h }, { count: recent24h }] = await Promise.all([
    supabase
      .from('ideas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', h1),
    supabase
      .from('ideas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', d1),
  ]);
  const limitMsg = checkIdeaRateLimit(recent1h || 0, recent24h || 0);
  if (limitMsg) throw new Error(limitMsg);

  const { data, error } = await supabase
    .from('ideas')
    .insert({
      user_id: userId,
      title: String(payload.title || '').trim(),
      description: String(payload.description || '').trim(),
      category: payload.category || 'other',
      tags: normalizeTags(payload.tags),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ========== 状态变更 + 进展时间线 ==========
const canManageIdea = async (idea, userId) => {
  if (!userId) return false;
  const isAdmin = await isAdminRpc(userId);
  return idea.user_id === userId || isAdmin;
};

export const updateIdeaStatus = async (id, status, note, userId) => {
  if (!userId) throw new Error('请先登录');
  if (!IDEA_STATUSES.some((s) => s.id === status)) throw new Error('无效的状态');
  if (status === 'closed' && !String(note || '').trim()) {
    throw new Error('关闭想法需要写一句理由，避免「无声拒绝」');
  }

  const { data: idea, error: ideaError } = await supabase
    .from('ideas')
    .select('user_id, title, status')
    .eq('id', id)
    .maybeSingle();
  if (ideaError) throw ideaError;
  if (!idea) throw new Error('想法不存在');
  if (!(await canManageIdea(idea, userId))) throw new Error('只有想法作者或管理员可以修改状态');

  const oldLabel = ideaStatusLabel(idea.status);
  const newLabel = ideaStatusLabel(status);
  const { error: upError } = await supabase
    .from('ideas')
    .update({ status })
    .eq('id', id);
  if (upError) throw upError;

  let content = `状态从「${oldLabel}」改为「${newLabel}」`;
  const trimmedNote = String(note || '').trim();
  if (trimmedNote) content += `：${trimmedNote}`;
  const { error: logError } = await supabase
    .from('idea_updates')
    .insert({ idea_id: id, user_id: userId, kind: 'status', content });
  if (logError) console.warn('写入状态进展失败:', logError.message);
};

export const addIdeaUpdate = async (id, content, userId) => {
  if (!userId) throw new Error('请先登录');
  const trimmed = String(content || '').trim();
  if (!trimmed) throw new Error('进展内容不能为空');
  if (trimmed.length > 500) throw new Error('进展不能超过 500 字');

  const { data: idea, error: ideaError } = await supabase
    .from('ideas')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();
  if (ideaError) throw ideaError;
  if (!idea) throw new Error('想法不存在');
  if (!(await canManageIdea(idea, userId))) throw new Error('只有想法作者或管理员可以补充进展');

  const { data, error } = await supabase
    .from('idea_updates')
    .insert({ idea_id: id, user_id: userId, kind: 'progress', content: trimmed })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getIdeaUpdates = async (ideaId) => {
  const { data, error } = await supabase
    .from('idea_updates')
    .select(`
      id, idea_id, user_id, kind, content, created_at,
      profiles ( username, avatar_url )
    `)
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((u) => ({
    id: u.id,
    user_id: u.user_id,
    kind: u.kind,
    content: u.content,
    created_at: u.created_at,
    username: u.profiles?.username || '用户',
    avatar_url: u.profiles?.avatar_url || null,
  }));
};

// ========== 评论（复用现有评论树模式） ==========
export const getIdeaComments = async (ideaId) => {
  const { data, error } = await supabase
    .from('idea_comments')
    .select(`
      id, content, created_at, user_id, parent_id,
      profiles ( username, avatar_url )
    `)
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((c) => ({
    id: c.id,
    content: c.content,
    created_at: c.created_at,
    user_id: c.user_id,
    parent_id: c.parent_id,
    username: c.profiles?.username || '用户',
    avatar_url: c.profiles?.avatar_url || null,
  }));
};

export const createIdeaComment = async (ideaId, userId, content, parentId = null) => {
  const trimmed = String(content || '').trim();
  if (!trimmed) throw new Error('评论不能为空');
  if (trimmed.length > 1000) throw new Error('评论不能超过 1000 字');
  if ((trimmed.match(/\n/g) || []).length > 10) throw new Error('评论中的换行不能超过 10 个');
  const { data, error } = await supabase
    .from('idea_comments')
    .insert({ idea_id: ideaId, user_id: userId, content: trimmed, parent_id: parentId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteIdeaComment = async (commentId) => {
  // 走 RPC（本人或管理员校验），绕开 PostgREST DELETE 通道故障
  const { error } = await supabase.rpc('rpc_delete_idea_comment', { comment_id: commentId });
  if (error) throw error;
};

// ========== 相似想法提示（发布前，防重复分裂票数） ==========
export const findSimilarIdeas = async (query, { limit = 5 } = {}) => {
  const q = normalizeQuery(query);
  if (!q || q.length < 2) return [];
  const like = `"%${escapeLike(q)}%"`;
  const { data, error } = await supabase
    .from('ideas_with_stats')
    .select('id, title, status, category, vote_count, created_at, tags')
    .or(`title.ilike.${like},description.ilike.${like}`)
    .limit(20);
  if (error) throw error;
  return rankSimilarIdeas(data || [], q).slice(0, limit);
};

// ========== 管理员合并（防重复分裂票数） ==========
export const mergeIdeas = async (targetId, sourceIds, adminUserId) => {
  if (!adminUserId) throw new Error('请先登录');
  const isAdminFlag = await isAdminRpc(adminUserId);
  if (!isAdminFlag) throw new Error('需要管理员权限才能合并想法');
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    throw new Error('至少需要选择一个要合并的想法');
  }
  const { error } = await supabase.rpc('merge_ideas', {
    p_target_id: targetId,
    p_source_ids: sourceIds,
    p_admin_id: adminUserId,
  });
  if (error) throw error;
};

// ========== 孵化闭环：想法 ↔ 作品 ==========
export const linkIdeaToWork = async (ideaId, workId, userId) => {
  if (!userId) throw new Error('请先登录');
  const { data: idea, error: ie } = await supabase
    .from('ideas')
    .select('user_id, title, status')
    .eq('id', ideaId)
    .maybeSingle();
  if (ie) throw ie;
  if (!idea) throw new Error('想法不存在');
  if (!(await canManageIdea(idea, userId))) throw new Error('只有想法作者或管理员可以关联作品');

  const { data: work, error: we } = await supabase
    .from('works')
    .select('id, title, visibility, user_id')
    .eq('id', workId)
    .maybeSingle();
  if (we) throw we;
  if (!work) throw new Error('作品不存在');

  // 作品侧回写孵化来源（仅作品 owner 或管理员可改，失败不阻断）
  if (work.user_id === userId || await isAdminRpc(userId)) {
    const { error: srcErr } = await supabase
      .from('works')
      .update({ source_idea_id: ideaId })
      .eq('id', workId);
    if (srcErr) console.warn('回写作品 source_idea_id 失败:', srcErr.message);
  }

  const patch = { related_work_id: workId };
  const statusChanged = idea.status !== 'done' && work.visibility === 'public';
  if (statusChanged) patch.status = 'done';
  const { error: upErr } = await supabase
    .from('ideas')
    .update(patch)
    .eq('id', ideaId);
  if (upErr) throw upErr;

  const content = statusChanged
    ? `已实现：作品「${work.title}」已发布，想法点亮「已实现」`
    : `已关联作品「${work.title}」`;
  const { error: logError } = await supabase
    .from('idea_updates')
    .insert({ idea_id: ideaId, user_id: userId, kind: 'status', content });
  if (logError) console.warn('写入孵化进展失败:', logError.message);
};

// ========== 个人中心：我的想法 / 我的关注 ==========
export const getMyIdeas = async (userId, { page = 1, pageSize = 20 } = {}) => {
  return getIdeas({ userId, page, pageSize, sort: 'latest' });
};

export const getMyFavoritedIdeas = async (userId) => {
  const { data, error } = await supabase
    .from('idea_favorites')
    .select(`
      id, created_at,
      ideas ( id, title, status, category, created_at )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || [])
    .filter((f) => f.ideas)
    .map((f) => ({
      favorite_id: f.id,
      favorited_at: f.created_at,
      idea: f.ideas,
    }));
};

// ========== 管理员：一键导出 GitHub Issue ==========
export const exportIdeaToGithub = async (ideaId) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('请先登录');

  const res = await fetch('/.netlify/functions/export-idea', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ ideaId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `导出失败（HTTP ${res.status}）`);
  return body;
};
