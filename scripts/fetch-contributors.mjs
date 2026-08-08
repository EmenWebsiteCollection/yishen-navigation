// scripts/fetch-contributors.mjs
// GitHub Pages 下的贡献者同步：在 CI 构建阶段用 GITHUB_TOKEN 拉取仓库贡献者，
// 生成 public/contributors.json（Vite 会随构建拷入 dist/），前端读取该静态 JSON。
// 用法：node scripts/fetch-contributors.mjs [输出路径]
// 环境变量：REPO_OWNER / REPO_NAME / GITHUB_TOKEN
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const REPO_OWNER = process.env.REPO_OWNER || 'EmenWebsiteCollection';
const REPO_NAME = process.env.REPO_NAME || 'yishen-navigation';
const OUT = process.argv[2] || 'public/contributors.json';
const TOKEN = process.env.GITHUB_TOKEN || '';

// 各贡献者的职责说明（按 GitHub 用户名匹配，仅用于展示；与 Netlify 函数里的 ROLES 保持一致）
const ROLES = {
  'JosiahBristow': '项目管理 / 核心架构',
  'BobHieuro': '功能开发 / 数据库',
  'Raicco-Raydd': '前端 UI / 交互',
  'pengyudeng92-dev': '功能开发',
  'baiqingyuan': '测试与产品',
  'inni111': '贡献者',
  'WorkBuddy': '贡献者',
};

const res = await fetch(
  `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contributors?per_page=100`,
  {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'yishen-navigation-build',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  }
);

if (!res.ok) {
  // 尽力而为：GitHub 偶发失败（限流/网络）不应阻断站点部署，前端会降级到内置列表
  console.warn(`GitHub API 请求失败: HTTP ${res.status}，跳过贡献者文件生成（前端将用内置列表兜底）`);
  process.exit(0);
}

const users = await res.json();
const contributors = users.map((u) => ({
  name: u.login,
  github: u.login,
  avatar: u.avatar_url,
  role: ROLES[u.login] || '贡献者',
  contributions: u.contributions || 0,
  html_url: u.html_url,
}));

const payload = { fetchedAt: Date.now(), contributors };
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(payload, null, 2));
console.log(`已生成 ${OUT}（${contributors.length} 位贡献者）`);
