// src/services/works.js
// 作品（works）服务层：由原 websites.js 演进而来。
// websites 表已泛化为 works，网站只是 work_type='website' 的一种作品。
import { supabase } from './supabase.js';

// ========== 常量 ==========
export const WORK_TYPES = [
  { id: 'website', label: '网站' },
  { id: 'novel', label: '小说' },
  { id: 'illustration', label: '插画' },
  { id: 'game', label: '游戏' },
  { id: 'music', label: '音乐' },
  { id: 'video', label: '视频' },
  { id: 'photo', label: '摄影' },
  { id: 'other', label: '其他' },
];

export const WORK_STATUS = [
  { id: 'ongoing', label: '创作中' },
  { id: 'completed', label: '已完成' },
  { id: 'on_hold', label: '暂停' },
  { id: 'abandoned', label: '弃坑' },
];

export const COLLAB_STATUS = [
  { id: 'open', label: '开放合作' },
  { id: 'limited', label: '有限合作' },
  { id: 'closed', label: '暂不合作' },
];

export const COMMISSION_STATUS = [
  { id: 'open', label: '接受委托' },
  { id: 'closed', label: '暂不接受' },
];

export const workTypeLabel = (type) =>
  WORK_TYPES.find((t) => t.id === type)?.label || type || '作品';

export const workStatusLabel = (status) =>
  WORK_STATUS.find((s) => s.id === status)?.label || status || '';

// ========== 基础 ==========
export const normalizeUrl = (url) => {
  if (!url) return url;
  return url.trim().replace(/\/+$/, '');
};

// works 表直查字段（含 profiles 关联）
const TABLE_SELECT = `
  id, url, title, description, image_url, cover_url, work_type,
  featured, status, visibility, group_id, changelog,
  created_at, updated_at, user_id,
  profiles ( username, avatar_url )
`;

// works_with_likes 视图字段（视图已 join profiles）
const VIEW_SELECT = `
  id, url, title, description, image_url, cover_url, work_type,
  featured, status, visibility, group_id, changelog,
  created_at, updated_at, user_id, like_count, username, avatar_url
`;

const mapWork = (item) => {
  const p = item.profiles || {};
  return {
    id: item.id,
    url: item.url || null,
    title: item.title,
    description: item.description || '',
    image_url: item.image_url || null,
    cover_url: item.cover_url || null,
    work_type: item.work_type || 'website',
    featured: !!item.featured,
    status: item.status || null,
    visibility: item.visibility || 'public',
    group_id: item.group_id || null,
    changelog: item.changelog || null,
    created_at: item.created_at,
    updated_at: item.updated_at,
    user_id: item.user_id,
    username: p.username || item.username || '用户',
    avatar_url: p.avatar_url || item.avatar_url || null,
    like_count: item.like_count ?? 0,
    liked_by_user: false,
    favorited_by_user: false,
  };
};

export const checkUrlExists = async (url) => {
  const normalized = normalizeUrl(url);
  if (!normalized) return false;
  const { data, error } = await supabase
    .from('works')
    .select('id')
    .eq('url', normalized)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
};

