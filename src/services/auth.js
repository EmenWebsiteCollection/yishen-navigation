// src/services/auth.js
import { supabase } from './supabase.js';

// 判断用户输入的标识符类型：邮箱 / 手机号 / 普通用户名
// - 含 @ 视为邮箱
// - 纯数字或以 + 开头的号码视为手机号（去掉空格与短横线后 7~15 位）
// - 其余视为普通用户名，自动补全为 username@nav.local（兼容旧账号）
export const resolveIdentifier = (raw) => {
  const v = (raw || '').trim();
  if (!v) return { type: 'username', value: '' };
  if (v.includes('@')) return { type: 'email', value: v };
  if (/^\+?[1-9]\d{6,14}$/.test(v.replace(/[\s-]/g, ''))) {
    return { type: 'phone', value: v.replace(/[\s-]/g, '') };
  }
  return { type: 'username', value: `${v}@nav.local` };
};

const toCredentials = (raw, password) => {
  const id = resolveIdentifier(raw);
  return id.type === 'phone'
    ? { phone: id.value, password }
    : { email: id.value, password };
};

export const register = async (raw, password) => {
  const credentials = toCredentials(raw, password);
  const { data, error } = await supabase.auth.signUp(credentials);
  if (error) throw error;
  return data;
};

export const login = async (raw, password) => {
  const credentials = toCredentials(raw, password);
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
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
