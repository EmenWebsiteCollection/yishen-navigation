// src/pages/AboutPage.jsx
// 关于页面：项目简介 / 初衷 / 愿景 / 开发团队 / 版本更新记录（Issue #5）
import React from 'react';
import { Link } from 'react-router-dom';

const sectionTitle = {
  fontSize: '20px',
  fontWeight: '600',
  color: 'var(--ym-text-primary)',
  marginBottom: '14px',
};

const card = {
  backgroundColor: 'var(--ym-bg-card)',
  border: '1px solid var(--ym-border)',
  borderRadius: 'var(--ym-radius-lg)',
  padding: '24px',
  marginBottom: '20px',
};

const bodyText = {
  fontSize: '14px',
  lineHeight: '1.9',
  color: 'var(--ym-text-secondary)',
  margin: 0,
};

const navLink = {
  color: 'var(--ym-accent)',
  textDecoration: 'none',
  fontWeight: '500',
};

const team = [
  { name: '橘生', role: '项目管理' },
  { name: 'Josiah Bristow', role: '开发' },
  { name: '轻歌', role: '开发' },
  { name: 'Raicco-Raydd', role: '社区贡献者' },
];

const changelog = [
  {
    version: 'v1.2.0',
    date: '2026-08-07',
    items: [
      { type: '新增', list: ['网站搜索功能', '手机端 UI 适配', '网站标签分类与筛选', '密码找回', '关于页与联系我们页面'] },
      { type: '修复', list: ['切换页面后停留在页面底端的问题', '部分移动端布局与适配问题'] },
    ],
  },
  {
    version: 'v1.1.0',
    date: '2026-07',
    items: [
      { type: '新增', list: ['主页大图展示', '创作者主页', '点赞与评论功能'] },
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-06',
    items: [
      { type: '新增', list: ['网站导航列表与详情页', '用户注册 / 登录', '提交网站'] },
    ],
  },
];

export function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--ym-bg-page)' }}>
      <nav style={{
        padding: '16px 24px',
        backgroundColor: 'var(--ym-bg-card)',
        borderBottom: '1px solid var(--ym-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'var(--ym-text-primary)', fontSize: '16px', fontWeight: '500' }}>
          ← 返回首页
        </Link>
      </nav>

      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px 60px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '600', color: 'var(--ym-text-primary)', margin: '0 0 8px' }}>
            关于依神网站汇总
          </h1>
          <p style={bodyText}>
            依神网站汇总是一个用于发现优质网站的平台。我们希望通过社区共建的方式，帮助用户快速找到有价值的网站资源。
          </p>
        </div>

        <div style={card}>
          <h2 style={sectionTitle}>项目初衷</h2>
          <p style={bodyText}>
            互联网上的优质网站散落各处，靠个人收藏容易遗漏、难以分享。我们希望通过一个开放的导航平台，把大家发现的好网站汇集起来，让每一次分享都能被更多人看见。
          </p>
        </div>

        <div style={card}>
          <h2 style={sectionTitle}>项目愿景</h2>
          <p style={bodyText}>
            成为社区共建的优质网站导航：任何人都可以提交网站、参与分类维护、通过点赞与评论帮助好内容浮现，让这个平台的价值由每一位使用者共同塑造。
          </p>
        </div>

        <div style={card}>
          <h2 style={sectionTitle}>开发团队与贡献者</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
            {team.map((m) => (
              <div key={m.name} style={{
                backgroundColor: 'var(--ym-bg-subtle)',
                borderRadius: 'var(--ym-radius-md)',
                padding: '14px 16px',
              }}>
                <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--ym-text-primary)' }}>{m.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--ym-text-secondary)', marginTop: '4px' }}>{m.role}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <h2 style={sectionTitle}>版本更新记录</h2>
          {changelog.map((v) => (
            <div key={v.version} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--ym-accent)' }}>{v.version}</span>
                <span style={{ fontSize: '13px', color: 'var(--ym-text-muted)' }}>{v.date}</span>
              </div>
              {v.items.map((it) => (
                <div key={it.type} style={{ marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ym-text-primary)', marginRight: '8px' }}>{it.type}：</span>
                  {it.list.join('、')}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
