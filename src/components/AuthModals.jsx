import React from 'react';
import { LoginPage } from '../pages/LoginPage.jsx';
import { RegisterPage } from '../pages/RegisterPage.jsx';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage.jsx';

// 支持三种模式：login（登录）/ register（注册）/ forgot（找回密码）
// onSwitch 由 AppShell 传入的 setAuthMode，直接切换模式即可。
export function AuthModals({ mode, onClose, onSwitch }) {
  if (!mode) return null;

  return (
    <div className="ym-modal-backdrop" onClick={onClose}>
      <div className="ym-modal-card" onClick={(e) => e.stopPropagation()}>
        {mode === 'login' && (
          <LoginPage
            onSuccess={onClose}
            onSwitchToRegister={() => onSwitch('register')}
            onSwitchToForgot={() => onSwitch('forgot')}
          />
        )}
        {mode === 'register' && <RegisterPage onSuccess={onClose} />}
        {mode === 'forgot' && (
          <ForgotPasswordPage
            onClose={onClose}
            onBackToLogin={() => onSwitch('login')}
          />
        )}
        <div style={{ textAlign: 'right', marginTop: '16px' }}>
          <button type="button" className="ym-btn ym-btn-ghost ym-btn-sm" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