// ========== 创建作品 ==========
export const createWork = async (payload, userId) => {
  const {
    url = null,
    title = '',
    description = '',
    image_url = null,
    cover_url = null,
    work_type = 'website',
    status = null,
    visibility = 'public',
    group_id = null,
    changelog = null,
  } = payload || {};

  if (!title || !title.trim()) throw new Error('标题不能为空');
  const trimmedTitle = title.trim();
  const trimmedType = work_type || 'website';
  let trimmedUrl = null;

  if (trimmedType === 'website') {
    if (!url || !url.trim()) throw new Error('网站类作品必须填写 URL');
    trimmedUrl = normalizeUrl(url);
    const exists = await checkUrlExists(trimmedUrl);
    if (exists) throw new Error('该网址已存在，无法重复创建。');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw new Error('用户资料获取失败，请重新登录。');
  if (!profile) throw new Error('用户资料不存在，请重新登录。');

  const { data, error } = await supabase
    .from('works')
    .insert([
      {
        url: trimmedUrl,
        title: trimmedTitle,
        description: description?.trim() || null,
        image_url: image_url || null,
        cover_url: cover_url || null,
        work_type: trimmedType,
        status: status || null,
        visibility: visibility === 'private' ? 'private' : 'public',
        group_id: group_id || null,
        changelog: changelog?.trim() || null,
        user_id: userId,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return mapWork(data);
};

// ========== 分页查询（首页网站导航，可扩展任意类型） ==========
export const getWorks = async ({ page = 1, pageSize = 10, type = 'website', userId = null } = {}) => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('works_with_likes')
    .select(VIEW_SELECT, { count: 'exact' });
  if (type) query = query.eq('work_type', type);
  query = query.eq('visibility', 'public');
  if (userId) query = query.eq('user_id', userId);
  query = query.order('like_count', { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.warn('⚠️ 视图查询失败，使用降级方案:', error.message);
    let fallbackQuery = supabase
      .from('works')
      .select(TABLE_SELECT, { count: 'exact' });
    if (type) fallbackQuery = fallbackQuery.eq('work_type', type);
    fallbackQuery = fallbackQuery.eq('visibility', 'public');
    if (userId) fallbackQuery = fallbackQuery.eq('user_id', userId);
    fallbackQuery = fallbackQuery.order('created_at', { ascending: false }).range(from, to);

    const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery;
    if (fallbackError) throw fallbackError;

    const works = await Promise.all(
      fallbackData.map(async (item) => {
        const likeCount = await getWorkLikeCount(item.id);
        return { ...mapWork(item), like_count: likeCount };
      })
    );
    return { works, total: fallbackCount || 0 };
  }

  return { works: data.map((item) => mapWork(item)), total: count || 0 };
};

// ========== 高分作品（首页轮播：仅网站类、公开） ==========
export const getTopRatedWorks = async (limit = 8) => {
  let query = supabase
    .from('works_with_likes')
    .select(VIEW_SELECT)
    .eq('work_type', 'website')
    .eq('visibility', 'public')
    .order('like_count', { ascending: false })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    console.warn('⚠️ 高分作品视图查询失败，使用降级方案:', error.message);
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('works')
      .select(TABLE_SELECT)
      .eq('work_type', 'website')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (fallbackError) throw fallbackError;

    const works = await Promise.all(
      fallbackData.map(async (item) => {
        const likeCount = await getWorkLikeCount(item.id);
        return { ...mapWork(item), like_count: likeCount };
      })
    );
    return works.sort((a, b) => b.like_count - a.like_count).slice(0, limit);
  }

  return data.map((item) => mapWork(item));
};

// ========== 获取单个作品 ==========
export const getWorkById = async (id, currentUserId = null) => {
  const { data, error } = await supabase
    .from('works')
    .select(TABLE_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  if (!data) return null;

  const work = mapWork(data);
  work.like_count = await getWorkLikeCount(id);
  if (currentUserId) {
    work.liked_by_user = await hasLikedWork(id, currentUserId);
    work.favorited_by_user = await hasFavoritedWork(id, currentUserId);
  }
  return work;
};

// ========== 某用户的作品（他人只见公开，本人见全部） ==========
export const getWorksByUser = async (
  userId,
  { page = 1, pageSize = 20, currentUserId = null, groupId = null, visibility = null } = {}
) => {
  const isOwner = !!currentUserId && currentUserId === userId;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('works_with_likes')
    .select(VIEW_SELECT, { count: 'exact' })
    .eq('user_id', userId);

  if (!isOwner) {
    query = query.eq('visibility', 'public');
  } else if (visibility) {
    query = query.eq('visibility', visibility);
  }

  if (groupId === 'none') query = query.is('group_id', null);
  else if (groupId) query = query.eq('group_id', groupId);

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { works: data.map((item) => mapWork(item)), total: count || 0 };
};

// ========== 更新作品 ==========
export const updateWork = async (id, data) => {
  const {
    url,
    title = '',
    description,
    image_url,
    cover_url,
    work_type,
    status,
    visibility,
    group_id,
    changelog,
    featured,
  } = data || {};

  if (!title || !title.trim()) throw new Error('标题不能为空');
  const trimmedTitle = title.trim();
  const trimmedType = work_type || 'website';

  const current = await getWorkById(id);
  if (!current) throw new Error('作品不存在');

  let trimmedUrl = current.url;
  if (trimmedType === 'website') {
    const newUrl = normalizeUrl(url);
    if (!newUrl) throw new Error('网站类作品必须填写 URL');
    trimmedUrl = newUrl;
    if (trimmedUrl !== current.url) {
      const exists = await checkUrlExists(trimmedUrl);
      if (exists) throw new Error('该网址已存在，无法重复创建。');
    }
  } else {
    trimmedUrl = null; // 非网站类作品不保留 URL
  }

  const patch = {
    url: trimmedUrl,
    title: trimmedTitle,
    description: description?.trim() || null,
    work_type: trimmedType,
    visibility: visibility === 'private' ? 'private' : 'public',
    changelog: changelog?.trim() || null,
  };
  if (image_url !== undefined) patch.image_url = image_url || null;
  if (cover_url !== undefined) patch.cover_url = cover_url || null;
  if (status !== undefined) patch.status = status || null;
  if (group_id !== undefined) patch.group_id = group_id || null;
  if (featured !== undefined) patch.featured = !!featured;

  const { data: updated, error } = await supabase
    .from('works')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapWork(updated);
};

// ========== 删除作品 ==========
export const deleteWork = async (id) => {
  const { error } = await supabase.from('works').delete().eq('id', id);
  if (error) throw error;
};

// ========== 快捷操作 ==========
export const setWorkFeatured = async (id, featured) => {
  const { error } = await supabase
    .from('works')
    .update({ featured: !!featured })
    .eq('id', id);
  if (error) throw error;
};

export const setWorkVisibility = async (id, visibility) => {
  const { error } = await supabase
    .from('works')
    .update({ visibility: visibility === 'private' ? 'private' : 'public' })
    .eq('id', id);
  if (error) throw error;
};

// ========== 点赞 ==========
export const getWorkLikeCount = async (workId) => {
  try {
    const { count, error } = await supabase
      .from('website_likes')
      .select('*', { count: 'exact', head: true })
      .eq('website_id', workId);
    if (error) throw error;
    return count || 0;
  } catch (e) {
    console.warn('获取点赞数失败:', e.message);
    return 0;
  }
};

export const hasLikedWork = async (workId, userId) => {
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from('website_likes')
      .select('id')
      .eq('website_id', workId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  } catch (e) {
    console.warn('检查点赞状态失败:', e.message);
    return false;
  }
};

export const likeWork = async (workId, userId) => {
  const { error } = await supabase
    .from('website_likes')
    .insert({ website_id: workId, user_id: userId });
  if (error) throw error;
};

export const unlikeWork = async (workId, userId) => {
  const { error } = await supabase
    .from('website_likes')
    .delete()
    .eq('website_id', workId)
    .eq('user_id', userId);
  if (error) throw error;
};

// ========== 收藏 ==========
export const getWorkFavoriteCount = async (workId) => {
  try {
    const { data, error } = await supabase.rpc('get_work_favorite_count', {
      p_work_id: workId,
    });
    if (error) throw error;
    return data || 0;
  } catch (e) {
    console.warn('获取收藏数失败:', e.message);
    return 0;
  }
};

export const hasFavoritedWork = async (workId, userId) => {
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('work_id', workId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  } catch (e) {
    console.warn('检查收藏状态失败:', e.message);
    return false;
  }
};

export const favoriteWork = async (workId, userId) => {
  const { error } = await supabase
    .from('favorites')
    .insert({ work_id: workId, user_id: userId });
  if (error) throw error;
};

export const unfavoriteWork = async (workId, userId) => {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('work_id', workId)
    .eq('user_id', userId);
  if (error) throw error;
};

// 我的收藏列表（本人收藏的作品）
export const getMyFavoriteWorks = async (userId) => {
  const { data, error } = await supabase
    .from('favorites')
    .select(`id, created_at, works ( ${TABLE_SELECT.replace(/\s+/g, ' ')} )`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || [])
    .filter((f) => f.works)
    .map((f) => ({ favorite_id: f.id, favorited_at: f.created_at, work: mapWork(f.works) }));
};

// ========== 分组 ==========
export const listGroups = async (userId) => {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createGroup = async (userId, name) => {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('分组名不能为空');
  if (trimmed.length > 30) throw new Error('分组名不能超过 30 字');
  const { data, error } = await supabase
    .from('groups')
    .insert({ user_id: userId, name: trimmed })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('已存在同名分组');
    throw error;
  }
  return data;
};

export const renameGroup = async (groupId, name) => {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('分组名不能为空');
  if (trimmed.length > 30) throw new Error('分组名不能超过 30 字');
  const { data, error } = await supabase
    .from('groups')
    .update({ name: trimmed })
    .eq('id', groupId)
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('已存在同名分组');
    throw error;
  }
  return data;
};

export const deleteGroup = async (groupId) => {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) throw error;
};

export const assignWorkGroup = async (workId, groupId) => {
  const { error } = await supabase
    .from('works')
    .update({ group_id: groupId || null })
    .eq('id', workId);
  if (error) throw error;
};
