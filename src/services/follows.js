// src/services/follows.js
// Issue #39 P1：关注创作者
import { supabase } from './supabase.js';

export const isFollowing = async (followerId, followingId) => {
  if (!followerId || !followingId) return false;
  const { data, error } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
};

export const toggleFollow = async (followerId, followingId) => {
  if (!followerId || !followingId) throw new Error('缺少关注双方');
  if (followerId === followingId) throw new Error('不能关注自己');
  const existing = await isFollowing(followerId, followingId);
  if (existing) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
    if (error) throw error;
    return { following: false };
  }
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) {
    if (error.code === '23505') return { following: true };
    throw error;
  }
  return { following: true };
};

// 我关注的人 id 列表
export const getFollowingIds = async (userId) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  if (error) throw error;
  return (data || []).map((f) => f.following_id);
};

// 关注我的人（粉丝）数量
export const getFollowerCount = async (userId) => {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId);
  if (error) return 0;
  return count || 0;
};

// 我关注的人数
export const getFollowingCount = async (userId) => {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId);
  if (error) return 0;
  return count || 0;
};
