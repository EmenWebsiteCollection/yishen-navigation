// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { login } from '../services/auth.js';
import '../styles/global.css';

export function LoginPage({ onSuccess, onSwitchToRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || '登录失败，请检查用户名或密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{
        fontFamily: 'var(--ym-font-display)',
        fontSize: '24px',
        fontWeight: '500',
        color: 'var(--ym-text-primary)',
        marginBottom: '20px',
        letterSpacing: '1px',
      }}>
        登录
      </h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="login-username" style={{
            display: 'block',
            fontSize: '13px',
            color: 'var(--ym-text-secondary)',
            marginBottom: '4px',
            fontWeight: '500',
          }}>
            用户名
          </label>
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--ym-border)',
              borderRadius: 'var(--ym-radius-sm)',
              fontSize: '15px',
              backgroundColor: 'var(--ym-bg-card)',
              color: 'var(--ym-text-primary)',
              transition: 'border-color var(--ym-transition), box-shadow var(--ym-transition)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--ym-border-strong)';
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--ym-focus-ring)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--ym-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="login-password" style={{
            display: 'block',
            fontSize: '13px',
            color: 'var(--ym-text-secondary)',
            marginBottom: '4px',
            fontWeight: '500',
          }}>
            密码
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--ym-border)',
              borderRadius: 'var(--ym-radius-sm)',
              fontSize: '15px',
              backgroundColor: 'var(--ym-bg-card)',
              color: 'var(--ym-text-primary)',
              transition: 'border-color var(--ym-transition), box-shadow var(--ym-transition)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--ym-border-strong)';
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--ym-focus-ring)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--ym-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
        {error && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '16px',
            backgroundColor: 'var(--ym-danger-bg)',
            color: 'var(--ym-danger)',
            borderRadius: 'var(--ym-radius-sm)',
            borderLeft: '4px solid var(--ym-danger)',
            fontSize: '14px',
            animation: 'ym-slide-down var(--ym-transition) forwards',
          }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: loading ? 'var(--ym-accent)' : 'var(--ym-accent)',
            color: 'var(--ym-accent-text-on)',
            border: 'none',
            borderRadius: 'var(--ym-radius-sm)',
            fontSize: '16px',
            fontWeight: '500',
            transition: 'background-color var(--ym-transition), opacity var(--ym-transition)',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = 'var(--ym-accent-hover)';
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = 'var(--ym-accent)';
          }}
        >
          {loading ? (
            <>
              <span className="ym-spin" style={{
                display: 'inline-block',
                width: '16px',
                height: '16px',
                border: '2px solid var(--ym-accent-text-on)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
              }} />
              登录中...
            </>
          ) : '登录'}
        </button>
      </form>
      <p style={{
        marginTop: '16px',
        textAlign: 'center',
        fontSize: '14px',
        color: 'var(--ym-text-secondary)',
      }}>
        还没有账号？{' '}
        <span
          onClick={onSwitchToRegister}
          style={{
            color: 'var(--ym-accent)',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'color var(--ym-transition)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ym-accent-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ym-accent)'}
        >
          注册
        </span>
      </p>
    </div>
  );
}