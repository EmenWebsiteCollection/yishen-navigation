// netlify/functions/contributors.mjs
// 关于页贡献者接口：从 GitHub API 实时抓取仓库贡献者并缓存到 Netlify Blobs，
// 避免 GitHub 未鉴权限流（60 次/时/IP）与前端直连的跨域/缓存问题。
import { getStore } from '@netlify/blobs';

const REPO_OWNER = 'EmenWebsiteCollection';
const REPO_NAME = 'yishen-navigation';
const CACHE_KEY = 'contributors';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 小时

// 各贡献者的职责说明（按 GitHub 用户名匹配，仅用于展示）
const ROLES = {
  'JosiahBristow': '项目管理 / 核心架构',
  'BobHieuro': '功能开发 / 数据库',
  'Raicco-Raydd': '前端 UI / 交互',
  'pengyudeng92-dev': '功能开发',
  'baiqingyuan': '测试与产品',
  'inni111': '贡献者',
  'WorkBuddy': '贡献者',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GitHub 贡献者列表 → 前端展示结构
function mapContributors(users) {
  return (users || []).map((u) => ({
    name: u.login,
    github: u.login,
    avatar: u.avatar_url,
    role: ROLES[u.login] || '贡献者',
    contributions: u.contributions || 0,
    html_url: u.html_url,
  }));
}

// 读取缓存：Blobs 未启用/失败时返回 null，不影响实时抓取
async function readCache(store) {
  try {
    return await store.get(CACHE_KEY, { type: 'json' });
  } catch (e) {
    console.warn('读取贡献者缓存失败:', e.message);
    return null;
  }
}

// 写入缓存：失败只告警，不影响本次响应
async function writeCache(store, payload) {
  try {
    await store.set(CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('写入贡献者缓存失败:', e.message);
  }
}

export default async (req) => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });

  try {
    const store = getStore('contributors');
    const cached = await readCache(store);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return json({ cached: true, fetchedAt: cached.fetchedAt, contributors: cached.contributors });
    }

    // 拉取全部贡献者（仓库规模小，100 条足够；追加 headers 说明这是 Netlify 函数发起的请求）
    // 生产环境建议在 Netlify 后台配置 GITHUB_TOKEN（GitHub 个人令牌，只读 public_repo 即可），
    // 可把未鉴权限流从 60 次/时提高到 5000 次/时，避免限流导致回退缓存。
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contributors?per_page=100`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'yishen-navigation-netlify-function',
          ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
        },
      }
    );

    if (!res.ok) {
      // GitHub 失败：若已有缓存则回退缓存（标记 stale），否则返回错误
      if (cached) return json({ cached: true, stale: true, fetchedAt: cached.fetchedAt, contributors: cached.contributors });
      return json({ error: `GitHub API 请求失败: HTTP ${res.status}` }, 502);
    }

    const users = await res.json();
    const contributors = mapContributors(users);

    await writeCache(store, { fetchedAt: Date.now(), contributors });

    return json({ cached: false, fetchedAt: Date.now(), contributors });
  } catch (err) {
    return json({ error: `获取贡献者失败: ${err.message}` }, 500);
  }
};
