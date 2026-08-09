// src/pages/AboutPage.jsx
import React, { useEffect, useState } from 'react';
import { PageHero } from '../components/PageHero.jsx';
import { getContributors } from '../services/contributors.js';
import '../styles/global.css';

const Section = ({ emoji, title, children, style, className }) => (
  <div className={className} style={{
    padding: '24px 28px',
    backgroundColor: 'var(--ym-bg-card)',
    borderRadius: 'var(--ym-radius-lg)',
    border: '1px solid var(--ym-border)',
    marginBottom: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
    ...style,
  }}>
    <h2 style={{
      fontFamily: 'var(--ym-font-display)',
      fontSize: '20px',
      fontWeight: '500',
      color: 'var(--ym-text-primary)',
      marginBottom: '12px',
      letterSpacing: '1px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}>
      <span style={{ fontSize: '22px', lineHeight: 1 }}>{emoji}</span>
      {title}
    </h2>
    <div style={{ fontSize: '15px', lineHeight: 1.9, color: 'var(--ym-text-secondary)' }}>
      {children}
    </div>
  </div>
);

const initialsOf = (name) => (name || '?').slice(0, 1).toUpperCase();

const TeamMember = ({ member }) => {
  const [imgError, setImgError] = React.useState(false);
  const showImg = member.avatar && !imgError;
  return (
    <div style={{ flex: '1 1 220px', padding: '16px 18px', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: 'var(--ym-radius-md)', border: '1px solid var(--ym-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        {showImg ? (
          <img
            src={member.avatar}
            alt={member.name}
            onError={() => setImgError(true)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        ) : (
          <span style={{
            display: 'inline-flex',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--ym-accent)',
            color: 'var(--ym-accent-text-on)',
            fontSize: '14px',
            fontWeight: '600',
            flexShrink: 0,
          }}>
            {initialsOf(member.name)}
          </span>
        )}
        <div>
          <div style={{ fontWeight: '600', color: 'var(--ym-text-primary)', fontSize: '15px' }}>{member.name}</div>
          <div style={{ fontSize: '13px', color: 'var(--ym-accent)', fontWeight: '500' }}>{member.role}</div>
        </div>
      </div>
      <div style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--ym-text-secondary)', wordBreak: 'break-all' }}>
        {member.html_url ? (
          <a
            href={member.html_url}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--ym-accent)', textDecoration: 'none' }}
          >
            @{member.github || member.name}
          </a>
        ) : (
          '贡献来自 git 历史'
        )}
        {member.contributions > 0 && (
          <span style={{ color: 'var(--ym-text-muted)' }}> · {member.contributions} 次提交</span>
        )}
      </div>
    </div>
  );
};

export function AboutPage() {
  const [contributors, setContributors] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getContributors()
      .then((data) => {
        if (!cancelled) {
          setContributors(data.contributors);
          setFetchedAt(data.fetchedAt);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const formatSyncedAt = (ts) => {
    if (!ts) return null;
    try {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return null;
    }
  };

  return (
    <div className="ym-main-narrow" style={{ margin: '0 auto' }}>
        <PageHero
          emoji="✨"
          title="关于依神网站汇总"
          subtitle="发现优质网站，共建网络资源库"
          className="ym-stagger-item"
          style={{ animationDelay: '0ms' }}
        />

        <Section emoji="📖" title="项目简介" className="ym-stagger-item" style={{ animationDelay: '60ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <img
              src="https://github.com/EmenWebsiteCollection.png?size=120"
              alt="依神网站汇总组织"
              style={{ width: '72px', height: '72px', borderRadius: '16px', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--ym-border)' }}
            />
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ fontWeight: '600', color: 'var(--ym-text-primary)', fontSize: '16px', marginBottom: '4px' }}>
                依神网站汇总 🌐
              </div>
              <div style={{ fontSize: '13px', color: 'var(--ym-text-muted)', lineHeight: 1.7 }}>
                EmenWebsiteCollection · 一个开放共建的网站导航社区
              </div>
            </div>
          </div>
          <p>
            依神网站汇总是一个用于发现优质网站的平台。我们希望通过社区共建的方式，帮助用户快速找到有价值的网站资源。
            无论是学习工具 🛠️、创意素材 🎨、实用服务 💡 还是趣味站点 🎮，你都能在这里找到，也可以分享你珍藏的网站给大家。
          </p>
        </Section>

        <Section emoji="💭" title="项目初衷" className="ym-stagger-item" style={{ animationDelay: '120ms' }}>
          <p>
            互联网上优秀的网站散落各处，很难被系统性地发现和沉淀 🌊。
            这个项目的初衷，就是把这些好网站汇集到一起，让每个人都能基于真实体验推荐、评分和评论，
            打破「好资源难找」的信息壁垒 🧱。
          </p>
        </Section>

        <Section emoji="🚀" title="项目愿景" className="ym-stagger-item" style={{ animationDelay: '180ms' }}>
          <p>
            我们希望依神网站汇总能够成长为一个活跃、可信、可持续的网站导航社区 🌱：
            内容由社区共建 ✍️、质量由社区把关 ⚖️，同时保持简洁、克制、注重体验的设计风格。
            让每一次访问都值得 🌟，让每一个推荐都被看见 👀。
          </p>
        </Section>

        <Section emoji="🤝" title="开发团队与贡献者" className="ym-stagger-item" style={{ animationDelay: '240ms' }}>
          {loading ? null : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {contributors.map((m) => (
                  <TeamMember key={m.github || m.name} member={m} />
                ))}
              </div>
              <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--ym-text-muted)' }}>
                {fetchedAt
                  ? <>🙏 贡献者数据来自 GitHub API 实时同步 · 最近同步：{formatSyncedAt(fetchedAt)}</>
                  : '🙏 当前展示为内置贡献者列表，部署后将自动从 GitHub 实时同步'}
                ，感谢每一位为这个项目贡献过代码、建议与反馈的伙伴。
              </p>
            </>
          )}
        </Section>
    </div>
  );
}
