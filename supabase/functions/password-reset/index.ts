// supabase/functions/password-reset/index.ts
// 找回密码：发验证码（request） + 校验并改密（verify）
//
// 部署：
//   supabase functions deploy password-reset
//   supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
//   supabase secrets set EMAIL_PROVIDER=resend EMAIL_API_KEY=xxx EMAIL_FROM=xxx@xxx
//   # 短信（可选，未配置时 phone 找回会返回友好提示）
//   supabase secrets set SMS_PROVIDER=generic SMS_API_KEY=xxx SMS_API_URL=https://...
//
// 前端调用（匿名 key 即可，无需任何密钥）：
//   supabase.functions.invoke('password-reset', {
//     body: { action: 'request', contactType: 'email', contact: 'a@b.com' }
//   })
//   supabase.functions.invoke('password-reset', {
//     body: { action: 'verify', contactType: 'email', contact: 'a@b.com',
//             code: '123456', newPassword: 'newpass' }
//   })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CODE_TTL_MS = 10 * 60 * 1000; // 验证码有效期 10 分钟
const MAX_ATTEMPTS = 5; // 最多试错次数
const PASSWORD_MIN = 6;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function genCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, '0');
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------- 邮件发送适配器 ----------------------
async function sendEmail(to: string, code: string): Promise<void> {
  const provider = (Deno.env.get('EMAIL_PROVIDER') || '').toLowerCase();
  const apiKey = Deno.env.get('EMAIL_API_KEY') || '';
  const from = Deno.env.get('EMAIL_FROM') || 'noreply@nav.local';
  const subject = '【依神导航】您的密码重置验证码';
  const html = `<p>您正在申请重置密码，验证码为：</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
    <p>验证码 10 分钟内有效。若非本人操作请忽略。</p>`;
  const text = `您的密码重置验证码是 ${code}（10 分钟内有效）。`;

  if (!provider || !apiKey) {
    throw new Error('邮件服务未配置（EMAIL_PROVIDER / EMAIL_API_KEY）');
  }

  if (provider === 'resend') {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!r.ok) throw new Error(`邮件发送失败: ${await r.text()}`);
    return;
  }

  if (provider === 'sendgrid') {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    });
    if (!r.ok) throw new Error(`邮件发送失败: ${await r.text()}`);
    return;
  }

  if (provider === 'generic') {
    const url = Deno.env.get('EMAIL_API_URL') || '';
    if (!url) throw new Error('generic 邮件服务需配置 EMAIL_API_URL');
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, to, from, subject, html, text, code }),
    });
    if (!r.ok) throw new Error(`邮件发送失败: ${await r.text()}`);
    return;
  }

  throw new Error(`不支持的 EMAIL_PROVIDER: ${provider}`);
}

// ---------------------- 短信发送适配器 ----------------------
async function sendSms(to: string, code: string): Promise<void> {
  const provider = (Deno.env.get('SMS_PROVIDER') || '').toLowerCase();
  const apiKey = Deno.env.get('SMS_API_KEY') || '';
  const text = `【依神导航】您的密码重置验证码是 ${code}，10 分钟内有效。`;

  if (!provider || !apiKey) {
    throw new Error('短信服务未配置（SMS_PROVIDER / SMS_API_KEY）');
  }

  if (provider === 'generic') {
    const url = Deno.env.get('SMS_API_URL') || '';
    if (!url) throw new Error('generic 短信服务需配置 SMS_API_URL');
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, to, text, code }),
    });
    if (!r.ok) throw new Error(`短信发送失败: ${await r.text()}`);
    return;
  }

  // 阿里云/腾讯云等带签名鉴权的短信服务：在此补充对应分支，
  // 或把 SMS_PROVIDER 设为 generic 并指向你自己封装好的转发接口。
  throw new Error(`不支持的 SMS_PROVIDER: ${provider}`);
}

