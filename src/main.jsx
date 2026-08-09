// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

// GitHub Pages 项目站点部署在子路径（如 /yishen-navigation/），
// 用 Vite 的 BASE_URL 作为路由 basename，保证深链接与刷新正常。
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';
import './styles/global.css';
import './styles/tech-loader.css';
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
  // 确保动画至少播放 1.2s，然后淡出
  var start = performance.now();
  var minTime = 1200;
  function finish() {
    var elapsed = performance.now() - start;
    var remaining = Math.max(0, minTime - elapsed);
    setTimeout(function () {
      // 停止翅膀帧动画
      if (window.__wingTimer) {
        clearInterval(window.__wingTimer);
        window.__wingTimer = null;
      }
      el.classList.add('is-hidden');
      // 淡出完成后从 DOM 移除
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 600);
    }, remaining);
  }
  if (document.readyState === 'complete') {
    finish();
  } else {
    window.addEventListener('load', finish);
  }
})();