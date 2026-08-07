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
  // 前端服务层兜底校验（数据库层另有 CHECK 约束）
  const trimmed = (content || '').trim();
  if (!trimmed) throw new Error('评论不能为空');
  if (trimmed.length > 1000) throw new Error('评论不能超过 1000 字');
  if ((trimmed.match(/\n/g) || []).length > 10) throw new Error('评论中的换行不能超过 10 个');

  const { data, error } = await supabase
    .from('comments')
    .insert({ website_id: websiteId, user_id: userId, content: trimmed })
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