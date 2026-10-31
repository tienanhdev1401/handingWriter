import { useState, useEffect, useCallback } from 'react';

// Theme sáng/tối. Giá trị màu nằm ở CSS variable (index.css); ở đây chỉ
// lật thuộc tính data-theme trên <html>. Chưa từng chọn tay → theo OS.
export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'theme';

function initTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
