// src/components/ScrollToTop.jsx
// 路由切换后自动回到页面顶端（Issue #9 评论区反馈：
// 「页面切换后会保留在页面底端，切换后跳到页面顶端会好一点」）
// 放在 BrowserRouter 内、Routes 外，监听 pathname 变化即可。

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // 路由切换：直接回到顶部（不使用 smooth，避免长页面滚动动画拖沓）
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
