// src/services/passwordRecovery.js
// 找回密码改为调用 Netlify 函数（发信走 Resend，重置走 Supabase service_role），
// 不再依赖 Supabase 的邮件 / SMTP 渠道。
// 详见 netlify/functions/send-reset-code.mjs 与 reset-password.mjs。

const FUNC_BASE = '/.netlify/functions';

// 校验是否为合法邮箱
export const isValidEmail = (value) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
};

// 校验是否为合法手机号（支持 +86 / 11 位大陆号码，去除空格与短横线）
export const isValidPhone = (value) => {
  return /^\+?[1-9]\d{6,14}$/.test((value || '').trim().replace(/[\s-]/g, ''));
};

async function postJson(path, body) {
  const res = await fetch(`${FUNC_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    // 忽略非 JSON 响应
  }
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data;
}

// 发送找回密码验证码（邮箱或手机号）
// channel: 'email' | 'phone'，value: 邮箱地址或手机号
// 实际发信与验证码生成均在服务端 Netlify 函数完成。
export const sendResetCode = async ({ channel, value }) => {
  return postJson('send-reset-code', { email: (value || '').trim() });
};

// 校验验证码并重置密码
// 由服务端 Netlify 函数校验验证码，并用 service_role 后台更新密码。
export const resetPasswordWithCode = async ({ channel, value, code, newPassword }) => {
  return postJson('reset-password', {
    email: (value || '').trim(),
    code: (code || '').trim(),
    newPassword,
  });
};
