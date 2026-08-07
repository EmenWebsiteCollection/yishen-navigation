// src/services/comments.js
import { supabase } from './supabase.js';

/**
 * 获取某个网站的所有评论（含回复，按时间升序，前端自行分组）
 * @param {string} websiteId - 网站 UUID
 * @returns {Promise<Array>} 评论数组，包含 id, content, created_at, user_id, parent_id, username
 */
export const getCommentsByWebsite = async (websiteId) => {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      id,
      content,
      created_at,
      user_id,
      parent_id,
      profiles ( username )
    `)
    .eq('website_id', websiteId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return data.map((comment) => ({
    id: comment.id,
    content: comment.content,
    created_at: comment.created_at,
    user_id: comment.user_id,
    parent_id: comment.parent_id,
    username: comment.profiles?.username || '用户',
  }));
};

/**
 * 发表新评论或回复
 * @param {string} websiteId - 网站 UUID
 * @param {string} userId - 当前用户 ID (profiles.id)
 * @param {string} content - 评论内容
 * @param {string|null} parentId - 回复某条评论时传它的 id；顶级评论传 null
 * @returns {Promise<object>} 新评论对象
 */
export const createComment = async (websiteId, userId, content, parentId = null) => {
  const trimmed = (content || '').trim();
  if (!trimmed) throw new Error('评论不能为空');
  if (trimmed.length > 1000) throw new Error('评论不能超过 1000 字');
  if ((trimmed.match(/\n/g) || []).length > 10) throw new Error('评论中的换行不能超过 10 个');
  const { data, error } = await supabase
    .from('comments')
    .insert({ website_id: websiteId, user_id: userId, content: trimmed, parent_id: parentId })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * 删除评论（数据库中 ON DELETE CASCADE 会连带删掉它的回复）
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
