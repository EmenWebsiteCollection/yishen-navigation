// netlify/functions/password-reset.mjs
// 找回密码（邮箱/手机验证码）服务端。
// 与 contributors.mjs 同风格：Node + export default，密钥全部走 Netlify 环境变量，前端不持有。
// 部署：随站点自动部署，无需 Supabase CLI / supabase functions deploy。
//
// 需配置的环境变量（Netlify 后台 Site settings → Environment variables）：
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   EMAIL_PROVIDER(resend|sendgrid|generic), EMAIL_API_KEY, EMAIL_FROM
//   （可选）EMAIL_API_URL —— 当 EMAIL_PROVIDER=generic 时指向你的转发接口
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CODE_TTL_MS = 10 * 60 * 1000; // 10 分钟
const MAX_ATTEMPTS = 5;

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isEmailAddr(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// 发送验证码邮件（密钥只在服务端）
async function sendCodeEmail(email, code) {
  const provider = (process.env.EMAIL_PROVIDER || 'generic').toLowerCase();
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  const subject = '依神网站汇总 - 找回密码验证码';
  const html = `<p>您好，您的验证码是：<b style="font-size:18px">${code}</b></p><p>该验证码 10 分钟内有效，请勿泄露给他人。</p>`;

  if (!apiKey) throw new Error('服务器未配置邮件发送密钥（EMAIL_API_KEY）');

  if (provider === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: email, subject, html }),
    });
    if (!res.ok) throw new Error(`邮件发送失败: ${res.status} ${await res.text()}`);
  } else if (provider === 'sendgrid') {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: from },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });
    if (!res.ok) throw new Error(`邮件发送失败: ${res.status} ${await res.text()}`);
  } else {
    // generic：POST 到你自己的转发接口（body: { to, subject, html, apiKey }）
    const url = process.env.EMAIL_API_URL;
    if (!url) throw new Error('EMAIL_PROVIDER=generic 时需要配置 EMAIL_API_URL');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: email, subject, html, apiKey }),
    });
    if (!res.ok) throw new Error(`邮件发送失败: ${res.status} ${await res.text()}`);
  }
}

async function handleRequest({ contactType, contact }) {
  if (!contact) return json({ error: '请输入邮箱或手机号' }, 400);
  const email = contactType === 'email' || isEmailAddr(contact);
  const col = email ? 'email' : 'phone';

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username')
    .eq(col, contact)
    .maybeSingle();
  if (error) return json({ error: '查询账号失败' }, 500);
  if (!profile) return json({ error: '未找到绑定该联系方式的账号' }, 404);

  const code = genCode();
  const codeHash = sha256(code + profile.id); // salt 用 user_id，与校验一致
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  // 清理该用户旧码，写入新码
  await supabase.from('password_reset_codes').delete().eq('user_id', profile.id);
  const { error: insErr } = await supabase
    .from('password_reset_codes')
    .insert({
      user_id: profile.id,
      contact_type: email ? 'email' : 'phone',
      contact,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
    });
  if (insErr) return json({ error: '生成验证码失败' }, 500);

  if (email) {
    try {
      await sendCodeEmail(contact, code);
    } catch (e) {
      return json({ error: e.message }, 502);
    }
    return json({ ok: true, channel: 'email' });
  }

  // 手机短信尚未部署
  return json({ error: '手机验证码功能正在部署中，请使用邮箱找回密码' }, 503);
}

async function handleVerify({ contactType, contact, code, newPassword }) {
  if (!contact || !code || !newPassword) return json({ error: '参数不完整' }, 400);
  if (String(newPassword).length < 6) return json({ error: '新密码至少 6 位' }, 400);

  const email = contactType === 'email' || isEmailAddr(contact);
  const { data: row, error } = await supabase
    .from('password_reset_codes')
    .select('*')
    .eq('contact_type', email ? 'email' : 'phone')
    .eq('contact', contact)
    .maybeSingle();
  if (error) return json({ error: '查询验证码失败' }, 500);
  if (!row) return json({ error: '验证码不存在或已使用' }, 404);
  if (new Date(row.expires_at) < new Date()) return json({ error: '验证码已过期，请重新获取' }, 410);
  if (row.attempts >= MAX_ATTEMPTS) return json({ error: '尝试次数过多，请重新获取' }, 429);

  const codeHash = sha256(code + row.user_id);
  if (codeHash !== row.code_hash) {
    await supabase
      .from('password_reset_codes')
      .update({ attempts: row.attempts + 1 })
      .eq('contact_type', email ? 'email' : 'phone')
      .eq('contact', contact);
    return json({ error: '验证码错误' }, 400);
  }

  const { error: updErr } = await supabase.auth.admin.updateUserById(row.user_id, {
    password: newPassword,
  });
  if (updErr) return json({ error: '修改密码失败：' + updErr.message }, 500);

  await supabase.from('password_reset_codes').delete().eq('user_id', row.user_id);
  return json({ ok: true });
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: '请求体无效' }, 400);
  }

  const { action } = body;
  try {
    if (action === 'request') return await handleRequest(body);
    if (action === 'verify') return await handleVerify(body);
    return json({ error: '未知 action' }, 400);
  } catch (e) {
    return json({ error: e.message || '服务器错误' }, 500);
  }
};
