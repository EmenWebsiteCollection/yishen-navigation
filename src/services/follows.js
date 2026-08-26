// src/services/follows.js
// Issue #39 P1：关注创作者
// Issue #161：粉丝列表 / 关注列表
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

const PUBLIC_PROFILE_COLS = [
  'id',
  'username',
  'avatar_url',
  'bio',
  'created_at',
].join(',');

/**
 * 获取粉丝列表（关注某用户的人）
 * @param {string} userId - 被关注者 ID
 * @param {object} opts - { page: 1, pageSize: 20, currentUserId?: string }
 * @returns {Promise<{users: Array, total: number}>}
 */
export const getFollowers = async (userId, { page = 1, pageSize = 20, currentUserId } = {}) => {
  if (!userId) return { users: [], total: 0 };
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // 先查总数
  const { count: total, error: countErr } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId);
  if (countErr) throw countErr;

  // 查关注关系 + 被关注者简档
  const { data: follows, error } = await supabase
    .from('follows')
    .select(`follower_id, created_at, follower:profiles!follower_id (${PUBLIC_PROFILE_COLS})`)
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;

  // 若提供了当前用户，批量查询「我是否已关注这些粉丝」
  let followingSet = new Set();
  if (currentUserId && follows?.length) {
    const followerIds = follows.map((f) => f.follower_id).filter(Boolean);
    if (followerIds.length) {
      const { data: myFollows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId)
        .in('following_id', followerIds);
      followingSet = new Set((myFollows || []).map((f) => f.following_id));
    }
  }

  const users = (follows || []).map((f) => ({
    ...f.follower,
    followed_at: f.created_at,
    isFollowing: followingSet.has(f.follower_id),
  }));

  return { users, total: total || 0 };
};

/**
 * 获取关注列表（某用户关注的人）
 * @param {string} userId - 关注者 ID
 * @param {object} opts - { page: 1, pageSize: 20, currentUserId?: string }
 * @returns {Promise<{users: Array, total: number}>}
 */
export const getFollowing = async (userId, { page = 1, pageSize = 20, currentUserId } = {}) => {
  if (!userId) return { users: [], total: 0 };
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { count: total, error: countErr } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId);
  if (countErr) throw countErr;

  const { data: follows, error } = await supabase
    .from('follows')
    .select(`following_id, created_at, following:profiles!following_id (${PUBLIC_PROFILE_COLS})`)
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;

  let followingSet = new Set();
  if (currentUserId && follows?.length) {
    const followingIds = follows.map((f) => f.following_id).filter(Boolean);
    if (followingIds.length) {
      const { data: myFollows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId)
        .in('following_id', followingIds);
      followingSet = new Set((myFollows || []).map((f) => f.following_id));
    }
  }

  const users = (follows || []).map((f) => ({
    ...f.following,
    followed_at: f.created_at,
    isFollowing: followingSet.has(f.following_id),
  }));

  return { users, total: total || 0 };
};
