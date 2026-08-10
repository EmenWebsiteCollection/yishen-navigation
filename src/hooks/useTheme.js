// src/hooks/useTheme.js
import { useState, useEffect } from 'react';

export const STORAGE_KEY = 'ym-theme';
export const CUSTOM_STORAGE_KEY = 'ym-custom-theme';
export const BG_IMAGE_KEY = 'ym-bg-image';
export const CUSTOM_THEME_ID = 'custom';

export const THEMES = [
  { id: 'default', name: '依神默认', accent: '#FB7299', bg: '#F6F7F8' },
  { id: 'catppuccin', name: 'Catppuccin', accent: '#89B4FA', bg: '#1E1E2E' },
  { id: 'tokyonight', name: 'Tokyo Night', accent: '#7AA2F7', bg: '#16161E' },
  { id: 'onedark', name: 'One Dark', accent: '#61AFEF', bg: '#21252B' },
  { id: 'dracula', name: 'Dracula', accent: '#BD93F9', bg: '#21222C' },
  { id: 'macos', name: 'Mac OS', accent: '#0A84FF', bg: '#F5F5F7' },
  { id: 'macosdark', name: 'Mac OS 暗色', accent: '#A8C7FA', bg: '#121625' },
  { id: CUSTOM_THEME_ID, name: '自定义', accent: '#9C6B2E', bg: '#F3EAD8' },
];

const DEFAULT_CUSTOM = {
  accent: '#9C6B2E',
  bgPage: '#F3EAD8',
  bgCard: '#FFFCF5',
  textPrimary: '#3A2E1F',
  textSecondary: '#8A7355',
};

const CUSTOM_VARS = [
  '--ym-accent',
  '--ym-accent-hover',
  '--ym-accent-text-on',
  '--ym-bg-page',
  '--ym-bg-card',
  '--ym-bg-subtle',
  '--ym-text-primary',
  '--ym-text-secondary',
  '--ym-text-muted',
  '--ym-border',
  '--ym-border-strong',
  '--ym-focus-ring',
];

const isValidTheme = (id) => THEMES.some((t) => t.id === id);

/* ---------- 颜色工具 ---------- */
const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
};

const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

const mix = (a, b, t) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A || !B) return a;
  return rgbToHex({
    r: A.r + (B.r - A.r) * t,
    g: A.g + (B.g - A.g) * t,
    b: A.b + (B.b - A.b) * t,
  });
};

const darken = (hex, p) => mix(hex, '#000000', p);

const rgba = (hex, alpha) => {
  const c = hexToRgb(hex);
  return c ? `rgba(${c.r},${c.g},${c.b},${alpha})` : hex;
};

const luminance = (hex) => {
  const c = hexToRgb(hex);
  if (!c) return 0;
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
};

/* 根据用户自定义的五项基础色推导出完整主题变量 */
export const deriveCustomVars = (c) => ({
  '--ym-accent': c.accent,
  '--ym-accent-hover': darken(c.accent, 0.1),
  '--ym-accent-text-on': luminance(c.accent) > 0.6 ? '#3A2E1F' : '#FFFFFF',
  '--ym-bg-page': c.bgPage,
  '--ym-bg-card': c.bgCard,
  '--ym-bg-subtle': mix(c.bgPage, c.textSecondary, 0.15),
  '--ym-text-primary': c.textPrimary,
  '--ym-text-secondary': c.textSecondary,
  '--ym-text-muted': mix(c.textPrimary, c.bgPage, 0.7),
  '--ym-border': mix(c.bgPage, c.textSecondary, 0.3),
  '--ym-border-strong': c.accent,
  '--ym-focus-ring': rgba(c.accent, 0.12),
});

const applyCustomVars = (c) => {
  const root = document.documentElement;
  const vars = deriveCustomVars(c);
  Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
};

const clearCustomVars = () => {
  const root = document.documentElement;
  CUSTOM_VARS.forEach((name) => root.style.removeProperty(name));
};

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return isValidTheme(saved) ? saved : 'default';
    } catch (_) {
      return 'default';
    }
  });

  const [custom, setCustom] = useState(() => {
    try {
      const raw = window.localStorage.getItem(CUSTOM_STORAGE_KEY);
      if (!raw) return DEFAULT_CUSTOM;
      return { ...DEFAULT_CUSTOM, ...JSON.parse(raw) };
    } catch (_) {
      return DEFAULT_CUSTOM;
    }
  });

  const [bgImage, setBgImage] = useState(() => {
    try {
      return window.localStorage.getItem(BG_IMAGE_KEY) || '';
    } catch (_) {
      return '';
    }
  });

  /* 主题生效 + 自定义主题变量 + 背景图透明层 */
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === CUSTOM_THEME_ID) {
      applyCustomVars(custom);
    } else {
      clearCustomVars();
    }
    if (bgImage) {
      root.style.setProperty('--ym-bg-page', 'transparent');
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {
      /* 忽略存储异常 */
    }
  }, [theme, custom, bgImage]);

  /* 背景图：设置 body 背景样式 */
  useEffect(() => {
    const body = document.body;
    if (bgImage) {
      body.classList.add('ym-has-bg');
      body.style.backgroundImage = `url("${bgImage}")`;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundAttachment = 'fixed';
      try {
        window.localStorage.setItem(BG_IMAGE_KEY, bgImage);
      } catch (_) {
        /* 忽略存储异常 */
      }
    } else {
      body.classList.remove('ym-has-bg');
      body.style.backgroundImage = '';
      body.style.backgroundSize = '';
      body.style.backgroundPosition = '';
      body.style.backgroundAttachment = '';
      try {
        window.localStorage.removeItem(BG_IMAGE_KEY);
      } catch (_) {
        /* 忽略存储异常 */
      }
    }
  }, [bgImage]);

  /* 持久化自定义主题 */
  useEffect(() => {
    try {
      window.localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(custom));
    } catch (_) {
      /* 忽略存储异常 */
    }
  }, [custom]);

  const updateCustom = (patch) => setCustom((prev) => ({ ...prev, ...patch }));

  const resetCustom = () => setCustom(DEFAULT_CUSTOM);

  const removeBgImage = () => setBgImage('');

  return {
    theme,
    setTheme,
    themes: THEMES,
    custom,
    updateCustom,
    resetCustom,
    bgImage,
    setBgImage,
    removeBgImage,
  };
}
