// src/pages/ForgotPasswordPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { sendResetCode, resetPasswordWithCode, isValidEmail, isValidPhone } from '../services/passwordRecovery.js';
import '../styles/global.css';

const RESEND_SECONDS = 60;

export function ForgotPasswordPage({ onClose, onSuccess }) {
  const [channel, setChannel] = useState('email'); // 'email' | 'phone'
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_SECONDS);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const validateValue = () => {
    if (!value.trim()) return channel === 'phone' ? '请输入手机号' : '请输入邮箱';
    if (channel === 'email' && !isValidEmail(value)) return '邮箱格式不正确';
    if (channel === 'phone' && !isValidPhone(value)) return '手机号格式不正确';
    return '';
  };

  const handleSendCode = async () => {
    const err = validateValue();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setSending(true);
    try {
      await sendResetCode({ channel, value });
      startCooldown();
      setError('');
      // 提示已发送（开发环境下验证码可在 Supabase 后台 Auth 日志查看）
      setCodeSent(true);
    } catch (err) {
      setError(err.message || '验证码发送失败，请稍后重试');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!codeSent) {
      setError('请先获取验证码');
      return;
    }
    if (!code.trim()) {
      setError('请输入验证码');
      return;
    }
    if (newPassword.length < 6) {
      setError('新密码长度至少为 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    try {
      await resetPasswordWithCode({ channel, value, code, newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err.message || '重置失败，请检查验证码或稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const switchChannel = (next) => {
    setChannel(next);
    setError('');
    setCode('');
    setCodeSent(false);
  };

  // 成功视图
  if (success) {
    return (
      <div>
        <h2 style={titleStyle}>找回成功</h2>
        <div style={{
          padding: '16px',
          backgroundColor: 'var(--ym-success-bg)',
          color: 'var(--ym-success)',
          borderRadius: 'var(--ym-radius-sm)',
          borderLeft: '4px solid var(--ym-success)',
          marginBottom: '16px',
          animation: 'ym-fade-in var(--ym-transition) forwards',
        }}>
          <p style={{ fontWeight: '500' }}>✅ 密码已重置！</p>
          <p style={{ fontSize: '14px', marginTop: '4px' }}>请使用新密码登录。</p>
        </div>
        <button type="button" onClick={onClose} style={primaryBtnStyle(false)}>
          完成
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 style={titleStyle}>找回密码</h2>

      {/* 渠道切换 */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        backgroundColor: 'var(--ym-bg-subtle)',
        padding: '4px',
        borderRadius: 'var(--ym-radius-sm)',
      }}>
        {[
          { key: 'email', label: '邮箱' },
          { key: 'phone', label: '手机号' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => switchChannel(tab.key)}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: 'var(--ym-radius-sm)',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all var(--ym-transition)',
              backgroundColor: channel === tab.key ? 'var(--ym-bg-card)' : 'transparent',
              color: channel === tab.key ? 'var(--ym-text-primary)' : 'var(--ym-text-secondary)',
              boxShadow: channel === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* 联系方式输入 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="fp-value" style={labelStyle}>
            {channel === 'phone' ? '手机号' : '邮箱'}
          </label>
          <input
            id="fp-value"
            type={channel === 'phone' ? 'tel' : 'email'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={channel === 'phone' ? '请输入注册时绑定的手机号' : '请输入注册时绑定的邮箱'}
            required
            style={inputStyle}
            onFocus={focusIn}
            onBlur={focusOut}
          />
        </div>

        {/* 验证码 + 发送按钮 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="fp-code" style={labelStyle}>验证码</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="fp-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="6 位验证码"
              required
              style={{ ...inputStyle, flex: 1 }}
              onFocus={focusIn}
              onBlur={focusOut}
            />
            <button
              type="button"
              onClick={handleSendCode}
              disabled={sending || cooldown > 0}
              style={{
                ...primaryBtnStyle(sending || cooldown > 0),
                width: 'auto',
                whiteSpace: 'nowrap',
                padding: '10px 14px',
              }}
            >
              {sending ? '发送中...' : cooldown > 0 ? `${cooldown}s 后重发` : '发送验证码'}
            </button>
          </div>
        </div>

        {/* 新密码 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="fp-new" style={labelStyle}>新密码（至少 6 位）</label>
          <input
            id="fp-new"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength="6"
            style={inputStyle}
            onFocus={focusIn}
            onBlur={focusOut}
          />
        </div>

        {/* 确认新密码 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="fp-confirm" style={labelStyle}>确认新密码</label>
          <input
            id="fp-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={inputStyle}
            onFocus={focusIn}
            onBlur={focusOut}
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
          style={primaryBtnStyle(loading)}
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
              重置中...
            </>
          ) : '重置密码'}
        </button>
      </form>

      <p style={{
        marginTop: '16px',
        textAlign: 'center',
        fontSize: '14px',
        color: 'var(--ym-text-secondary)',
      }}>
        <span
          onClick={onClose}
          style={{
            color: 'var(--ym-accent)',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'color var(--ym-transition)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ym-accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ym-accent)')}
        >
          返回登录
        </span>
      </p>
    </div>
  );
}

/* ---------- 复用样式（与 LoginPage 一致） ---------- */
const titleStyle = {
  fontFamily: 'var(--ym-font-display)',
  fontSize: '24px',
  fontWeight: '500',
  color: 'var(--ym-text-primary)',
  marginBottom: '20px',
  letterSpacing: '1px',
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  color: 'var(--ym-text-secondary)',
  marginBottom: '4px',
  fontWeight: '500',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--ym-border)',
  borderRadius: 'var(--ym-radius-sm)',
  fontSize: '15px',
  backgroundColor: 'var(--ym-bg-card)',
  color: 'var(--ym-text-primary)',
  transition: 'border-color var(--ym-transition), box-shadow var(--ym-transition)',
};

const focusIn = (e) => {
  e.currentTarget.style.borderColor = 'var(--ym-border-strong)';
  e.currentTarget.style.boxShadow = '0 0 0 3px var(--ym-focus-ring)';
};

const focusOut = (e) => {
  e.currentTarget.style.borderColor = 'var(--ym-border)';
  e.currentTarget.style.boxShadow = 'none';
};

const primaryBtnStyle = (disabled) => ({
  width: '100%',
  padding: '10px',
  backgroundColor: 'var(--ym-accent)',
  color: 'var(--ym-accent-text-on)',
  border: 'none',
  borderRadius: 'var(--ym-radius-sm)',
  fontSize: '16px',
  fontWeight: '500',
  transition: 'background-color var(--ym-transition), opacity var(--ym-transition)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
});
