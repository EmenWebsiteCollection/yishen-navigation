// src/services/websites.js
import { supabase } from './supabase.js';

// ========== 原有函数 ==========
export const checkUrlExists = async (url) => {
  const { data, error } = await supabase
    .from('websites')
    .select('id')
    .eq('url', url)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
};

export const createWebsite = async (url, title, description, userId) => {
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
    .insert([{ url, title, description, user_id: userId }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getWebsites = async () => {
  // 先获取所有网站基本信息
  const { data: websites, error } = await supabase
    .from('websites')
    .select(`
      id,
      url,
      title,
      description,
      created_at,
      updated_at,
      user_id,
      profiles ( username )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // 对每个网站查询点赞数（若表不存在则返回0）
  const websitesWithLikes = await Promise.all(
    websites.map(async (item) => {
      let likeCount = 0;
      try {
        const { count } = await supabase
          .from('website_likes')
          .select('*', { count: 'exact', head: true })
          .eq('website_id', item.id);
        likeCount = count || 0;
      } catch (e) {
        // 忽略点赞表不存在错误
        console.warn('点赞表未就绪，忽略点赞数据');
      }
      return {
        id: item.id,
        url: item.url,
        title: item.title,
        description: item.description || '',
        created_at: item.created_at,
        updated_at: item.updated_at,
        user_id: item.user_id,
        username: item.profiles?.username || '用户',
        like_count: likeCount,
        liked_by_user: false, // 前端会单独填充
      };
    })
  );

  // 按点赞数降序
  websitesWithLikes.sort((a, b) => b.like_count - a.like_count);
  return websitesWithLikes;
};

export const getWebsiteById = async (id) => {
  const { data, error } = await supabase
    .from('websites')
    .select(`
      id,
      url,
      title,
      description,
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
  } catch (e) {
    // 忽略
  }

  return {
    id: data.id,
    url: data.url,
    title: data.title,
    description: data.description || '',
    user_id: data.user_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
    username: data.profiles?.username || '用户',
    like_count: likeCount,
    liked_by_user: false,
  };
};

export const updateWebsite = async (id, data) => {
  const { title, description } = data;
  if (!title || title.trim() === '') {
    throw new Error('标题不能为空');
  }
  const { data: updated, error } = await supabase
    .from('websites')
    .update({ 
      title: title.trim(), 
      description: description?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return updated;
};

export const deleteWebsite = async (id) => {
  const { error } = await supabase
    .from('websites')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// ========== 新增点赞相关函数 ==========
export const getWebsiteLikeCount = async (websiteId) => {
  try {
    const { count, error } = await supabase
      .from('website_likes')
      .select('*', { count: 'exact', head: true })
      .eq('website_id', websiteId);
    if (error) throw error;
    return count || 0;
  } catch (e) {
    console.warn('获取点赞数失败（可能表未创建）:', e.message);
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