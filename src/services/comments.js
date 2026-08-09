// src/services/comments.js
import { supabase } from './supabase.js';
import { isAdmin } from './works.js';
import { validateCommentContent, validateFeedbackType, validateFeedbackStatus, validateAnchor } from './comment-logic.js';

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
      feedback_status,
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
    feedback_status: comment.feedback_status || 'open',
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


/**
 * Issue #11：作者标记反馈处理状态（待处理/处理中/已处理/已忽略）
 * 仅作品作者或管理员可操作
 * @param {string} commentId - 评论 UUID
 * @param {string} status - open/resolving/resolved/ignored
 * @param {string} workId - 作品 UUID
 * @param {string} userId - 当前用户 ID
 * @returns {Promise<{id: string, feedback_status: string}>}
 */
export const setFeedbackStatus = async (commentId, status, workId, userId) => {
  const s = validateFeedbackStatus(status);
  if (!commentId) throw new Error('缺少评论 ID');
  if (!workId) throw new Error('缺少作品 ID');
  if (!userId) throw new Error('未登录');

  // 权限：仅作品作者或管理员
  const { data: work, error: workError } = await supabase
    .from('works')
    .select('user_id')
    .eq('id', workId)
    .maybeSingle();
  if (workError) throw workError;
  if (!work) throw new Error('作品不存在');
  const admin = await isAdmin(userId).catch(() => false);
  if (work.user_id !== userId && !admin) throw new Error('只有作品作者可以处理反馈');

  // 评论必须属于该作品
  const { data: comment, error: cErr } = await supabase
    .from('comments')
    .select('id')
    .eq('id', commentId)
    .eq('website_id', workId)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!comment) throw new Error('评论不存在');

  const { error } = await supabase
    .from('comments')
    .update({ feedback_status: s })
    .eq('id', commentId);
  if (error) throw error;
  return { id: commentId, feedback_status: s };
};

