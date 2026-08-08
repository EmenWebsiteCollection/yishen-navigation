// src/services/passwordReset.js
// 找回密码：调用 Netlify Function（/.netlify/functions/password-reset）
// 邮件/短信密钥都在服务端（Netlify 环境变量），不暴露给前端。
// 本地可用 import.meta.env.VITE_PASSWORD_RESET_URL 覆盖端点（如用 netlify dev 时的地址）。
const ENDPOINT =
  import.meta.env.VITE_PASSWORD_RESET_URL || '/.netlify/functions/password-reset';

async function post(body) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

/**
 * 请求发送验证码
 * @param {'email'|'phone'} contactType
 * @param {string} contact 邮箱或手机号
 */
export const requestResetCode = async (contactType, contact) => {
  return post({ action: 'request', contactType, contact });
};

/**
 * 校验验证码并重置密码
 * @param {'email'|'phone'} contactType
 * @param {string} contact
 * @param {string} code 6 位验证码
 * @param {string} newPassword 新密码（至少 6 位）
 */
export const verifyResetCode = async (contactType, contact, code, newPassword) => {
  return post({ action: 'verify', contactType, contact, code, newPassword });
};
