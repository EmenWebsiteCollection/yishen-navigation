// src/services/commentFeedback.js
// Issue #39 P3：评论质量评价（有帮助/有洞察/专业/表达友善）+ 评论者声誉
import { supabase } from './supabase.js';

export const COMMENT_FEEDBACK_TYPES = [
  { id: 'helpful', label: '有帮助' },
  { id: 'insightful', label: '有洞察' },
  { id: 'professional', label: '专业' },
  { id: 'friendly', label: '表达友善' },
];

export const getCommentFeedbackCounts = async (commentId) => {
  if (!commentId) return {};
  try {
    const { data, error } = await supabase
      .from('comment_feedback')
      .select('feedback_type')
      .eq('comment_id', commentId);
    if (error) throw error;
    const counts = {};
    (data || []).forEach((f) => {
      counts[f.feedback_type] = (counts[f.feedback_type] || 0) + 1;
    });
    return counts;
  } catch (e) {
    console.warn('获取评论质量评价失败:', e.message);
    return {};
  }
};

export const hasCommentFeedback = async (commentId, userId, type) => {
  if (!userId || !commentId) return false;
  try {
    const { data, error } = await supabase
      .from('comment_feedback')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .eq('feedback_type', type)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  } catch (e) {
    return false;
  }
};

// 一人一票一类型，可取消
export const toggleCommentFeedback = async (commentId, userId, type) => {
  if (!commentId || !userId) throw new Error('缺少参数');
  if (!COMMENT_FEEDBACK_TYPES.some((t) => t.id === type)) throw new Error('未知的评价类型');
  const existing = await hasCommentFeedback(commentId, userId, type);
  if (existing) {
    const { error } = await supabase
      .from('comment_feedback')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .eq('feedback_type', type);
    if (error) throw error;
    return { active: false };
  }
  const { error } = await supabase
    .from('comment_feedback')
    .insert({ comment_id: commentId, user_id: userId, feedback_type: type });
  if (error) {
    if (error.code === '23505') return { active: true };
    throw error;
  }
  return { active: true };
};

// 评论者声誉（SECURITY DEFINER RPC）
export const getCommenterReputation = async (userId) => {
  const fallback = { adopted_count: 0, helpful: 0, insightful: 0, professional: 0, friendly: 0 };
  if (!userId) return fallback;
  try {
    const { data, error } = await supabase.rpc('get_commenter_reputation', { p_user_id: userId });
    if (error) throw error;
    return { ...fallback, ...(data || {}) };
  } catch (e) {
    console.warn('获取评论者声誉失败:', e.message);
    return fallback;
  }
};

// 声誉分 + 徽章档位（不做公开排行榜）
export const reputationScore = (rep) => {
  const r = rep || {};
  return (
    (r.adopted_count || 0) * 3 +
    (r.helpful || 0) +
    (r.insightful || 0) +
    (r.professional || 0) +
    (r.friendly || 0) * 0.5
  );
};

export const reputationBadge = (rep) => {
  const score = reputationScore(rep);
  if (score >= 20) return { label: '评审者', emoji: '🏅' };
  if (score >= 8) return { label: '策展人', emoji: '🌟' };
  if (score >= 2) return { label: '热心评论者', emoji: '💬' };
  return { label: '新面孔', emoji: '🌱' };
};
