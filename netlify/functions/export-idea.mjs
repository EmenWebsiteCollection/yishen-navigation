// netlify/functions/export-idea.mjs
// 想法集中营「一键导出 GitHub Issue」：管理员把想法导出到仓库 Issue 队列。
// 与 password-reset.mjs 同风格：Node + export default，密钥全部走 Netlify 环境变量，前端不持有。
//
// 需配置的环境变量（Netlify 后台 → Site settings → Environment variables）：
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   GITHUB_TOKEN（对目标仓库有 issues 写权限的 token，建议用组织级 fine-grained PAT）
//   GITHUB_REPO（可选，默认 EmenWebsiteCollection/yishen-navigation）
//
// 请求：POST，Header Authorization: Bearer <登录用户的 access_token>
//   body: { "ideaId": "<uuid>" }
// 返回：{ ok, issueNumber, issueUrl }
import { createClient } from '@supabase/supabase-js';

const GITHUB_REPO =
  process.env.GITHUB_REPO || 'EmenWebsiteCollection/yishen-navigation';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/issues`;
const SITE_ORIGIN =
  process.env.SITE_ORIGIN || 'https://zesty-sunflower-9ba9c1.netlify.app';

function checkEnv() {
  const missing = [];
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.GITHUB_TOKEN) missing.push('GITHUB_TOKEN');
  return missing;
}

// 延迟创建：确保环境变量检查在客户端创建之前，避免空值导致静默 502
function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type',
    },
  });

export default async (req) => {
  const missing = checkEnv();
  if (missing.length) {
    return json({ error: `服务器缺少环境变量：${missing.join(', ')}` }, 500);
  }

  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  // 1. 解析请求体
  let ideaId = null;
  try {
    const body = await req.json();
    ideaId = typeof body?.ideaId === 'string' ? body.ideaId.trim() : null;
  } catch (_) {
    return json({ error: '请求体不是合法 JSON' }, 400);
  }
  if (!ideaId) return json({ error: '缺少 ideaId 参数' }, 400);

  // 2. 校验登录身份（用户 JWT → uid）
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: '请先登录' }, 401);

  const sb = getSupabase();
  const { data: authData, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !authData?.user) {
    return json({ error: '登录已失效，请重新登录' }, 401);
  }
  const uid = authData.user.id;

  // 3. 管理员校验（服务端判定，不能信前端）
  const { data: profile, error: profErr } = await sb
    .from('profiles')
    .select('is_admin, username')
    .eq('id', uid)
    .maybeSingle();
  if (profErr) return json({ error: '读取用户资料失败' }, 500);
  if (!profile?.is_admin) {
    return json({ error: '仅管理员可导出 GitHub Issue' }, 403);
  }

  // 4. 查想法（service_role 直读，避开 RLS）
  const { data: idea, error: ideaErr } = await sb
    .from('ideas')
    .select('id, title, description, category, tags, status, github_issue_number, profiles(username)')
    .eq('id', ideaId)
    .maybeSingle();
  if (ideaErr) return json({ error: '查询想法失败' }, 500);
  if (!idea) return json({ error: '想法不存在' }, 404);
  if (idea.github_issue_number != null) {
    return json(
      { error: `该想法已导出为 Issue #${idea.github_issue_number}，请勿重复导出` },
      409
    );
  }

  // 5. 组装并创建 GitHub Issue
  const author = idea.profiles?.username || '匿名用户';
  const tagsLine = (Array.isArray(idea.tags) ? idea.tags : []).map((t) => `\`${t}\``).join(' ');
  const issueBody = [
    '## 想法来源',
    `来自「想法集中营」（分类：${idea.category}，提出人：${author}）`,
    `🔗 ${SITE_ORIGIN}/ideas/${idea.id}`,
    '',
    '## 想法描述',
    idea.description || '（无描述）',
    '',
    '## 标签',
    tagsLine || '（无标签）',
    '',
    '---',
    `> 由管理员 ${profile.username || '管理员'} 从想法集中营一键导出`,
  ].join('\n');

  let ghRes;
  try {
    ghRes = await fetch(GITHUB_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'yishen-navigation-export-idea',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title: idea.title, body: issueBody }),
    });
  } catch (err) {
    return json({ error: `连接 GitHub 失败：${err.message}` }, 502);
  }
  const ghJson = await ghRes.json().catch(() => ({}));
  if (!ghRes.ok) {
    return json(
      { error: `GitHub 创建 Issue 失败（HTTP ${ghRes.status}）：${ghJson.message || '未知错误'}` },
      502
    );
  }

  // 6. 回写想法记录（标记已导出，防重复）
  const { error: upErr } = await sb
    .from('ideas')
    .update({ github_issue_number: ghJson.number })
    .eq('id', idea.id);
  if (upErr) console.warn('回写 github_issue_number 失败:', upErr.message);

  return json({ ok: true, issueNumber: ghJson.number, issueUrl: ghJson.html_url });
};
