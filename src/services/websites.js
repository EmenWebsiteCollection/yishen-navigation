// src/services/websites.js
import { supabase } from './supabase.js';

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
  const { data, error } = await supabase
    .from('websites')
    .select(`
      id,
      url,
      title,
      created_at,
      profiles ( username )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((item) => ({
    id: item.id,
    url: item.url,
    title: item.title,
    created_at: item.created_at,
    username: item.profiles?.username || '用户',
  }));
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
  return {
    id: data.id,
    url: data.url,
    title: data.title,
    description: data.description || '',
    user_id: data.user_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
    username: data.profiles?.username || '用户',
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

// 在文件末尾添加
export const deleteWebsite = async (id) => {
  const { error } = await supabase
    .from('websites')
    .delete()
    .eq('id', id);
  if (error) throw error;
};