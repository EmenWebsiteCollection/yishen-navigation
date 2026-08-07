// netlify/functions/reset-password.mjs
// 找回密码：校验验证码并重置密码（使用 Supabase service_role 后台修改，无需用户会话）
import { createClient } from '@supabase/supabase-js';
import { getStore } from '@netlify/blobs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    return json({ error: `请求格式错误` }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const code = (body.code || '').trim();
  const newPassword = body.newPassword || '';

  if (!EMAIL_RE.test(email)) return json({ error: `邮箱格式不正确` }, 400);
  if (!/^\d{6}$/.test(code)) return json({ error: `验证码格式不正确` }, 400);
  if (newPassword.length < 6) return json({ error: `新密码至少 6 位` }, 400);

  const store = getStore('reset-codes');
  const raw = await store.get(email);
  if (!raw) return json({ error: `请先获取验证码` }, 400);

  let rec;
  try {
    rec = JSON.parse(raw);
  } catch {
    await store.delete(email);
    return json({ error: `验证码已失效，请重新获取` }, 400);
  }

  if (Date.now() > rec.expiresAt) {
    await store.delete(email);
    return json({ error: `验证码已过期，请重新获取` }, 400);
  }
  if (rec.code !== code) return json({ error: `验证码错误` }, 400);

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: userData } = await supabase.auth.admin.getUserByEmail(email);
  if (!userData || !userData.user) return json({ error: `未找到该邮箱对应的账号` }, 404);

  const { error: updErr } = await supabase.auth.admin.updateUserById(userData.user.id, {
    password: newPassword,
  });
  if (updErr) {
    console.error('updateUserById failed:', updErr);
    return json({ error: updErr.message || `重置失败，请稍后重试` }, 502);
  }

  await store.delete(email);
  return json({ ok: true });
};
