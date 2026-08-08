// src/services/passwordReset.js
// 找回密码：调用 Supabase Edge Function（password-reset）
// 仅用匿名 key 即可调用，邮件/短信密钥都在服务端，不暴露给前端。
import { supabase } from './supabase.js';

/**
 * 请求发送验证码
 * @param {'email'|'phone'} contactType
 * @param {string} contact 邮箱或手机号
 */
export const requestResetCode = async (contactType, contact) => {
  const { data, error } = await supabase.functions.invoke('password-reset', {
    body: { action: 'request', contactType, contact },
  });
  if (error) throw error;
  return data;
};

/**
 * 校验验证码并重置密码
 * @param {'email'|'phone'} contactType
 * @param {string} contact
 * @param {string} code 6 位验证码
 * @param {string} newPassword 新密码（至少 6 位）
 */
export const verifyResetCode = async (contactType, contact, code, newPassword) => {
  const { data, error } = await supabase.functions.invoke('password-reset', {
    body: { action: 'verify', contactType, contact, code, newPassword },
  });
  if (error) throw error;
  return data;
};
