// src/hooks/useTheme.js
import { useState, useEffect } from 'react';

export const STORAGE_KEY = 'ym-theme';

export const THEMES = [
  { id: 'default', name: '依神默认', accent: '#9C6B2E', bg: '#F3EAD8' },
  { id: 'catppuccin', name: 'Catppuccin', accent: '#1E66F5', bg: '#E6E9EF' },
  { id: 'tokyonight', name: 'Tokyo Night', accent: '#7AA2F7', bg: '#16161E' },
  { id: 'onedark', name: 'One Dark', accent: '#61AFEF', bg: '#21252B' },
  { id: 'dracula', name: 'Dracula', accent: '#BD93F9', bg: '#21222C' },
  { id: 'macos', name: 'macOS', accent: '#0A84FF', bg: '#F5F5F7' },
];

const isValidTheme = (id) => THEMES.some((t) => t.id === id);

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return isValidTheme(saved) ? saved : 'default';
    } catch (_) {
      return 'default';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {
      /* 忽略存储异常 */
    }
  }, [theme]);

  return { theme, setTheme, themes: THEMES };
}
