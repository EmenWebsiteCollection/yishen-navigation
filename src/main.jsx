// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

// GitHub Pages 项目站点部署在子路径（如 /yishen-navigation/），
// 用 Vite 的 BASE_URL 作为路由 basename，保证深链接与刷新正常。
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';
import './styles/global.css';
import './styles/responsive.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter
      basename={basename}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// 首屏 loading 淡出
(function hideLoader() {
  var el = document.getElementById('loading-screen');
  if (!el) return;
  // 同一会话已播放过：直接移除，不用等动画
  if (document.documentElement.classList.contains('boot-skipped')) {
    if (el.parentNode) el.parentNode.removeChild(el);
    return;
  }
  var start = performance.now();
  var minTime = 1200;
  var finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    var elapsed = performance.now() - start;
    var remaining = Math.max(0, minTime - elapsed);
    setTimeout(function () {
      if (window.__wingTimer) {
        clearInterval(window.__wingTimer);
        window.__wingTimer = null;
      }
      el.classList.add('is-hidden');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 600);
    }, remaining);
  }
  // 5s 兜底
  setTimeout(finish, 5000);
  if (document.readyState === 'complete') {
    finish();
  } else {
    window.addEventListener('load', finish, { once: true });
  }
})();
