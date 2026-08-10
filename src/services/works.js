// src/services/works.js
// 作品（works）服务层：由原 websites.js 演进而来。
// websites 表已泛化为 works，网站只是 work_type='website' 的一种作品。
import { supabase } from './supabase.js';
import { normalizeTagList } from './discovery-logic.js';
import { createRevisionSnapshot, isRevisionsSupported } from './revisions.js';
import { getPartitionLabel } from './partitions.js';

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
  getPartitionLabel(type) ||
  WORK_TYPES.find((t) => t.id === type)?.label ||
  type ||
  '作品';

export const workStatusLabel = (status) =>
  WORK_STATUS.find((s) => s.id === status)?.label || status || '';

// ========== Issue #39 P1：创作标签体系常量 ==========
export const CREATIVE_TYPES = [
  { id: 'original', label: '原创' },
  { id: 'derivative', label: '二创' },
  { id: 'collab', label: '合作' },
  { id: 'commission', label: '委托' },
  { id: 'practice', label: '练习' },
];

export const AI_DEGREES = [
  { id: 'none', label: '纯人工' },
  { id: 'assisted', label: 'AI 辅助' },
  { id: 'mixed', label: '人机共创' },
  { id: 'generated', label: 'AI 生成' },
  { id: 'unknown', label: '未知' },
];

export const AUDIENCES = [
  { id: 'all', label: '全年龄' },
  { id: 'teen', label: '青少年' },
  { id: 'adult', label: '成人向' },
];

export const CONTENT_WARNINGS = [
  { id: 'violence', label: '暴力' },
  { id: 'horror', label: '恐怖' },
  { id: 'blood', label: '血腥' },
  { id: 'adult', label: '成人内容' },
  { id: 'spoil', label: '剧透' },
  { id: 'other', label: '其他' },
];

export const creativeTypeLabel = (t) => CREATIVE_TYPES.find((x) => x.id === t)?.label || t || '';
export const aiDegreeLabel = (t) => AI_DEGREES.find((x) => x.id === t)?.label || t || '未知';
export const audienceLabel = (t) => AUDIENCES.find((x) => x.id === t)?.label || t || '';

// ========== 基础 ==========
export const normalizeUrl = (url) => {
  if (!url) return url;
  return url.trim().replace(/\/+$/, '');
};

// 内部辅助：判断当前用户是否为管理员（profiles.is_admin）
export const isAdmin = async (userId) => {
  if (!userId) return false;
  try {
    // 走 SECURITY DEFINER RPC（基于 auth.uid() 判定），不再直读 is_admin 列
    const { data } = await supabase.rpc('is_admin');
    return !!data;
  } catch (e) {
    return false;
  }
};

// works 表直查字段（含 profiles 关联）。
// ⚠️ video_url 列依赖迁移 20260808_add_works_video_url.sql，未执行前数据库无此列，
//    因此拆成「基础字段」+「video_url」，查询前运行时探测列是否存在，缺列时自动降级。
const TABLE_SELECT_CORE = `
  id, url, title, description, image_url, cover_url, work_type,
  featured, status, visibility, group_id, changelog, source_idea_id,
  created_at, updated_at, user_id,
  profiles ( username, avatar_url )
`;
const TABLE_SELECT_FULL = `${TABLE_SELECT_CORE}, video_url`;
// Issue #39 P1：创作标签体系/媒体直链（依赖迁移 20260808_add_discovery.sql）
const TABLE_SELECT_META = `
  tags, styles, tools, creative_type, completion,
  seeking_collab, derivative_allowed, commercial_use,
  ai_degree, audience, content_warning, media_url
`;

// works_with_likes 视图字段（视图已 join profiles）
// ⚠️ 视图未包含 video_url（列表页不需要），若需列表展示需由团队重建视图并补列
const VIEW_SELECT = `
  id, url, title, description, image_url, cover_url, media_url,
  work_type, featured, status, visibility, group_id, changelog,
  tags, styles, tools, creative_type, completion, seeking_collab,
  derivative_allowed, commercial_use, ai_degree, audience, content_warning,
  created_at, updated_at, user_id, view_count, source_idea_id, video_url, deploy_url, deploy_updated_at,
  like_count, username, avatar_url
`;

