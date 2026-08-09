// src/services/contributors.js
// 关于页贡献者数据：按数据源优先级获取，失败自动降级，保证页面始终可用：
//   1. 静态 contributors.json（GitHub Pages CI 构建时生成，随站点部署）
//   2. Netlify Function（Netlify 部署时实时拉取 + Blobs 缓存）
//   3. 内置静态列表兜底

// 静态回退列表（与 scripts/fetch-contributors.mjs 及 Netlify 函数的 ROLES 对应）
const STATIC_CONTRIBUTORS = [
  { name: 'xiuerfanhhh-ship-it', github: 'xiuerfanhhh-ship-it', role: '项目管理 / 核心架构', contributions: 0 },
  { name: 'JosiahBristow', github: 'JosiahBristow', role: '网站功能开发', contributions: 0 },
  { name: 'BobHieuro', github: 'BobHieuro', role: '功能开发 / 数据库', contributions: 0 },
  { name: 'Raicco-Raydd', github: 'Raicco-Raydd', role: '前端 UI / 交互', contributions: 0 },
  { name: 'pengyudeng92-dev', github: 'pengyudeng92-dev', role: '功能开发', contributions: 0 },
  { name: '啊哈Bai', github: 'baiqingyuan', role: '测试与产品', contributions: 0 },
  { name: 'inni111', github: 'inni111', role: '贡献者', contributions: 0 },
  { name: 'WorkBuddy', github: 'WorkBuddy', role: '贡献者', contributions: 0 },
];

const toAvatar = (c) => ({
  ...c,
  name: c.name || c.github,
  avatar: c.avatar || (c.github ? `https://github.com/${c.github}.png?size=80` : null),
  html_url: c.html_url || (c.github ? `https://github.com/${c.github}` : null),
});

// GitHub Pages 部署在子路径（/yishen-navigation/）下，用 BASE_URL 拼绝对路径
const BASE = import.meta.env.BASE_URL || '/';

const parse = (data) => {
  if (!data?.contributors?.length) return null;
  return {
    contributors: data.contributors.map(toAvatar),
    fetchedAt: data.fetchedAt || null,
    cached: !!data.cached,
    stale: !!data.stale,
  };
};

/**
 * 获取贡献者列表（多数据源自动降级）
 * @returns {Promise<{ contributors: Array, fetchedAt: number|null, cached: boolean, stale: boolean }>}
 *  - contributors 按贡献数降序；fetchedAt 为数据来源时间（内置兜底时为 null）
 */
export const getContributors = async () => {
  const sources = [
    () => fetch(`${BASE}contributors.json`, { headers: { Accept: 'application/json' } }),
    () => fetch('/.netlify/functions/contributors', { headers: { Accept: 'application/json' } }),
  ];
  for (const source of sources) {
    try {
      const res = await source();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const parsed = parse(data);
      if (parsed) return parsed;
      throw new Error('接口返回为空');
    } catch (err) {
      console.warn('获取贡献者失败，尝试下一个数据源:', err.message);
    }
  }
  return { contributors: STATIC_CONTRIBUTORS.map(toAvatar), fetchedAt: null, cached: true, stale: true };
};
