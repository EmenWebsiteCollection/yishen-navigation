// src/components/ThemeSwitcher.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useTheme, CUSTOM_THEME_ID } from '../hooks/useTheme.js';
import { validateImageFile } from '../services/screenshot.js';

const PaletteIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.55 0 1-.45 1-1 0-.27-.11-.51-.29-.69-.18-.18-.29-.42-.29-.69 0-.55.45-1 1-1h2.83c2.09 0 3.75-1.66 3.75-3.75C20 6.58 16.42 2 12 2zm-5 11c-.83 0-1.5-.67-1.5-1.5S6.17 10 7 10s1.5.67 1.5 1.5S6.83 13 7 13zm3-4C9.67 9 9 8.33 9 7.5S9.67 6 10 6s1.5.67 1.5 1.5S10.33 9 10 9zm4 0c-.83 0-1.5-.67-1.5-1.5S13.17 6 14 6s1.5.67 1.5 1.5S14.83 9 14 9zm3 4c-.83 0-1.5-.67-1.5-1.5S16.17 10 17 10s1.5.67 1.5 1.5S17.83 13 17 13z" />
  </svg>
);

/* 压缩本地图片为 dataURL，控制在 localStorage 可存的大小内 */
const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });

const compressImage = (dataUrl, maxW = 1920, quality = 0.8) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

const CustomFields = [
  { key: 'accent', label: '主色' },
  { key: 'bgPage', label: '页面背景' },
  { key: 'bgCard', label: '卡片背景' },
  { key: 'textPrimary', label: '主文字' },
  { key: 'textSecondary', label: '次要文字' },
];

export function ThemeSwitcher() {
  const {
    theme,
    setTheme,
    themes,
    custom,
    updateCustom,
    resetCustom,
    bgImage,
    setBgImage,
    removeBgImage,
  } = useTheme();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'custom'
  const rootRef = useRef(null);
  const fileRef = useRef(null);
  const [urlInput, setUrlInput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setView('list');
    };
    window.addEventListener('ym-open-theme', onOpen);
    return () => window.removeEventListener('ym-open-theme', onOpen);
  }, []);

  useEffect(() => {
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setView('list');
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setView('list');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const current = themes.find((t) => t.id === theme) || themes[0];

  const handlePickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      alert(err);
      return;
    }
    setBusy(true);
    try {
      const raw = await fileToDataUrl(file);
      const compressed = await compressImage(raw);
      setBgImage(compressed);
    } catch (error) {
      alert(error.message || '背景图处理失败');
    } finally {
      setBusy(false);
    }
  };

  const handleUrlApply = () => {
    const url = urlInput.trim();
    if (!url) return;
    setBgImage(url);
    setUrlInput('');
  };

  const selectTheme = (id) => {
    setTheme(id);
    if (id === CUSTOM_THEME_ID) {
      setView('custom');
    } else {
      setOpen(false);
      setView('list');
    }
  };

  const fieldStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '6px 0',
    fontSize: '13px',
    color: 'var(--ym-text-secondary)',
  };

  const colorInputStyle = {
    width: '44px',
    height: '28px',
    padding: 0,
    border: '1px solid var(--ym-border)',
    borderRadius: '6px',
    background: 'none',
    cursor: 'pointer',
  };

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

      {open && view === 'list' && (
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
              const swatch = t.id === CUSTOM_THEME_ID
                ? { accent: custom.accent, bg: custom.bgPage }
                : t;
              return (
                <button
                  key={t.id}
                  onClick={() => selectTheme(t.id)}
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
                      background: `linear-gradient(135deg, ${swatch.accent} 50%, ${swatch.bg} 50%)`,
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

      {open && view === 'custom' && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            bottom: '56px',
            width: '260px',
            maxHeight: '70vh',
            overflowY: 'auto',
            backgroundColor: 'var(--ym-bg-card)',
            border: '1px solid var(--ym-border)',
            borderRadius: 'var(--ym-radius-md)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
            animation: 'ym-scale-in var(--ym-transition) forwards',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--ym-text-secondary)',
              borderBottom: '1px solid var(--ym-border)',
              backgroundColor: 'var(--ym-bg-subtle)',
              position: 'sticky',
              top: 0,
            }}
          >
            <button
              onClick={() => setView('list')}
              style={{
                border: 'none',
                background: 'none',
                color: 'var(--ym-accent)',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '0 2px',
              }}
              title="返回"
            >
              ←
            </button>
            <span>自定义主题</span>
          </div>

          <div style={{ padding: '12px 14px' }}>
            {CustomFields.map((f) => (
              <div key={f.key} style={fieldStyle}>
                <label style={{ flex: 1 }}>{f.label}</label>
                <input
                  type="color"
                  value={custom[f.key]}
                  onChange={(e) => updateCustom({ [f.key]: e.target.value })}
                  style={colorInputStyle}
                  title={custom[f.key]}
                />
              </div>
            ))}

            <div
              style={{
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid var(--ym-border)',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ym-text-secondary)', marginBottom: '8px' }}>
                背景图片
              </div>

              {bgImage && (
                <div
                  style={{
                    marginBottom: '8px',
                    borderRadius: 'var(--ym-radius-sm)',
                    overflow: 'hidden',
                    border: '1px solid var(--ym-border)',
                  }}
                >
                  <img
                    src={bgImage}
                    alt="背景图预览"
                    style={{ width: '100%', height: '72px', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handlePickFile}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--ym-border)',
                  borderRadius: 'var(--ym-radius-sm)',
                  backgroundColor: 'var(--ym-bg-subtle)',
                  color: 'var(--ym-text-primary)',
                  cursor: busy ? 'default' : 'pointer',
                  fontSize: '13px',
                  marginBottom: '6px',
                }}
              >
                {busy ? '处理中...' : '上传图片'}
              </button>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUrlApply();
                  }}
                  placeholder="或粘贴图片 URL"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '8px',
                    border: '1px solid var(--ym-border)',
                    borderRadius: 'var(--ym-radius-sm)',
                    backgroundColor: 'var(--ym-bg-page)',
                    color: 'var(--ym-text-primary)',
                    fontSize: '13px',
                  }}
                />
                <button
                  onClick={handleUrlApply}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--ym-border)',
                    borderRadius: 'var(--ym-radius-sm)',
                    backgroundColor: 'var(--ym-bg-subtle)',
                    color: 'var(--ym-text-primary)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    flexShrink: 0,
                  }}
                >
                  应用
                </button>
              </div>

              {bgImage && (
                <button
                  onClick={removeBgImage}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--ym-danger)',
                    borderRadius: 'var(--ym-radius-sm)',
                    backgroundColor: 'var(--ym-danger-bg)',
                    color: 'var(--ym-danger)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    marginBottom: '8px',
                  }}
                >
                  移除背景图
                </button>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                paddingTop: '10px',
                borderTop: '1px solid var(--ym-border)',
              }}
            >
              <button
                onClick={() => {
                  resetCustom();
                  setView('list');
                }}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: '1px solid var(--ym-border)',
                  borderRadius: 'var(--ym-radius-sm)',
                  backgroundColor: 'var(--ym-bg-subtle)',
                  color: 'var(--ym-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                恢复默认
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  setView('list');
                }}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: '1px solid var(--ym-accent)',
                  borderRadius: 'var(--ym-radius-sm)',
                  backgroundColor: 'var(--ym-accent)',
                  color: 'var(--ym-accent-text-on)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
