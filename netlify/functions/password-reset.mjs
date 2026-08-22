// netlify/functions/password-reset.mjs
// 找回密码（邮箱/手机验证码）服务端。
// 与 contributors.mjs 同风格：Node + export default，密钥全部走 Netlify 环境变量，前端不持有。
// 部署：随站点自动部署，无需 Supabase CLI / supabase functions deploy。
//
// 需配置的环境变量（Netlify 后台 Site settings → Environment variables）：
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   EMAIL_PROVIDER：resend | sendgrid | aliyun | generic
//   resend/sendgrid/generic 用：EMAIL_API_KEY, EMAIL_FROM
//     （generic 另需 EMAIL_API_URL 指向你的转发接口）
//   aliyun 用：ALIYUN_ACCESS_KEY_ID, ALIYUN_ACCESS_KEY_SECRET, EMAIL_FROM(发信地址)
//     （可选）ALIYUN_REGION_ID，默认 cn-hangzhou
//   （可选）EMAIL_FROM_NAME：发件人显示名，默认「依神网站汇总」
//
// 发信信誉要求：EMAIL_FROM 必须是发信服务已验证的地址，发信域名需完成 SPF/DKIM/DMARC
// 校验；不要用免费邮箱或转发地址发送验证码，否则容易被 Outlook 等邮箱判为垃圾邮件。
import { createClient } from '@supabase/supabase-js';
import { createHash, createHmac, randomInt, randomUUID } from 'node:crypto';

// ── 环境变量启动自检 ──
function checkEnv() {
  const missing = [];
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  const provider = (process.env.EMAIL_PROVIDER || 'generic').toLowerCase();
  if (provider === 'aliyun') {
    if (!process.env.ALIYUN_ACCESS_KEY_ID) missing.push('ALIYUN_ACCESS_KEY_ID');
    if (!process.env.ALIYUN_ACCESS_KEY_SECRET) missing.push('ALIYUN_ACCESS_KEY_SECRET');
    if (!process.env.EMAIL_FROM) missing.push('EMAIL_FROM（阿里云发信地址）');
  } else {
    if (!process.env.EMAIL_API_KEY) missing.push('EMAIL_API_KEY');
    if (!process.env.EMAIL_FROM) missing.push('EMAIL_FROM');
    if (provider === 'generic' && !process.env.EMAIL_API_URL) missing.push('EMAIL_API_URL');
  }
  return missing;
}

// 延迟创建：确保环境变量检查在客户端创建之前，避免空值导致静默 502
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(`缺少 Supabase 环境变量：${!url ? 'SUPABASE_URL' : ''}${!url && !key ? '、' : ''}${!key ? 'SUPABASE_SERVICE_ROLE_KEY' : ''}`);
  }
  return createClient(url, key);
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });

// ── 防用户枚举时延垫片（#139）────────────────────────────────
// request 分支各出口的耗时差异会泄露注册状态：已注册走查库+发信约 4-5s，
// 未注册/限频若秒回，攻击者可用响应时长判断邮箱是否存在。
// 统一把出口垫到同一随机时间窗（3-5s，与真实发信耗时重叠）；
// 真实路径耗时超过窗口上限时不额外等待，直接返回。
const ENUM_PAD_MIN_MS = 3000;
const ENUM_PAD_MAX_MS = 5000;

