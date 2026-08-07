// netlify/functions/send-reset-code.mjs
// 找回密码：发送验证码邮件（经由 Resend，Key 仅存在于服务端环境变量）
// 验证码临时存入 Netlify Blob（10 分钟有效），重置时由 reset-password 校验。
import { createClient } from '@supabase/supabase-js';
import { getStore } from '@netlify/blobs';

const RESEND_API = 'https://api.resend.com/emails';
const CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: '请求格式错误' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: '邮箱格式不正确' }, 400);

  // 仅向已存在的账号发送（避免向任意邮箱滥发）
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data } = await supabase.auth.admin.getUserByEmail(email);
  if (!data?.user) {
    // 不泄露账号是否存在，统一返回成功
    return json({ ok: true });
  }

  const code = genCode();
  const store = getStore('reset-codes');
  await store.set(email, JSON.stringify({ code, expiresAt: Date.now() + CODE_TTL_MS }));

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'onboarding@resend.dev',
        to: email,
        subject: '依神导航 · 密码重置验证码',
        html: `
          <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:460px;margin:auto;padding:24px;color:#1f2329">
            <h2 style="margin:0 0 16px;font-size:18px">依神导航 · 密码重置</h2>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6">你正在申请重置密码，验证码如下（10 分钟内有效）：</p>
            <div style="font-size:28px;font-weight:700;letter-spacing:6px;background:#f3f4f6;border-radius:8px;padding:16px;text-align:center;margin:12px 0">${code}</div>
            <p style="margin:0;font-size:12px;color:#8a919f">若非本人操作，请忽略此邮件。</p>
          </div>`,
      }),
    });
    if (!res.ok) {
      console.error('Resend send failed:', await res.text());
      return json({ error: '邮件发送失败，请稍后重试' }, 502);
    }
  } catch (e) {
    console.error('Resend exception:', e);
    return json({ error: '邮件服务异常，请稍后重试' }, 502);
  }

  return json({ ok: true });
};
