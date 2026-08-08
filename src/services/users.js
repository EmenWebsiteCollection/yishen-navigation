// src/services/users.js
// 创作者档案与统计
import { supabase } from './supabase.js';

// 可公开读取的字段（不含 email/phone/is_admin 等敏感列）
const PUBLIC_PROFILE_COLS = [
  'id',
  'username',
  'avatar_url',
  'bio',
  'cover_url',
  'expertise',
  'tools',
  'style_tags',
  'current_project',
  'creation_progress',
  'collab_status',
  'commission_status',
  'services',
  'website_link',
  'socials',
  'website_link',
  'accent_color',
  'bg_color',
  'created_at',
  'updated_at',
].join(',');

// 本人可更新的字段白名单（禁止提权/改敏感信息）
const EDITABLE_PROFILE_FIELDS = [
  'username',
  'avatar_url',
  'bio',
  'cover_url',
  'expertise',
  'tools',
  'style_tags',
  'current_project',
  'creation_progress',
  'collab_status',
  'commission_status',
  'services',
  'website_link',
  'socials',
  'website_link',
  'accent_color',
  'bg_color',
];

/**
 * 获取用户档案（仅公开字段）
 * @param {string} userId - profiles.id
 * @returns {Promise<object|null>}
 */
export const getProfile = async (userId) => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_COLS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
};

/**
 * 更新本人档案（RLS 保证只能改自己；字段白名单防止自提权）
 * @param {string} userId
 * @param {object} data - 需要更新的字段
 * @returns {Promise<object>}
 */
export const updateProfile = async (userId, data) => {
  const patch = { updated_at: new Date().toISOString() };
  for (const key of EDITABLE_PROFILE_FIELDS) {
    if (data[key] !== undefined) patch[key] = data[key];
  }
  const { data: updated, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return updated;
};

/**
 * 绑定/更新当前用户的邮箱与手机号（供找回密码使用）
 * 调用服务端 SECURITY DEFINER 函数 public.bind_contact。
 * @param {{email?:string, phone?:string}} contact
 * @returns {Promise<object>} 更新后的 profile
 */
export const bindContact = async ({ email, phone } = {}) => {
  const { data, error } = await supabase.rpc('bind_contact', {
    p_email: email || null,
    p_phone: phone || null,
  });
  if (error) throw error;
  return data;
};

/**
 * 创作者统计（只统计公开作品）
 * @param {string} userId
 * @returns {Promise<{work_count:number, like_count:number, favorite_count:number, comment_count:number}>}
 */
export const getCreatorStats = async (userId) => {
  const fallback = { work_count: 0, like_count: 0, favorite_count: 0, comment_count: 0 };
  try {
    const { data, error } = await supabase.rpc('get_creator_stats', {
      p_user_id: userId,
    });
    if (error) throw error;
    return { ...fallback, ...(data || {}) };
  } catch (e) {
    console.warn('获取创作者统计失败:', e.message);
    return fallback;
  }
};
