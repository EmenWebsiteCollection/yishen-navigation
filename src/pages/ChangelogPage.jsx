// src/pages/ChangelogPage.jsx
import React from 'react';
import { PageHero } from '../components/PageHero.jsx';
import '../styles/global.css';

const LABEL_EMOJI = { '新增': '✨', '优化': '💎', '修复': '🔧' };

const ChangeGroup = ({ label, items }) => (
  <div style={{ marginBottom: '14px' }}>
    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ym-accent)', marginBottom: '6px' }}>
      {LABEL_EMOJI[label] || '•'} {label}
    </div>
    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', lineHeight: 1.9, color: 'var(--ym-text-secondary)' }}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  </div>
);

const Version = ({ version, date, changes, latest }) => (
  <div style={{
    padding: '22px 26px',
    backgroundColor: 'var(--ym-bg-card)',
    borderRadius: 'var(--ym-radius-lg)',
    border: '1px solid var(--ym-border)',
    marginBottom: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
  }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'var(--ym-font-display)', fontSize: '18px', fontWeight: '500', color: 'var(--ym-text-primary)' }}>
        🗓️ {version}
      </span>
      <span style={{ fontSize: '13px', color: 'var(--ym-text-muted)' }}>{date}</span>
      <span style={{
        marginLeft: 'auto',
        fontSize: '12px',
        padding: '3px 10px',
        borderRadius: '20px',
        backgroundColor: 'var(--ym-success-bg)',
        color: 'var(--ym-success)',
        fontWeight: '500',
      }}>
        {latest ? '最新' : ''}
      </span>
    </div>
    {Object.entries(changes).map(([label, items]) => (
      <ChangeGroup key={label} label={label} items={items} />
    ))}
  </div>
);

const CHANGELOG = [
  {
    version: 'v1.5.0',
    date: '2026-08-08',
    latest: true,
    changes: {
      '新增': [
        'B站风格全站UI大改版：新视觉、头像功能、高分轮播、首页分区',
        '看板郎「依力」：轻量吉祥物展示，导航栏 Logo 与网站图标同步更新',
        '移动端顶栏导航改为下拉式 + 全面尺寸适配',
        'TechLoader 加载动画',
        '作品成长档案（版本快照）：编辑后自动生成修改历史',
        '首页卡片直接展示浏览数与点赞交互',
      ],
      '优化': [
        'Catppuccin 主题改为暗色 Mocha 风格',
        '我的主页布局优化',
        '详情页修复浏览量统计显示',
        '导航栏 Logo 统一使用 yili.jpg',
        '分区配置 SQL 补全（bind_contact updated_at、work_media 存储桶）',
      ],
      '修复': [
        '安全审计修复（Issue #31）',
        '手机端 responsive.css 恢复加载（Issue #9 遗留）',
        '/ideas、/discover 等页面双顶栏问题（Issue #45）',
        '多处 UI 细节修复（Issue #46）',
      ],
    },
  },
  {
    version: 'v1.4.0',
    date: '2026-08-08',
    latest: false,
    changes: {
      '新增': [
        '关于页面：项目简介、初衷、愿景与开发团队展示',
        '版本更新记录页面',
        '联系我们页面：GitHub Issues、反馈邮箱、社区交流群',
        '贡献者实时同步：通过 Netlify Function 调用 GitHub API（带缓存），自动更新头像与提交数',
        '全站统一导航栏，顶部内嵌搜索框',
      ],
      '优化': [
        '关于 / 更新记录 / 联系我们页面加入 emoji、图片与返回主页按钮',
        '贡献者卡片展示真实 GitHub 头像，可跳转主页',
        '首页导航栏链接布局调整',
      ],
    },
  },
  {
    version: 'v1.3.0',
    date: '2026-08-08',
    latest: false,
    changes: {
      '新增': [
        '自定义主题与背景图功能',
        '一键回到顶部按钮',
        '导航栏固定置顶并内嵌搜索框',
        '登录后导航栏显示用户头像',
        '关于页面、版本更新记录与联系我们页面',
      ],
      '优化': [
        '主题切换面板交互体验',
      ],
    },
  },
  {
    version: 'v1.2.0',
    date: '2026-08-07',
    latest: false,
    changes: {
      '新增': [
        '网站标签分类功能',
        '网站筛选功能',
      ],
      '优化': [
        '首页加载速度',
        '网站展示布局',
      ],
      '修复': [
        '部分网站无法正常访问的问题',
      ],
    },
  },
  {
    version: 'v1.1.0',
    date: '2026-08-06',
    latest: false,
    changes: {
      '新增': [
        '创作者主页与个人中心',
        '作品收藏与分组',
        '网站搜索功能',
      ],
      '优化': [
        '手机端 UI 适配',
        '路由切换自动回顶',
      ],
    },
  },
  {
    version: 'v1.0.0',
    date: '2026-08-05',
    latest: false,
    changes: {
      '新增': [
        '网站发布、编辑与删除',
        '点赞与评论（含回复）',
        '网站首页大图与自动截图',
        '多主题切换',
      ],
    },
  },
];

export function ChangelogPage() {
  return (
    <div className="ym-main-narrow" style={{ margin: '0 auto' }}>
        <PageHero
          emoji="📝"
          title="版本更新记录"
          subtitle="每一次迭代，都让这个项目变得更好"
        />

        {CHANGELOG.map((v) => (
          <Version key={v.version} version={v.version} date={v.date} changes={v.changes} latest={v.latest} />
        ))}
    </div>
  );
}
