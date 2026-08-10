import React, { useEffect, useState } from 'react';
import { SiteHeader } from './SiteHeader.jsx';
import { AppFooter } from './AppFooter.jsx';
import { AuthModals } from './AuthModals.jsx';

export function AppShell({ children }) {
  const [authMode, setAuthMode] = useState(null);

  // 监听依力对话面板发出的「去登录」请求，弹出登录框
  useEffect(() => {
    const openAuth = () => setAuthMode('login');
    window.addEventListener('yili-open-auth', openAuth);
    return () => window.removeEventListener('yili-open-auth', openAuth);
  }, []);

  return (
    <div className="ym-page-shell">
      <SiteHeader onLogin={() => setAuthMode('login')} />
      <main className="ym-main">{children}</main>
      <AppFooter />
      <AuthModals mode={authMode} onClose={() => setAuthMode(null)} onSwitch={setAuthMode} />
    </div>
  );
}
