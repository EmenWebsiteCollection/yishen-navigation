// src/services/auth.js
import { supabase } from './supabase.js';

// 辅助：将用户输入的用户名转换为合法邮箱
const normalizeEmail = (username) => {
  if (!username || username.trim() === '') return '';
  const trimmed = username.trim();
  // 如果已经包含 @，视为完整邮箱，直接返回
  if (trimmed.includes('@')) return trimmed;
  // 否则自动补全域名
  return `${trimmed}@nav.local`;
};

export const register = async (username, password) => {
  const email = normalizeEmail(username);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const login = async (username, password) => {
  const email = normalizeEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};