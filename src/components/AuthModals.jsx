import React from 'react';
import { LoginPage } from '../pages/LoginPage.jsx';
import { RegisterPage } from '../pages/RegisterPage.jsx';

export function AuthModals({ mode, onClose, onSwitch }) {
  if (!mode) return null;

  return (
    <div className="ym-modal-backdrop" onClick={onClose}>
      <div className="ym-modal-card" onClick={(e) => e.stopPropagation()}>
        {mode === 'login' ? (
          <LoginPage onSuccess={onClose} onSwitchToRegister={() => onSwitch('register')} />
        ) : (
          <RegisterPage onSuccess={onClose} />
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
