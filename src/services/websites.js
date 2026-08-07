// src/services/websites.js
import { supabase } from './supabase.js';

// ========== 基础函数 ==========
// URL 规范化：去掉结尾斜杠，避免 https://a.com 与 https://a.com/ 被视为不同网址
export const normalizeUrl = (url) => {
  if (!url) return url;
  return url.trim().replace(/\/+$/, '');
};

export const checkUrlExists = async (url) => {
  const { data, error } = await supabase
    .from('websites')
    .select('id')
    .eq('url', normalizeUrl(url))
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
};

export const createWebsite = async (url, title, description, userId, imageUrl = null) => {
  url = normalizeUrl(url);
  const exists = await checkUrlExists(url);
  if (exists) throw new Error('该网址已存在，无法重复创建。');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw new Error('用户资料获取失败，请重新登录。');
  if (!profile) throw new Error('用户资料不存在，请重新登录。');

  const { data, error } = await supabase
    .from('websites')
    .insert([{ 
      url, 
      title, 
      description, 
      user_id: userId,
      image_url: imageUrl 
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ========== 分页查询（使用视图，按点赞数排序） ==========
export const getWebsites = async (page = 1, pageSize = 10) => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('websites_with_likes')
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
      `,
      { count: 'exact' }
    )
    .order('like_count', { ascending: false })
    .range(from, to);

  if (error) {
    console.warn('⚠️ 视图查询失败，使用降级方案:', error.message);
    // 降级方案：直接查 websites 表
    const { data: fallbackData, error: fallbackError, count: fallbackCount } = await supabase
      .from('websites')
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
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (fallbackError) throw fallbackError;

    // 手动获取点赞数
    const websites = await Promise.all(
      fallbackData.map(async (item) => {
        let likeCount = 0;
        try {
          const { count } = await supabase
            .from('website_likes')
            .select('*', { count: 'exact', head: true })
            .eq('website_id', item.id);
          likeCount = count || 0;
        } catch (e) {}
        return {
          id: item.id,
          url: item.url,
          title: item.title,
          description: item.description || '',
          image_url: item.image_url || null,
          created_at: item.created_at,
          updated_at: item.updated_at,
          user_id: item.user_id,
          username: item.profiles?.username || '用户',
          like_count: likeCount,
          liked_by_user: false,
        };
      })
    );

    return { websites, total: fallbackCount || 0 };
  }

  const websites = data.map((item) => ({
    id: item.id,
    url: item.url,
    title: item.title,
    description: item.description || '',
    image_url: item.image_url || null,
    created_at: item.created_at,
    updated_at: item.updated_at,
    user_id: item.user_id,
    username: item.profiles?.username || '用户',
    like_count: item.like_count || 0,
    liked_by_user: false,
  }));

  return {
    websites,
    total: count || 0,
  };
};

// ========== 获取单个网站 ==========
export const getWebsiteById = async (id) => {
  const { data, error } = await supabase
    .from('websites')
    .select(`
      id,
      url,
      title,
      description,
      image_url,
      user_id,
      created_at,
      updated_at,
      profiles ( username )
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  let likeCount = 0;
  try {
    const { count } = await supabase
      .from('website_likes')
      .select('*', { count: 'exact', head: true })
      .eq('website_id', id);
    likeCount = count || 0;
  } catch (e) {}

  return {
    id: data.id,
    url: data.url,
    title: data.title,
    description: data.description || '',
    image_url: data.image_url || null,
    user_id: data.user_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
    username: data.profiles?.username || '用户',
    like_count: likeCount,
    liked_by_user: false,
  };
};

// ========== 更新网站（允许修改 URL、标题、描述、图片） ==========
export const updateWebsite = async (id, data) => {
  const { url, title, description, image_url } = data;
  if (!title || title.trim() === '') throw new Error('标题不能为空');
  if (!url || url.trim() === '') throw new Error('URL 不能为空');
  const trimmedUrl = normalizeUrl(url);
  const trimmedTitle = title.trim();
  const trimmedDesc = description?.trim() || null;

  const current = await getWebsiteById(id);
  if (!current) throw new Error('网站不存在');
  if (trimmedUrl !== current.url) {
    const exists = await checkUrlExists(trimmedUrl);
    if (exists) throw new Error('该网址已存在，无法重复创建。');
  }

  const { data: updated, error } = await supabase
    .from('websites')
    .update({
      url: trimmedUrl,
      title: trimmedTitle,
      description: trimmedDesc,
      image_url: image_url || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return updated;
};

// ========== 删除网站 ==========
export const deleteWebsite = async (id) => {
  const { error } = await supabase.from('websites').delete().eq('id', id);
  if (error) throw error;
};

// ========== 点赞相关 ==========
export const getWebsiteLikeCount = async (websiteId) => {
  try {
    const { count, error } = await supabase
      .from('website_likes')
      .select('*', { count: 'exact', head: true })
      .eq('website_id', websiteId);
    if (error) throw error;
    return count || 0;
  } catch (e) {
    console.warn('获取点赞数失败:', e.message);
    return 0;
  }
};

export const hasLikedWebsite = async (websiteId, userId) => {
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from('website_likes')
      .select('id')
      .eq('website_id', websiteId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  } catch (e) {
    console.warn('检查点赞状态失败:', e.message);
    return false;
  }
};

export const likeWebsite = async (websiteId, userId) => {
  const { error } = await supabase
    .from('website_likes')
    .insert({ website_id: websiteId, user_id: userId });
  if (error) throw error;
};

export const unlikeWebsite = async (websiteId, userId) => {
  const { error } = await supabase
    .from('website_likes')
    .delete()
    .eq('website_id', websiteId)
    .eq('user_id', userId);
  if (error) throw error;
};