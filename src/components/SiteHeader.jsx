// src/components/SiteHeader.jsx
// 全站统一顶栏：Logo + 导航链接 + 右侧操作区。
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from './Logo.jsx';

const NAV_LINKS = [
  { to: '/about', label: '关于' },
  { to: '/changelog', label: '更新记录' },
  { to: '/contact', label: '联系我们' },
];

export function SiteHeader({ center, right }) {
  const { pathname } = useLocation();

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '12px 24px',
      backgroundColor: 'var(--ym-bg-card)',
      borderBottom: '1px solid var(--ym-border)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '12px',
    }}>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <Logo />
      </Link>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        {NAV_LINKS.map((link) => {
          const active = pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              style={{
                textDecoration: 'none',
                color: active ? 'var(--ym-accent)' : 'var(--ym-text-secondary)',
                fontSize: '14px',
                fontWeight: active ? '500' : 'normal',
                transition: 'color var(--ym-transition)',
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      {center && (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: '200px' }}>
          {center}
        </div>
      )}

      {right}
    </nav>
  );
}
