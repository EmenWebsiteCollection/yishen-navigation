// src/services/yiliMemory.js
// 依力 AI 3.0：个性化记忆读写（个人中心展示 / 清除）
// RLS 仅本人：当前登录用户只能读写自己的 user_memories。
import { supabase } from './supabase.js';

export async function getMyMemory(userId) {
  if (!userId) return { memory: null, error: null };
  const { data, error } = await supabase
    .from('user_memories')
    .select('memory_text, preferences, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { memory: null, error };
  return { memory: data || null, error: null };
}

export async function clearMyMemory(userId) {
  if (!userId) return { error: new Error('未登录') };
  const { error } = await supabase.from('user_memories').delete().eq('user_id', userId);
  return { error };
}
