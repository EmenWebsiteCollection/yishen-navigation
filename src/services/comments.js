// src/services/comments.js
import { supabase } from './supabase.js';

/**
 * 获取某个网站的所有评论（按时间降序）
 * @param {string} websiteId - 网站 UUID
 * @returns {Promise<Array>} 评论数组，包含 id, content, created_at, user_id, username
 */
export const getCommentsByWebsite = async (websiteId) => {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      id,
      content,
      created_at,
      user_id,
      profiles ( username )
    `)
    .eq('website_id', websiteId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map((comment) => ({
    id: comment.id,
    content: comment.content,
    created_at: comment.created_at,
    user_id: comment.user_id,
    username: comment.profiles?.username || '用户',
  }));
};

/**
 * 发表新评论
 * @param {string} websiteId - 网站 UUID
 * @param {string} userId - 当前用户 ID (profiles.id)
 * @param {string} content - 评论内容
 * @returns {Promise<object>} 新评论对象
 */
export const createComment = async (websiteId, userId, content) => {
  const { data, error } = await supabase
    .from('comments')
    .insert({ website_id: websiteId, user_id: userId, content })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * 删除评论
 * @param {string} commentId - 评论 UUID
 * @returns {Promise<void>}
 */
export const deleteComment = async (commentId) => {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
};