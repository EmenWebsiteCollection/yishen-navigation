// src/components/ScrollToTop.jsx
// 页面切换后自动回到页面顶端（Issue #9 评论区反馈 + #19 分页场景补充）
// 放在 BrowserRouter 内、Routes 外。
//
// 只在路由路径变化时回顶；查询参数变化由各页面自行处理滚动位置
// （如首页/想法列表的分页与分区切换用 scrollIntoView 滚到列表区域）。
// 使用双参形式 window.scrollTo(0, 0)：兼容不支持 options 对象的老浏览器（如旧版 iOS Safari），
// 避免 { behavior: 'smooth' } 在部分环境下静默失效。

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
