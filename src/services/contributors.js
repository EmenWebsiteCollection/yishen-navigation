// src/services/contributors.js
// 关于页贡献者数据：固定展示团队成员名单，不再从 GitHub 同步，按项目表格维护。

const STATIC_CONTRIBUTORS = [
  { name: 'xiuerfanhhh-ship-it', github: 'xiuerfanhhh-ship-it', role: '负责人/项目管理 / 核心架构' },
  { name: 'Josiah Bristow', github: 'josiahbristow', role: '负责人/功能开发' },
  { name: 'Whal', github: 'chyWhal21', role: '测试与产品' },
  { name: 'tuozhekongqi', github: 'tuozhekongqi', role: '数据库与后端组' },
  { name: 'itator', github: 'inni111', role: '数据库与后端组' },
  { name: 'sjy08330 -sudo', github: 'sjy08330-sudo', role: 'UI/UX开发' },
  { name: '啊哈Bai', github: 'baiqingyuan', role: '测试与产品' },
  { name: '随枫', github: 'Kazuha233', role: '后端/数据库' },
  { name: '又阴月宇', github: 'pengyudeng92-dev', role: '功能设计' },
  { name: '小孩', github: '080117', role: 'UI' },
  { name: 'longximu', github: 'dragonximu', role: '测试' },
  { name: '老大', github: 'VioletYYD', role: '后端/UI' },
  { name: '轻歌', github: 'a3625813257-svg', role: '后端/测试' },
  { name: 'Raicco-Raydd', github: 'Raicco-Raydd', role: '前端UI/交互' },
  { name: 'Weald', github: 'Weald-chrona', role: 'UI/美术' },
  { name: '指纹', github: 'MosaicDaemon', role: '测试' },
  { name: '9', github: 'chashaopingguopai', role: '测试' },
  { name: 'frodm', github: 'neguihejjo-hash', role: '后端与数据库' },
  { name: '林宝琬', github: 'day7post', role: '测试与产品组' },
  { name: '征服200', github: 'Zhengfu200', role: '功能开发' },
];

const toAvatar = (c) => ({
  ...c,
  name: c.name || c.github,
  avatar: c.avatar || (c.github ? `https://github.com/${c.github}.png?size=80` : null),
  html_url: c.html_url || (c.github ? `https://github.com/${c.github}` : null),
});

/**
 * 获取贡献者列表（静态名单）
 * @returns {Promise<{ contributors: Array, fetchedAt: number|null, cached: boolean, stale: boolean }>}
 */
export const getContributors = async () => ({
  contributors: STATIC_CONTRIBUTORS.map(toAvatar),
  fetchedAt: null,
  cached: true,
  stale: false,
});
