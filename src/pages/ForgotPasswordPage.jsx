// src/pages/ForgotPasswordPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestResetCode, verifyResetCode } from '../services/passwordReset.js';
import '../styles/global.css';

const TABS = [
  { key: 'email', label: '邮箱', placeholder: '请输入绑定邮箱' },
  { key: 'phone', label: '手机号', placeholder: '请输入绑定手机号' },
];

export function ForgotPasswordPage({ onClose, onBackToLogin }) {
  const navigate = useNavigate();
  const close = onClose || (() => navigate('/'));
  const back = onBackToLogin || (() => navigate('/'));

  const [tab, setTab] = useState('email');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const startCooldown = () => {
    setCooldown(60);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const validateContact = () => {
    if (tab === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) {
      setError('请输入合法的邮箱地址');
      return false;
    }
    if (tab === 'phone' && !/^\+?[0-9]{6,15}$/.test(contact)) {
      setError('请输入合法的手机号');
      return false;
    }
    return true;
  };

  const handleSend = async () => {
    setError('');
    setInfo('');
    if (!validateContact()) return;
    setLoading(true);
    try {
      const data = await requestResetCode(tab, contact);
      setSent(true);
      startCooldown();
      setInfo(data?.message || '验证码已发送，请注意查收。');
    } catch (err) {
      setError(err.message || err.error || '发送失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!sent) {
      setError('请先获取验证码');
      return;
    }
    if (!validateContact()) return;
    if (!/^\d{6}$/.test(code)) {
      setError('验证码为 6 位数字');
      return;
    }
    if (password.length < 6) {
      setError('新密码至少 6 位');
      return;
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const data = await verifyResetCode(tab, contact, code, password);
      setInfo(data?.message || '密码已重置，请用新密码登录。');
      setError('');
      setSent(false);
      // 成功后引导回登录
      setTimeout(() => back(), 1200);
    } catch (err) {
      setError(err.message || err.error || '重置失败，请检查验证码');
    } finally {
      setLoading(false);
    }
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
  const focusHandlers = {
    onFocus: (e) => {
      e.currentTarget.style.borderColor = 'var(--ym-border-strong)';
      e.currentTarget.style.boxShadow = '0 0 0 3px var(--ym-focus-ring)';
    },
    onBlur: (e) => {
      e.currentTarget.style.borderColor = 'var(--ym-border)';
      e.currentTarget.style.boxShadow = 'none';
    },
  };
  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    color: 'var(--ym-text-secondary)',
    marginBottom: '4px',
    fontWeight: '500',
  };

  return (
    <div>
      <h2 style={{
        fontFamily: 'var(--ym-font-display)',
        fontSize: '24px',
        fontWeight: '500',
        color: 'var(--ym-text-primary)',
        marginBottom: '8px',
        letterSpacing: '1px',
      }}>
        找回密码
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--ym-text-muted)', marginBottom: '16px' }}>
        通过绑定邮箱或手机号接收验证码，验证后重置密码。
      </p>

      {/* 邮箱 / 手机 切换 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setError(''); setInfo(''); setSent(false); }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 'var(--ym-radius-sm)',
              border: '1px solid',
              borderColor: tab === t.key ? 'var(--ym-accent)' : 'var(--ym-border)',
              backgroundColor: tab === t.key ? 'var(--ym-accent-soft)' : 'transparent',
              color: tab === t.key ? 'var(--ym-accent)' : 'var(--ym-text-secondary)',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all var(--ym-transition)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 手机验证码临时提示：短信服务尚未部署，先不开放 */}
      {tab === 'phone' && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          backgroundColor: 'var(--ym-warning-bg, #fff7e6)',
          color: 'var(--ym-warning, #b26a00)',
          borderRadius: 'var(--ym-radius-sm)',
          borderLeft: '4px solid var(--ym-warning, #b26a00)',
          fontSize: '14px',
        }}>
          🚧 手机验证码功能正在部署中，暂不可用。请使用「邮箱」方式找回密码。
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 联系方式 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="fp-contact" style={labelStyle}>
            {tab === 'email' ? '邮箱' : '手机号'}
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="fp-contact"
              type={tab === 'email' ? 'email' : 'tel'}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={TABS.find((t) => t.key === tab).placeholder}
              required
              disabled={sent || tab === 'phone'}
              style={{ ...inputStyle, ...focusHandlers, flex: 1 }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || cooldown > 0 || sent || tab === 'phone'}
              style={{
                padding: '0 14px',
                whiteSpace: 'nowrap',
                border: '1px solid var(--ym-border)',
                borderRadius: 'var(--ym-radius-sm)',
                backgroundColor: 'var(--ym-bg-card)',
                color: cooldown > 0 ? 'var(--ym-text-muted)' : 'var(--ym-accent)',
                fontSize: '14px',
                fontWeight: '500',
                cursor: (loading || cooldown > 0 || sent) ? 'not-allowed' : 'pointer',
                opacity: (loading || cooldown > 0) ? 0.6 : 1,
              }}
            >
              {cooldown > 0 ? `${cooldown}s` : sent ? '已发送' : '获取验证码'}
            </button>
          </div>
        </div>

        {/* 验证码 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="fp-code" style={labelStyle}>验证码</label>
          <input
            id="fp-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="6 位数字验证码"
            required
            disabled={tab === 'phone'}
            style={{ ...inputStyle, ...focusHandlers }}
          />
        </div>

        {/* 新密码 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="fp-password" style={labelStyle}>新密码（至少 6 位）</label>
          <input
            id="fp-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={tab === 'phone'}
            style={{ ...inputStyle, ...focusHandlers }}
          />
        </div>

        {/* 确认密码 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="fp-confirm" style={labelStyle}>确认新密码</label>
          <input
            id="fp-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            disabled={tab === 'phone'}
            style={{ ...inputStyle, ...focusHandlers }}
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
        {info && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '16px',
            backgroundColor: 'var(--ym-success-bg)',
            color: 'var(--ym-success)',
            borderRadius: 'var(--ym-radius-sm)',
            borderLeft: '4px solid var(--ym-success)',
            fontSize: '14px',
            animation: 'ym-fade-in var(--ym-transition) forwards',
          }}>
            {info}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || tab === 'phone'}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: 'var(--ym-accent)',
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
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = 'var(--ym-accent-hover)'; }}
          onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = 'var(--ym-accent)'; }}
        >
          {loading ? (
            <>
              <span className="ym-spin" style={{
                display: 'inline-block', width: '16px', height: '16px',
                border: '2px solid var(--ym-accent-text-on)', borderTopColor: 'transparent',
                borderRadius: '50%',
              }} />
              处理中...
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
        想起来了？{' '}
        <span
          onClick={back}
          style={{
            color: 'var(--ym-accent)', fontWeight: '500', cursor: 'pointer',
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
