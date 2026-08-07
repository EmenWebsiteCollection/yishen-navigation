// src/services/contributors.js
// 关于页贡献者数据：优先通过 Netlify Function 实时获取（带缓存），
// 失败时回退到内置的静态列表，保证页面始终可用。

// 静态回退列表（与 netlify/functions/contributors.mjs 的 ROLES 对应）
const STATIC_CONTRIBUTORS = [
  { name: 'JosiahBristow', github: 'JosiahBristow', role: '项目管理 / 核心架构', contributions: 0 },
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

/**
 * 获取贡献者列表
 * @returns {Promise<Array>} 按贡献数降序的贡献者数组
 */
export const getContributors = async () => {
  try {
    const res = await fetch('/.netlify/functions/contributors', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.contributors?.length) return data.contributors.map(toAvatar);
    throw new Error('接口返回为空');
  } catch (err) {
    console.warn('获取贡献者失败，使用内置静态列表:', err.message);
    return STATIC_CONTRIBUTORS.map(toAvatar);
  }
};