// 运行时探测 works.video_url 列是否存在（结果缓存，避免每次请求都探测）
let _videoUrlSupported = null;
export const isVideoUrlSupported = async () => {
  if (_videoUrlSupported !== null) return _videoUrlSupported;
  try {
    const { error } = await supabase.from('works').select('video_url').limit(1);
    _videoUrlSupported = !error;
  } catch {
    _videoUrlSupported = false;
  }
  return _videoUrlSupported;
};

// 运行时探测 Issue #39 新增列是否存在（迁移未执行时自动降级）
let _metaSupported = null;
export const isMetaSupported = async () => {
  if (_metaSupported !== null) return _metaSupported;
  try {
    const { error } = await supabase.from('works').select('tags, ai_degree').limit(1);
    _metaSupported = !error;
  } catch {
    _metaSupported = false;
  }
  return _metaSupported;
};

// 返回当前可用的 works 直查 select：列存在时含 video_url/meta，否则降级为基础字段
const getTableSelect = async () => {
  const parts = [TABLE_SELECT_CORE];
  if (await isVideoUrlSupported()) parts.push('video_url');
  if (await isMetaSupported()) parts.push(TABLE_SELECT_META);
  return parts.join(',\n  ');
};

const mapWork = (item) => {
  const p = item.profiles || {};
  return {
    id: item.id,
    url: item.url || null,
    title: item.title,
    description: item.description || '',
    image_url: item.image_url || null,
    cover_url: item.cover_url || null,
    video_url: item.video_url || null,
    work_type: item.work_type || 'website',
    featured: !!item.featured,
    status: item.status || null,
    visibility: item.visibility || 'public',
    group_id: item.group_id || null,
    changelog: item.changelog || null,
    source_idea_id: item.source_idea_id || null,
    created_at: item.created_at,
    updated_at: item.updated_at,
    user_id: item.user_id,
    username: p.username || item.username || '用户',
    avatar_url: p.avatar_url || item.avatar_url || null,
    like_count: item.like_count ?? 0,
    view_count: item.view_count ?? 0,
    liked_by_user: false,
    favorited_by_user: false,
    // Issue #39 P1 创作标签体系
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
    media_url: item.media_url || null,
  };
};

// Issue #39 P1：创作标签体系字段清洗与校验（纯逻辑，可复用）
export const normalizeWorkMeta = (payload = {}) => {
  const out = {};
  const tags = normalizeTagList(payload.tags);
  const styles = normalizeTagList(payload.styles);
  const tools = normalizeTagList(payload.tools);
  const cw = normalizeTagList(payload.content_warning, { max: 6, maxLen: 20 });

  if (payload.tags !== undefined) out.tags = tags;
  if (payload.styles !== undefined) out.styles = styles;
  if (payload.tools !== undefined) out.tools = tools;
  if (payload.content_warning !== undefined) out.content_warning = cw;

  if (payload.creative_type !== undefined) {
    if (payload.creative_type && !CREATIVE_TYPES.some((c) => c.id === payload.creative_type)) {
      throw new Error('未知的创作类型');
    }
    out.creative_type = payload.creative_type || null;
  }
  if (payload.completion !== undefined && payload.completion !== null && payload.completion !== '') {
    const n = Number(payload.completion);
    if (!Number.isInteger(n) || n < 0 || n > 100) throw new Error('完成度需为 0-100 的整数');
    out.completion = n;
  } else if (payload.completion !== undefined) {
    out.completion = null;
  }
  if (payload.seeking_collab !== undefined) out.seeking_collab = !!payload.seeking_collab;
  if (payload.derivative_allowed !== undefined) out.derivative_allowed = payload.derivative_allowed !== false;
  if (payload.commercial_use !== undefined) out.commercial_use = !!payload.commercial_use;
  if (payload.ai_degree !== undefined) {
    if (!AI_DEGREES.some((d) => d.id === payload.ai_degree)) throw new Error('未知的 AI 参与程度');
    out.ai_degree = payload.ai_degree;
  }
  if (payload.audience !== undefined) {
    if (payload.audience && !AUDIENCES.some((a) => a.id === payload.audience)) throw new Error('未知的适合受众');
    out.audience = payload.audience || null;
  }
  if (payload.media_url !== undefined) out.media_url = (payload.media_url || '').trim() || null;
  return out;
};

