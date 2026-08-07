// src/components/ThemeSwitcher.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../hooks/useTheme.js';

const PaletteIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.55 0 1-.45 1-1 0-.27-.11-.51-.29-.69-.18-.18-.29-.42-.29-.69 0-.55.45-1 1-1h2.83c2.09 0 3.75-1.66 3.75-3.75C20 6.58 16.42 2 12 2zm-5 11c-.83 0-1.5-.67-1.5-1.5S6.17 10 7 10s1.5.67 1.5 1.5S7.83 13 7 13zm3-4C9.67 9 9 8.33 9 7.5S9.67 6 10 6s1.5.67 1.5 1.5S10.33 9 10 9zm4 0c-.83 0-1.5-.67-1.5-1.5S13.17 6 14 6s1.5.67 1.5 1.5S14.83 9 14 9zm3 4c-.83 0-1.5-.67-1.5-1.5S16.17 10 17 10s1.5.67 1.5 1.5S17.83 13 17 13z" />
  </svg>
);

export function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const current = themes.find((t) => t.id === theme) || themes[0];

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        zIndex: 1001,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="切换主题"
        title="切换主题"
        style={{
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
          transition: 'transform var(--ym-transition), border-color var(--ym-transition), background-color var(--ym-transition)',
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
        <PaletteIcon />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            bottom: '56px',
            width: '224px',
            backgroundColor: 'var(--ym-bg-card)',
            border: '1px solid var(--ym-border)',
            borderRadius: 'var(--ym-radius-md)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            animation: 'ym-scale-in var(--ym-transition) forwards',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--ym-text-secondary)',
              borderBottom: '1px solid var(--ym-border)',
              backgroundColor: 'var(--ym-bg-subtle)',
            }}
          >
            选择主题
          </div>
          <div style={{ padding: '6px' }}>
            {themes.map((t) => {
              const active = t.id === theme;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    setOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    borderRadius: 'var(--ym-radius-sm)',
                    backgroundColor: active ? 'var(--ym-bg-subtle)' : 'transparent',
                    color: active ? 'var(--ym-text-primary)' : 'var(--ym-text-secondary)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: active ? '500' : 'normal',
                    textAlign: 'left',
                    transition: 'background-color var(--ym-transition), color var(--ym-transition)',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = 'var(--ym-bg-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: `linear-gradient(135deg, ${t.accent} 50%, ${t.bg} 50%)`,
                      border: '1px solid var(--ym-border)',
                    }}
                  />
                  <span style={{ flex: 1 }}>{t.name}</span>
                  {active && (
                    <span style={{ color: 'var(--ym-accent)', fontSize: '13px', fontWeight: '500' }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
