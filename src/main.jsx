// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/global.css';
import './styles/responsive.css';

// 首帧渲染前完成设备检测，避免移动端布局闪跳（与 useDevice.js 断点一致）
try {
  const mqMobile = window.matchMedia('(max-width: 640px)');
  const mqTablet = window.matchMedia('(min-width: 641px) and (max-width: 1024px)');
  document.documentElement.setAttribute(
    'data-device',
    mqMobile.matches ? 'mobile' : mqTablet.matches ? 'tablet' : 'desktop'
  );
} catch (e) {
  document.documentElement.setAttribute('data-device', 'desktop');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
