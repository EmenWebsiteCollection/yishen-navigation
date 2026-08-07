// src/components/ScrollToTop.jsx
// 页面切换后自动回到页面顶端（Issue #9 评论区反馈 + #19 分页场景补充）
// 放在 BrowserRouter 内、Routes 外。
//
// 监听 pathname + search：
// - pathname 变化 → 路由切换（进详情页 / 返回首页等）
// - search 变化 → 查询参数导航（如首页分页 ?page=N），补上分页回顶
// 使用双参形式 window.scrollTo(0, 0)：兼容不支持 options 对象的老浏览器（如旧版 iOS Safari），
// 避免 { behavior: 'smooth' } 在部分环境下静默失效。

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);

  return null;
}
