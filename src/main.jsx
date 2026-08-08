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