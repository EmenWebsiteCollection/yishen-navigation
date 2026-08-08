// src/services/comments.js
import { supabase } from './supabase.js';
import { validateCommentContent, validateFeedbackType, validateAnchor } from './comment-logic.js';

/**
 * 获取某个作品的所有评论（含回复，按时间升序，前端自行分组）
 * @param {string} workId - 作品 UUID
 * @returns {Promise<Array>} 评论数组，包含 id, content, created_at, user_id, parent_id, username, avatar_url
 */
export const getCommentsByWebsite = async (workId) => {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      id,
      content,
      feedback_type,
      anchor,
      adopted,
      created_at,
      user_id,
      parent_id,
      profiles ( username, avatar_url )
    `)
    .eq('website_id', workId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return data.map((comment) => ({
    id: comment.id,
    content: comment.content,
    feedback_type: comment.feedback_type || 'appreciate',
    anchor: comment.anchor || null,
    adopted: !!comment.adopted,
    created_at: comment.created_at,
    user_id: comment.user_id,
    parent_id: comment.parent_id,
    username: comment.profiles?.username || '用户',
    avatar_url: comment.profiles?.avatar_url || null,
  }));
};

/**
 * 发表新评论或回复
 * @param {string} workId - 作品 UUID
 * @param {string} userId - 当前用户 ID (profiles.id)
 * @param {string} content - 评论内容
 * @param {object} opts - { parentId, feedbackType, anchor }
 * @returns {Promise<object>} 新评论对象
 */
export const createComment = async (workId, userId, content, opts = {}) => {
  const { parentId = null, feedbackType = 'appreciate', anchor = null } = opts || {};
  const trimmed = validateCommentContent(content);
  const type = validateFeedbackType(feedbackType);
  const anchorValue = validateAnchor(anchor);
  const insertRow = {
    website_id: workId,
    user_id: userId,
    content: trimmed,
    parent_id: parentId,
    feedback_type: type,
  };
  if (anchorValue) insertRow.anchor = anchorValue;
  const { data, error } = await supabase
    .from('comments')
    .insert(insertRow)
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
  const { error } = await supabase.rpc('rpc_delete_comment', { comment_id: commentId });
  if (error) throw error;
};
