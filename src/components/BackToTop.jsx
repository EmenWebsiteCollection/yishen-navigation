// src/components/BackToTop.jsx
// 一键回到顶部按钮：滚动超过一定距离后浮现，点击平滑回到顶部。
import React, { useEffect, useState } from 'react';

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="回到顶部"
      title="回到顶部"
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '76px',
        zIndex: 1000,
        width: '46px',
        height: '46px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--ym-bg-card)',
        border: '1px solid var(--ym-border)',
        color: 'var(--ym-accent)',
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        opacity: visible ? 1 : 0,
        visibility: visible ? 'visible' : 'hidden',
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition:
          'opacity var(--ym-transition), transform var(--ym-transition), visibility var(--ym-transition), border-color var(--ym-transition), background-color var(--ym-transition)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--ym-border-strong)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--ym-border)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 20c-.55 0-1-.45-1-1V7.83l-4.58 4.58c-.39.39-1.02.39-1.41 0s-.39-1.02 0-1.41l6.29-6.29c.2-.2.45-.29.71-.29s.51.1.71.29l6.29 6.29c.39.39.39 1.02 0 1.41s-1.02.39-1.41 0L13 7.83V19c0 .55-.45 1-1 1z" />
      </svg>
    </button>
  );
}
