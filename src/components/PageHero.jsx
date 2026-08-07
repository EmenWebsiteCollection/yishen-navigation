// src/components/PageHero.jsx
// 信息页顶部横幅：大号 emoji + 标题 + 副标题 + 返回主页按钮。
import React from 'react';
import { Link } from 'react-router-dom';

export function PageHero({ emoji, title, subtitle }) {
  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      margin: '32px auto 32px',
      maxWidth: '880px',
      padding: '36px 32px',
      borderRadius: 'var(--ym-radius-lg)',
      backgroundColor: 'var(--ym-bg-card)',
      border: '1px solid var(--ym-border)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      textAlign: 'center',
    }}>
      {/* 背景装饰 */}
      <div style={{
        position: 'absolute',
        top: '-40px',
        right: '-40px',
        width: '160px',
        height: '160px',
        borderRadius: '50%',
        backgroundColor: 'var(--ym-focus-ring)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-60px',
        left: '-30px',
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        backgroundColor: 'var(--ym-focus-ring)',
        pointerEvents: 'none',
      }} />

      <div style={{ fontSize: '56px', lineHeight: 1, marginBottom: '12px', position: 'relative' }}>{emoji}</div>
      <h1 style={{
        fontFamily: 'var(--ym-font-display)',
        fontSize: '26px',
        fontWeight: '500',
        color: 'var(--ym-text-primary)',
        marginBottom: '6px',
        letterSpacing: '1px',
        position: 'relative',
      }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ fontSize: '14px', color: 'var(--ym-text-muted)', marginBottom: '20px', position: 'relative' }}>
          {subtitle}
        </p>
      )}
      <Link
        to="/"
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 22px',
          borderRadius: 'var(--ym-radius-sm)',
          backgroundColor: 'var(--ym-accent)',
          color: 'var(--ym-accent-text-on)',
          fontSize: '14px',
          fontWeight: '500',
          textDecoration: 'none',
          transition: 'background-color var(--ym-transition), transform var(--ym-transition)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--ym-accent-hover)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--ym-accent)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        🏠 返回主页
      </Link>
    </div>
  );
}
