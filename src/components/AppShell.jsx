import React, { useState } from 'react';
import { SiteHeader } from './SiteHeader.jsx';
import { AppFooter } from './AppFooter.jsx';
import { AuthModals } from './AuthModals.jsx';

export function AppShell({ children }) {
  const [authMode, setAuthMode] = useState(null);

  return (
    <div className="ym-page-shell">
      <SiteHeader onLogin={() => setAuthMode('login')} />
      <main className="ym-main">{children}</main>
      <AppFooter />
      <AuthModals mode={authMode} onClose={() => setAuthMode(null)} onSwitch={setAuthMode} />
    </div>
  );
}