export const checkUrlExists = async (url) => {
  const normalized = normalizeUrl(url);
  if (!normalized) return false;
  const { data, error } = await supabase
    .from('works')
    .select('id')
    .eq('url', normalized)
    .maybeSingle();
  if (error) throw error;
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
    video_url = null,
    work_type = 'website',
    status = null,
    visibility = 'public',
    group_id = null,
    changelog = null,
    source_idea_id = null,
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

  const insertRow = {
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
    source_idea_id: source_idea_id || null,
    user_id: userId,
  };
  if (await isVideoUrlSupported()) insertRow.video_url = video_url?.trim() || null;
  if (await isMetaSupported()) Object.assign(insertRow, normalizeWorkMeta(payload));
  const { data, error } = await supabase
    .from('works')
    .insert([insertRow])
    .select()
    .single();
  if (error) throw error;
  const created = mapWork(data);

  // 首次上传也生成版本快照（成长档案），失败不影响作品创建
  try {
    if (await isRevisionsSupported()) {
      await createRevisionSnapshot(data.id);
    }
  } catch (e) {
    console.warn('创建版本快照失败:', e.message);
  }

  return created;
};

// ========== 分页查询（首页网站导航，可扩展任意类型） ==========
export const getWorks = async ({ page = 1, pageSize = 10, type = 'website', userId = null } = {}) => {
  // 分页参数钳制，防止 416/超大请求
  page = Math.max(1, Math.floor(Number(page) || 1));
  pageSize = Math.min(50, Math.max(1, Math.floor(Number(pageSize) || 10)));
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
      .select(await getTableSelect(), { count: 'exact' });
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

// 高分作品（首页轮播：公开作品按点赞排序）。
// diversify=true 时按作品类型轮换入选，保证高分榜单不被单一类型（如网站）独占。
export const getTopRatedWorks = async (limit = 8, { diversify = false } = {}) => {
  // 多样式榜单需要更大的候选池，保证各类型都能补位
  const pool = diversify ? limit * 4 : limit;

  let query = supabase
    .from('works_with_likes')
    .select(VIEW_SELECT)
    .eq('visibility', 'public')
    .order('like_count', { ascending: false })
    .limit(pool);

  const { data, error } = await query;

  if (error) {
    console.warn('⚠️ 高分作品视图查询失败，使用降级方案:', error.message);
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('works')
      .select(await getTableSelect())
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(pool);
    if (fallbackError) throw fallbackError;

    const works = await Promise.all(
      fallbackData.map(async (item) => {
        const likeCount = await getWorkLikeCount(item.id);
        return { ...mapWork(item), like_count: likeCount };
      })
    );
    works.sort((a, b) => b.like_count - a.like_count);
    return diversify ? diversifyByType(works, limit) : works.slice(0, limit);
  }

  const works = data.map((item) => mapWork(item));
  return diversify ? diversifyByType(works, limit) : works;
};

// 按作品类型轮换取前 limit 个：同类型只占一个名额，各类作品都能上榜
const diversifyByType = (works, limit) => {
  const byType = {};
  works.forEach((w) => {
    if (!byType[w.work_type]) byType[w.work_type] = [];
    byType[w.work_type].push(w);
  });
  const types = Object.keys(byType);
  const result = [];
  let i = 0;
  while (result.length < limit && i < limit * types.length) {
    const next = byType[types[i % types.length]]?.shift();
    if (next) result.push(next);
    i += 1;
  }
  return result;
};

// ========== 获取单个作品 ==========
export const getWorkById = async (id, currentUserId = null) => {
  // 优先走视图（like_count 一次拿全，游客也能看到点赞数）
  const { data, error } = await supabase
    .from('works_with_likes')
    .select(VIEW_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    // 视图不可用时降级到表直查（点赞数单独获取，失败为 0）
    const { data: tableData, error: tableError } = await supabase
      .from('works')
      .select(await getTableSelect())
      .eq('id', id)
      .maybeSingle();
    if (tableError) {
      throw tableError;
    }
    if (!tableData) return null;
    const work = mapWork(tableData);
    work.like_count = await getWorkLikeCount(id);
    if (currentUserId) {
      work.liked_by_user = await hasLikedWork(id, currentUserId);
      work.favorited_by_user = await hasFavoritedWork(id, currentUserId);
    }
    return work;
  }
  if (!data) return null;

  const work = mapWork(data);
  // 视图不含 video_url，列存在时单独补查（探测结果有缓存，无额外开销）
  if (await isVideoUrlSupported()) {
    const { data: v } = await supabase
      .from('works')
      .select('video_url')
      .eq('id', id)
      .maybeSingle();
    work.video_url = v?.video_url || null;
  }
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
    video_url,
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
  if (video_url !== undefined && (await isVideoUrlSupported())) patch.video_url = video_url?.trim() || null;
  if (status !== undefined) patch.status = status || null;
  if (group_id !== undefined) patch.group_id = group_id || null;
  if (featured !== undefined) patch.featured = !!featured;
  if (await isMetaSupported()) Object.assign(patch, normalizeWorkMeta(data));

  const { data: updated, error } = await supabase
    .from('works')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  // Issue #39 P3：作品更新后自动生成版本快照（成长档案）
  try {
    if (await isRevisionsSupported()) {
      await createRevisionSnapshot(id, data._revision || {});
    }
  } catch (e) {
    console.warn('创建版本快照失败:', e.message);
  }

  return mapWork(updated);
};

// ========== 删除作品 ==========
// 审计遗留 LOW：删作品时顺带清理 work_deploys 桶里的部署文件（孤儿文件级联清理）。
// workDeploys 桶路径结构为 work_id/...，递归列出所有文件后一并删除；
// 存储桶删除失败不阻断作品删除（数据库记录仍删，文件留待下次清理）。
const DEPLOY_BUCKET = 'work_deploys';

async function listDeployFiles(prefix) {
  const { data, error } = await supabase.storage.from(DEPLOY_BUCKET).list(prefix, { limit: 500 });
  if (error) throw error;
  const paths = [];
  for (const item of data || []) {
    const full = `${prefix}/${item.name}`;
    // Supabase Storage list 返回的目录项无 id（文件项有 id）
    if (item.id) {
      paths.push(full);
    } else {
      const nested = await listDeployFiles(full);
      paths.push(...nested);
    }
  }
  return paths;
}

async function removeWorkDeployFiles(workId) {
  const paths = await listDeployFiles(String(workId));
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(DEPLOY_BUCKET).remove(paths);
  if (error) throw error;
}

export const deleteWork = async (id) => {
  try {
    await removeWorkDeployFiles(id);
  } catch (e) {
    console.warn(`清理部署文件失败（不影响作品删除）：${e.message}`);
  }
  const { error } = await supabase.rpc('rpc_delete_website', { website_id: id });
  if (error) throw error;
};

// ========== 快捷操作 ==========
// Issue #50：精选仅管理员可设。走 set_featured RPC（内部 is_admin() 校验），
// 不再直接 UPDATE works（避免绕过管理员校验 + 005 迁移已列级收回 featured 列权限）。
export const setWorkFeatured = async (id, featured) => {
  const { error } = await supabase.rpc('set_featured', {
    p_work_id: id,
    p_featured: !!featured,
  });
  if (error) throw error;
};

export const setWorkMeta = async (id, meta) => {
  const normalized = normalizeWorkMeta(meta);
  if (Object.keys(normalized).length === 0) return null;
  if (!(await isMetaSupported())) throw new Error('创作标签功能尚未就绪（迁移未执行）');
  const { data, error } = await supabase
    .from('works')
    .update(normalized)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapWork(data);
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
    if (error) throw error;
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
  if (error) {
    if (error.code === '23505') throw new Error('你已经点过赞了');
    throw error;
  }
};

export const unlikeWork = async (workId, userId) => {
  const { error } = await supabase.rpc('rpc_unlike', { target_website_id: workId });
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
    if (error) throw error;
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
  const { error } = await supabase.rpc('rpc_unfavorite', { target_work_id: workId });
  if (error) throw error;
};

// 我的收藏列表（本人收藏的作品）
export const getMyFavoriteWorks = async (userId) => {
  const workSelect = (await getTableSelect()).replace(/\s+/g, ' ');
  const { data, error } = await supabase
    .from('favorites')
    .select(`id, created_at, works ( ${workSelect} )`)
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
  const { error } = await supabase.rpc('rpc_delete_group', { target_group_id: groupId });
  if (error) throw error;
};

export const assignWorkGroup = async (workId, groupId) => {
  const { error } = await supabase
    .from('works')
    .update({ group_id: groupId || null })
    .eq('id', workId);
  if (error) throw error;
};

// ========== 浏览量统计 ==========
// 调用 RPC（security definer，游客也可触发计数），失败静默不影响主流程
export const incrementView = async (workId) => {
  if (!workId) return;
  try {
    await supabase.rpc('rpc_increment_view', { p_work_id: workId });
  } catch (e) {
    console.warn('浏览量计数失败:', e.message);
  }
};

