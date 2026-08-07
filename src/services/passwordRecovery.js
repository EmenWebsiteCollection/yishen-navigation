// src/services/passwordRecovery.js
import { supabase } from './supabase.js';

// 校验是否为合法邮箱
export const isValidEmail = (value) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
};

// 校验是否为合法手机号（支持 +86 / 11 位大陆号码，去除空格与短横线）
export const isValidPhone = (value) => {
  return /^\+?[1-9]\d{6,14}$/.test((value || '').trim().replace(/[\s-]/g, ''));
};

// 发送找回密码验证码（邮箱或手机号）
// channel: 'email' | 'phone'，value: 邮箱地址或手机号
// 使用 Supabase Auth OTP：shouldCreateUser:false 确保仅向已存在账号发送
export const sendResetCode = async ({ channel, value }) => {
  const clean = (value || '').trim();
  const base = channel === 'phone' ? { phone: clean } : { email: clean };
  const { error } = await supabase.auth.signInWithOtp({
    ...base,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
};

// 校验验证码并重置密码
// 流程：verifyOtp 拿到会话 → updateUser 设置新密码（账号不变，仅更新密码）
export const resetPasswordWithCode = async ({ channel, value, code, newPassword }) => {
  const clean = (value || '').trim();
  const verifyPayload =
    channel === 'phone'
      ? { phone: clean, token: (code || '').trim(), type: 'sms' }
      : { email: clean, token: (code || '').trim(), type: 'email' };

  const { error: verifyError } = await supabase.auth.verifyOtp(verifyPayload);
  if (verifyError) throw verifyError;

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) throw updateError;
};
