// src/pages/RegisterPage.jsx
import React, { useState } from 'react';
import { register } from '../services/auth.js';
import { bindContact } from '../services/users.js';
import '../styles/global.css';

export function RegisterPage({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!username.trim()) {
      setError('用户名不能为空');
      return;
    }
    if (/[\u4e00-\u9fa5]/.test(username)) {
      setError('用户名不能使用中文');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (password.length < 6) {
      setError('密码长度至少为 6 位');
      return;
    }

    setLoading(true);
    try {
      const data = await register(username, password);
      setSuccess(true);
      // 可选：绑定邮箱/手机，供找回密码使用（注册后已自动登录时生效）
      if ((email.trim() || phone.trim()) && data?.user?.id) {
        try {
          await bindContact({ email: email.trim(), phone: phone.trim() });
        } catch (e) {
          console.warn('绑定联系方式失败（可稍后在个人资料中补充）:', e.message);
        }
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || '注册失败，请稍后重试');
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
        注册
      </h2>
      {success ? (
        <div style={{
          padding: '16px',
          backgroundColor: 'var(--ym-success-bg)',
          color: 'var(--ym-success)',
          borderRadius: 'var(--ym-radius-sm)',
          borderLeft: '4px solid var(--ym-success)',
          marginBottom: '16px',
          animation: 'ym-fade-in var(--ym-transition) forwards',
        }}>
          <p style={{ fontWeight: '500' }}>✅ 注册成功！</p>
          <p style={{ fontSize: '14px', marginTop: '4px' }}>请关闭弹窗，然后使用您的用户名和密码登录。</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="register-username" style={{
              display: 'block',
              fontSize: '13px',
              color: 'var(--ym-text-secondary)',
              marginBottom: '4px',
              fontWeight: '500',
            }}>
              用户名
            </label>
            <input
              id="register-username"
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
            <p style={{
              fontSize: '12px',
              color: 'var(--ym-text-secondary)',
              marginTop: '6px',
              lineHeight: '1.5',
            }}>
              用户名不能使用中文，请使用字母、数字或下划线。
            </p>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="register-password" style={{
              display: 'block',
              fontSize: '13px',
              color: 'var(--ym-text-secondary)',
              marginBottom: '4px',
              fontWeight: '500',
            }}>
              密码（至少 6 位）
            </label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength="6"
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
            <label htmlFor="register-confirm" style={{
              display: 'block',
              fontSize: '13px',
              color: 'var(--ym-text-secondary)',
              marginBottom: '4px',
              fontWeight: '500',
            }}>
              确认密码
            </label>
            <input
              id="register-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            <label htmlFor="register-email" style={{
              display: 'block',
              fontSize: '13px',
              color: 'var(--ym-text-secondary)',
              marginBottom: '4px',
              fontWeight: '500',
            }}>
              邮箱（可选，用于找回密码）
            </label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="用于接收验证码找回密码"
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
            <label htmlFor="register-phone" style={{
              display: 'block',
              fontSize: '13px',
              color: 'var(--ym-text-secondary)',
              marginBottom: '4px',
              fontWeight: '500',
            }}>
              手机号（可选，用于找回密码）
            </label>
            <input
              id="register-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="用于接收验证码找回密码"
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
                注册中...
              </>
            ) : '注册'}
          </button>
        </form>
      )}
    </div>
  );
}
