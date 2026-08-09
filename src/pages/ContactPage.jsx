// src/pages/ContactPage.jsx
import React from 'react';
import { PageHero } from '../components/PageHero.jsx';
import '../styles/global.css';

const ContactCard = ({ icon, title, content, href, cta }) => {
  const inner = (
    <>
      <div style={{ fontSize: '26px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--ym-text-primary)', marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--ym-text-secondary)', marginBottom: '12px', wordBreak: 'break-all' }}>
        {content}
      </div>
      {cta && (
        <span style={{
          fontSize: '13px',
          fontWeight: '500',
          color: 'var(--ym-accent-text-on)',
          backgroundColor: 'var(--ym-accent)',
          padding: '6px 16px',
          borderRadius: 'var(--ym-radius-sm)',
          display: 'inline-block',
        }}>
          {cta}
        </span>
      )}
    </>
  );

  return (
    <div style={{
      flex: '1 1 240px',
      padding: '22px 24px',
      backgroundColor: 'var(--ym-bg-card)',
      borderRadius: 'var(--ym-radius-lg)',
      border: '1px solid var(--ym-border)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
    }}>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
};

export function ContactPage() {
  return (
    <div className="ym-main-narrow" style={{ margin: '0 auto' }}>
        <PageHero
          emoji="💌"
          title="联系我们"
          subtitle="如果你发现问题或有功能建议，可以通过以下方式联系"
          className="ym-stagger-item"
          style={{ animationDelay: '0ms' }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div className="ym-stagger-item" style={{ flex: '1 1 240px', animationDelay: '55ms' }}>
            <ContactCard
              icon="🐛"
              title="GitHub Issues"
              content="发现 Bug 🕵️、提出功能建议 💡，或参与社区讨论 💬。欢迎在 GitHub 上创建 Issue，我们会尽快跟进处理。"
              href="https://github.com/EmenWebsiteCollection/yishen-navigation/issues"
              cta="前往 GitHub Issues →"
            />
          </div>
          <div className="ym-stagger-item" style={{ flex: '1 1 240px', animationDelay: '110ms' }}>
            <ContactCard
              icon="📮"
              title="反馈邮箱"
              content="项目反馈与建议请发送至邮箱 ✉️，我们会在 1-3 个工作日内回复 ⏳。"
              href="mailto:feedback@nav.local"
              cta="发送邮件 →"
            />
          </div>
          <div className="ym-stagger-item" style={{ flex: '1 1 240px', animationDelay: '165ms' }}>
            <ContactCard
              icon="💬"
              title="社区交流群"
              content="加入社区交流群 👥，和其他用户一起分享优质网站 🌐、交流使用心得 ☕。"
              cta="联系管理员获取群号"
            />
          </div>
        </div>

        <div className="ym-stagger-item" style={{
          padding: '18px 24px',
          backgroundColor: 'var(--ym-bg-subtle)',
          borderRadius: 'var(--ym-radius-md)',
          border: '1px dashed var(--ym-border)',
          fontSize: '13px',
          lineHeight: 1.8,
          color: 'var(--ym-text-secondary)',
          animationDelay: '220ms',
        }}>
          <div style={{ fontWeight: '600', color: 'var(--ym-text-primary)', marginBottom: '4px' }}>🧪 测试组反馈渠道</div>
          测试组联系方式：请通过 GitHub Issues 提交 🐛，或在项目仓库 README 中查找对应组长联系方式 📄（联系方式待补充）。
        </div>
    </div>
  );
}