// ---------------------- 主逻辑 ----------------------
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !serviceKey) {
    return json({ error: '服务端未配置 SUPABASE 环境变量' }, 500);
  }
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: '请求体不是合法 JSON' }, 400);
  }

  const action = payload?.action;
  const contactType = payload?.contactType;
  const contact = (payload?.contact || '').trim();

  if (contactType !== 'email' && contactType !== 'phone') {
    return json({ error: 'contactType 必须是 email 或 phone' }, 400);
  }
  if (!contact) return json({ error: '联系方式不能为空' }, 400);

  // 统一对外返回，避免泄露账号是否存在
  const SENT_OK = {
    ok: true,
    message: '若该账号已绑定此联系方式，验证码已发送，请注意查收。',
  };

  // ---------- 1) 请求验证码 ----------
  if (action === 'request') {
    const column = contactType === 'email' ? 'email' : 'phone';
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq(column, contact)
      .maybeSingle();

    // 账号存在才真正发码（不存在也返回同样的成功提示）
    if (profile?.id) {
      const code = genCode();
      const codeHash = await sha256(code);
      const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

      // 失效该联系方式已有的验证码
      await supabase
        .from('password_reset_codes')
        .delete()
        .eq('contact_type', contactType)
        .eq('contact', contact);

      await supabase.from('password_reset_codes').insert({
        user_id: profile.id,
        contact_type: contactType,
        contact,
        code_hash: codeHash,
        expires_at: expiresAt,
      });

      try {
        if (contactType === 'email') await sendEmail(contact, code);
        else await sendSms(contact, code);
      } catch (e) {
        // 发送失败：仍返回成功提示，但不泄露细节；记录日志便于排查
        console.error('发送验证码失败:', (e as Error).message);
        return json(
          { error: '验证码发送失败，请稍后重试或联系管理员。' },
          502
        );
      }
    }
    return json(SENT_OK, 200);
  }

  // ---------- 2) 校验并改密 ----------
  if (action === 'verify') {
    const code = (payload?.code || '').trim();
    const newPassword = payload?.newPassword || '';
    if (!/^\d{6}$/.test(code)) return json({ error: '验证码为 6 位数字' }, 400);
    if (typeof newPassword !== 'string' || newPassword.length < PASSWORD_MIN) {
      return json({ error: `新密码至少 ${PASSWORD_MIN} 位` }, 400);
    }

    const column = contactType === 'email' ? 'email' : 'phone';
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq(column, contact)
      .maybeSingle();
    if (!profile?.id) return json({ error: '验证码错误或已过期' }, 400);

    const { data: rows } = await supabase
      .from('password_reset_codes')
      .select('*')
      .eq('contact_type', contactType)
      .eq('contact', contact)
      .eq('user_id', profile.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    const row = rows?.[0];
    if (!row) return json({ error: '验证码不存在或已过期' }, 400);

    if (row.attempts >= MAX_ATTEMPTS) {
      await supabase.from('password_reset_codes').delete().eq('id', row.id);
      return json({ error: '尝试次数过多，请重新获取验证码' }, 429);
    }

    const ok = (await sha256(code)) === row.code_hash;
    if (!ok) {
      await supabase
        .from('password_reset_codes')
        .update({ attempts: row.attempts + 1 })
        .eq('id', row.id);
      return json({ error: '验证码错误' }, 400);
    }

    // 校验通过：用管理员权限改密（用户此时未登录）
    const { error: updErr } = await supabase.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    );
    if (updErr) {
      console.error('改密失败:', updErr.message);
      return json({ error: '重置密码失败，请稍后重试' }, 500);
    }

    // 删除已使用的验证码
    await supabase.from('password_reset_codes').delete().eq('id', row.id);

    return json({ ok: true, message: '密码已重置，请用新密码登录。' }, 200);
  }

  return json({ error: "action 必须是 'request' 或 'verify'" }, 400);
});
