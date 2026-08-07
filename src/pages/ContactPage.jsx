// src/pages/ContactPage.jsx
// 联系我们页面：反馈渠道 / 邮箱 / 社区交流群 / GitHub Issues（Issue #5）
// TODO: 反馈邮箱与社区交流群为占位内容，待团队补充真实信息后替换。
import React from 'react';
import { Link } from 'react-router-dom';

const card = {
  backgroundColor: 'var(--ym-bg-card)',
  border: '1px solid var(--ym-border)',
  borderRadius: 'var(--ym-radius-lg)',
  padding: '24px',
  marginBottom: '16px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '16px',
};

const cardIcon = {
  width: '42px',
  height: '42px',
  borderRadius: 'var(--ym-radius-md)',
  backgroundColor: 'var(--ym-accent)',
  color: 'var(--ym-accent-text-on)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
  flexShrink: 0,
};

const cardTitle = {
  fontSize: '16px',
  fontWeight: '600',
  color: 'var(--ym-text-primary)',
  margin: '0 0 6px',
};

const cardText = {
  fontSize: '14px',
  lineHeight: '1.8',
  color: 'var(--ym-text-secondary)',
  margin: 0,
  wordBreak: 'break-all',
};

const placeholder = {
  color: 'var(--ym-text-muted)',
  fontStyle: 'italic',
};

export function ContactPage() {
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
            联系我们
          </h1>
          <p style={cardText}>
            如果你发现问题或有功能建议，可以通过以下方式联系我们。
          </p>
        </div>

        <div style={card}>
          <div style={cardIcon}>🐛</div>
          <div>
            <h2 style={cardTitle}>GitHub Issues</h2>
            <p style={cardText}>
              提交 Bug 或功能建议最直接的方式，请附上问题描述与复现步骤：
              <br />
              <a
                href="https://github.com/EmenWebsiteCollection/yishen-navigation/issues"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--ym-accent)', textDecoration: 'none', fontWeight: '500' }}
              >
                github.com/EmenWebsiteCollection/yishen-navigation/issues
              </a>
            </p>
          </div>
        </div>

        <div style={card}>
          <div style={cardIcon}>📮</div>
          <div>
            <h2 style={cardTitle}>项目反馈邮箱</h2>
            <p style={cardText}>
              适合不方便公开讨论的内容，我们会定期查看：
              <br />
              <span style={placeholder}>contact@yishen-nav.example（待补充）</span>
            </p>
          </div>
        </div>

        <div style={card}>
          <div style={cardIcon}>💬</div>
          <div>
            <h2 style={cardTitle}>社区交流群</h2>
            <p style={cardText}>
              与开发者和其他用户交流、获取最新动态：
              <br />
              <span style={placeholder}>QQ 群：待补充</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
