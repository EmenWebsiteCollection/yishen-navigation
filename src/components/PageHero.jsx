import React from 'react';

export function PageHero({ emoji, title, subtitle }) {
  return (
    <div style={{ padding: '28px 0 8px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {emoji && <span style={{ fontSize: '24px', lineHeight: 1 }}>{emoji}</span>}
        <h1 style={{ fontFamily: 'var(--ym-font-display)', fontSize: '24px', fontWeight: '600', color: 'var(--ym-text-primary)', margin: 0 }}>
          {title}
        </h1>
      </div>
      {subtitle && (
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--ym-text-secondary)' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