function paddedJson(startedAt) {
  const target = ENUM_PAD_MIN_MS + Math.random() * (ENUM_PAD_MAX_MS - ENUM_PAD_MIN_MS);
  return async (obj, status = 200) => {
    const wait = target - (Date.now() - startedAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    return json(obj, status);
  };
}

const CODE_TTL_MS = 10 * 60 * 1000; // 验证码有效期 10 分钟
const MAX_ATTEMPTS = 5; // 单个验证码最多校验 5 次
const RESEND_INTERVAL_MS = 60 * 1000; // 同一联系方式最短重发间隔 60 秒

// 统一的“已发送”文案：无论账号是否存在都返回它，避免用户枚举；
// 配合上方 paddedJson，request 分支各出口的响应时长也一并统一（#139）。
const GENERIC_SENT_MSG = '若该联系方式已绑定账号，验证码已发送，请注意查收（含垃圾邮件箱）。';

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

// 阿里云 RPC 签名专用编码（RFC3986 + 阿里云特殊处理）
function aliyunEncode(str) {
  return encodeURIComponent(str)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

// 密码学安全随机数：crypto.randomInt 不可预测（Math.random 可被预测，见 #115）
function genCode() {
  return String(randomInt(100000, 1000000));
}

function isEmailAddr(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// 发送验证码邮件（密钥只在服务端）
async function sendCodeEmail(email, code) {
  const provider = (process.env.EMAIL_PROVIDER || 'generic').toLowerCase();
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || '依神网站汇总';
  const subject = '依神网站汇总 - 找回密码验证码';
  // 邮件内容刻意保持最小化：无外链、图片、附件与跟踪像素，避免触发垃圾邮件规则。
  const text = `您好，您的验证码是：${code}\n\n该验证码 10 分钟内有效，请勿泄露给他人。`;
  const html = `<p>您好，您的验证码是：<b style="font-size:18px">${code}</b></p><p>该验证码 10 分钟内有效，请勿泄露给他人。</p>`;

  // 注意：aliyun 走 ALIYUN_ACCESS_KEY_ID/SECRET，不使用 EMAIL_API_KEY，
  // 所以这里不能对所有 provider 统一强校验 apiKey（否则阿里云会被误拦）。
  if (provider !== 'aliyun' && !apiKey) {
    throw new Error('服务器未配置邮件发送密钥（EMAIL_API_KEY）');
  }
  if (!from) throw new Error('服务器未配置发信地址（EMAIL_FROM）');

  if (provider === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${fromName} <${from}>`, to: email, subject, text, html }),
    });
    if (!res.ok) throw new Error(`邮件发送失败: ${res.status} ${await res.text()}`);
  } else if (provider === 'sendgrid') {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: from, name: fromName },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    });
    if (!res.ok) throw new Error(`邮件发送失败: ${res.status} ${await res.text()}`);
  } else if (provider === 'aliyun') {
    const akId = process.env.ALIYUN_ACCESS_KEY_ID;
    const akSecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
    const accountName = from; // 发信地址（DirectMail 控制台验证过的地址）
    if (!akId || !akSecret || !accountName) {
      throw new Error('阿里云邮件未配置（ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET / EMAIL_FROM）');
    }
    const region = process.env.ALIYUN_REGION_ID || 'cn-hangzhou';
    const params = {
      Action: 'SingleSendMail',
      Version: '2015-11-23',
      AccessKeyId: akId,
      RegionId: region,
      Format: 'JSON',
      SignatureMethod: 'HMAC-SHA1',
      SignatureVersion: '1.0',
      SignatureNonce: randomUUID(),
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      AccountName: accountName,
      ToAddress: email,
      Subject: subject,
      TextBody: text,
      HtmlBody: html,
      AddressType: '1',
      ReplyToAddress: 'false',
      FromAlias: fromName,
    };
    // 用 POST + form-urlencoded：避免 AccessKeyId/Signature 出现在 URL 与访问日志中
    const sortedKeys = Object.keys(params).sort();
    const canonical = sortedKeys
      .map((k) => `${aliyunEncode(k)}=${aliyunEncode(params[k])}`)
      .join('&');
    const stringToSign = `POST&${aliyunEncode('/')}&${aliyunEncode(canonical)}`;
    const signature = createHmac('sha1', akSecret + '&')
      .update(stringToSign, 'utf8')
      .digest('base64');
    const body = `${canonical}&Signature=${aliyunEncode(signature)}`;

    // cn-hangzhou 用公共域名，其他地域用 dm.{region}.aliyuncs.com
    const endpoint =
      region === 'cn-hangzhou'
        ? 'https://dm.aliyuncs.com/'
        : `https://dm.${region}.aliyuncs.com/`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      /* 非 JSON 响应时保留原文用于报错 */
    }
    if (!res.ok || data.Code) {
      // 阿里云错误码直出便于排查：InvalidAccountName / InvalidSendingDomain 等
      throw new Error(
        `阿里云邮件发送失败: ${data.Code || res.status} ${data.Message || text.slice(0, 200)}`
      );
    }
  } else {
    // generic：POST 到自己的转发接口（body: { to, subject, text, html, fromName }）
    // 安全：不传 apiKey（#116）——转发接口应自己管理密钥，绝不让第三方拿原始 EMAIL_API_KEY。
    const url = process.env.EMAIL_API_URL;
    if (!url) throw new Error('EMAIL_PROVIDER=generic 时需要配置 EMAIL_API_URL');
    // 强制 HTTPS（本地开发可用 http://localhost 豁免）
    let urlOk = false;
    try {
      const u = new URL(url);
      urlOk = u.protocol === 'https:' || /^https?:$/.test(u.protocol) && ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
    } catch { /* 下方统一报错 */ }
    if (!urlOk) throw new Error('EMAIL_API_URL 必须为 https 地址');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: email, subject, text, html, fromName }),
    });
    if (!res.ok) throw new Error(`邮件发送失败: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}

async function handleRequest({ contactType, contact }) {
  // #139：除「手机未接入 503」「缺参数 400」外，本函数所有出口统一
  // 响应文案 + 状态码 + 耗时，无法据此判断联系方式是否已注册。
  const startedAt = Date.now();
  const reply = paddedJson(startedAt);

  if (!contact) return json({ error: '请输入邮箱或手机号' }, 400);
  const email = contactType === 'email' || isEmailAddr(contact);
  const col = email ? 'email' : 'phone';

  // 手机短信尚未接入：先于查库返回，避免无意义的数据库开销
  if (!email) {
    return json({ error: '手机验证码功能正在部署中，请使用邮箱找回密码' }, 503);
  }

  const sb = getSupabase();
  const { data: profile, error } = await sb
    .from('profiles')
    .select('id, username')
    .eq(col, contact)
    .maybeSingle();
  if (error) {
    console.error('查询账号失败:', error.message);
    return reply({ error: '查询账号失败，请稍后重试' }, 500);
  }

  // 防用户枚举：账号不存在时也返回与成功一致的响应，并垫到与真实发信
  // 相同的耗时窗口——状态码、文案、时长三处都不泄露注册状态（#139）。
  if (!profile) return reply({ ok: true, channel: 'email', message: GENERIC_SENT_MSG });

  // 发送限频：同一联系方式 60 秒内只允许发一次，防邮件轰炸与发信额度被刷。
  const { data: last } = await sb
    .from('password_reset_codes')
    .select('created_at')
    .eq('contact', contact)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.created_at) {
    const elapsed = Date.now() - new Date(last.created_at).getTime();
    if (elapsed < RESEND_INTERVAL_MS) {
      // #139：429 + 专属提示语只有已注册邮箱能触发，等于泄露注册状态；
      // 改为与成功一致的统一响应（不重发、不暴露剩余等待秒数）。
      return reply({ ok: true, channel: 'email', message: GENERIC_SENT_MSG });
    }
  }

  const code = genCode();
  const codeHash = sha256(code + profile.id); // salt 用 user_id，与校验一致
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  // 清理该用户旧码，写入新码
  await sb.from('password_reset_codes').delete().eq('user_id', profile.id);
  const { error: insErr } = await sb
    .from('password_reset_codes')
    .insert({
      user_id: profile.id,
      contact_type: 'email',
      contact,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
    });
  if (insErr) {
    console.error('生成验证码失败:', insErr.message);
    return reply({ error: '生成验证码失败，请稍后重试' }, 500);
  }

  try {
    await sendCodeEmail(contact, code);
  } catch (e) {
    // 发送失败要清掉刚写入的码，否则会占用 60 秒限频窗口导致用户无法重试。
    // 对外仍返回统一成功响应（#139）：502 只有已注册邮箱能触发，会泄露注册状态。
    console.error('邮件发送失败:', e.message);
    await sb.from('password_reset_codes').delete().eq('user_id', profile.id);
    return reply({ ok: true, channel: 'email', message: GENERIC_SENT_MSG });
  }
  return reply({ ok: true, channel: 'email', message: GENERIC_SENT_MSG });
}

async function handleVerify({ contactType, contact, code, newPassword }) {
  if (!contact || !code || !newPassword) return json({ error: '参数不完整' }, 400);
  if (String(newPassword).length < 6) return json({ error: '新密码至少 6 位' }, 400);

  const email = contactType === 'email' || isEmailAddr(contact);
  const sb = getSupabase();
  // 取最新一条：历史残留多行时 maybeSingle 会直接抛错，这里用 limit(1) 兜住
  const { data: rows, error } = await sb
    .from('password_reset_codes')
    .select('*')
    .eq('contact_type', email ? 'email' : 'phone')
    .eq('contact', contact)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.error('查询验证码失败:', error.message);
    return json({ error: '查询验证码失败，请稍后重试' }, 500);
  }
  const row = rows?.[0];
  if (!row) return json({ error: '验证码不存在或已使用' }, 404);
  if (new Date(row.expires_at) < new Date()) return json({ error: '验证码已过期，请重新获取' }, 410);
  if (row.attempts >= MAX_ATTEMPTS) return json({ error: '尝试次数过多，请重新获取' }, 429);

  const codeHash = sha256(code + row.user_id);
  if (codeHash !== row.code_hash) {
    await sb
      .from('password_reset_codes')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id);
    const left = MAX_ATTEMPTS - (row.attempts + 1);
    return json(
      { error: left > 0 ? `验证码错误，还可尝试 ${left} 次` : '尝试次数过多，请重新获取验证码' },
      400
    );
  }

  const { error: updErr } = await sb.auth.admin.updateUserById(row.user_id, {
    password: newPassword,
  });
  if (updErr) {
    console.error('修改密码失败:', updErr.message);
    return json({ error: '修改密码失败，请稍后重试' }, 500);
  }

  await sb.from('password_reset_codes').delete().eq('user_id', row.user_id);
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

  // ── 启动自检：环境变量缺失时立即返回明确错误，不再静默 502 ──
  const missing = checkEnv();
  if (missing.length > 0) {
    return json({ error: `服务器配置缺失：${missing.join('、')}。请在 Netlify 环境变量中配置后重新部署。` }, 500);
  }

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
