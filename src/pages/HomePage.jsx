// src/pages/HomePage.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getWebsites } from '../services/websites.js';
import { logout } from '../services/auth.js';
import { LoginPage } from './LoginPage.jsx';
import { RegisterPage } from './RegisterPage.jsx';
import '../styles/global.css';

// Logo 组件（纯展示）
const Logo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <div style={{
      width: '34px',
      height: '34px',
      borderRadius: '8px',
      backgroundColor: 'var(--ym-accent)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: 'var(--ym-font-display)',
        fontSize: '18px',
        color: 'var(--ym-accent-text-on)',
        fontWeight: '500',
        lineHeight: 1,
      }}>神</span>
    </div>
    <span style={{
      fontFamily: 'var(--ym-font-display)',
      fontSize: '17px',
      fontWeight: '500',
      color: 'var(--ym-text-primary)',
      letterSpacing: '0.5px',
    }}>依神网站汇总</span>
  </div>
);

// Skeleton Card（纯展示）
const SkeletonCard = () => (
  <div style={{
    padding: '16px 20px',
    border: '1px solid var(--ym-border)',
    borderRadius: 'var(--ym-radius-md)',
    backgroundColor: 'var(--ym-bg-card)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    animation: 'ym-skeleton-pulse 1.2s ease-in-out infinite',
  }}>
    <div style={{ flex: 1, minWidth: '200px' }}>
      <div style={{ height: '20px', width: '60%', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '4px', marginBottom: '8px' }} />
      <div style={{ height: '14px', width: '40%', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '4px' }} />
    </div>
    <div style={{ height: '14px', width: '80px', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '4px' }} />
  </div>
);

export function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);

  useEffect(() => {
    const loadWebsites = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getWebsites();
        setWebsites(data);
      } catch (err) {
        setError('加载网站列表失败，请稍后重试。');
        console.error('加载网站列表错误:', err);
      } finally {
        setLoading(false);
      }
    };
    loadWebsites();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('退出失败:', err.message);
    }
  };

  const handleLoginSuccess = () => {
    setModalClosing(true);
    setTimeout(() => {
      setShowLoginModal(false);
      setModalClosing(false);
    }, 180);
  };

  const handleRegisterSuccess = () => {
    setModalClosing(true);
    setTimeout(() => {
      setShowRegisterModal(false);
      setModalClosing(false);
    }, 180);
  };

  const closeLoginModal = () => {
    setModalClosing(true);
    setTimeout(() => {
      setShowLoginModal(false);
      setModalClosing(false);
    }, 180);
  };

  const closeRegisterModal = () => {
    setModalClosing(true);
    setTimeout(() => {
      setShowRegisterModal(false);
      setModalClosing(false);
    }, 180);
  };

  if (authLoading) {
    return <div style={{ textAlign: 'center', marginTop: '200px', color: 'var(--ym-text-secondary)' }}>加载中...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--ym-bg-page)' }}>
      {/* Navbar */}
      <nav style={{
        padding: '16px 24px',
        backgroundColor: 'var(--ym-bg-card)',
        borderBottom: '1px solid var(--ym-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Logo />
        </Link>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {user ? (
            <>
              <span style={{ fontSize: '14px', color: 'var(--ym-text-secondary)' }}>
                👤 {user.email?.replace('@nav.local', '') || user.email}
              </span>
              <Link
                to="/create"
                style={{
                  padding: '6px 16px',
                  backgroundColor: 'var(--ym-accent)',
                  color: 'var(--ym-accent-text-on)',
                  borderRadius: 'var(--ym-radius-sm)',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background-color var(--ym-transition)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--ym-accent-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--ym-accent)'}
              >
                提交网站
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  padding: '6px 16px',
                  backgroundColor: 'transparent',
                  color: 'var(--ym-text-secondary)',
                  border: '1px solid var(--ym-border)',
                  borderRadius: 'var(--ym-radius-sm)',
                  fontSize: '14px',
                  transition: 'all var(--ym-transition)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ym-text-secondary)';
                  e.currentTarget.style.color = 'var(--ym-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ym-border)';
                  e.currentTarget.style.color = 'var(--ym-text-secondary)';
                }}
              >
                退出
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowLoginModal(true)}
                style={{
                  padding: '6px 20px',
                  backgroundColor: 'var(--ym-accent)',
                  color: 'var(--ym-accent-text-on)',
                  border: 'none',
                  borderRadius: 'var(--ym-radius-sm)',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background-color var(--ym-transition)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--ym-accent-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--ym-accent)'}
              >
                登录
              </button>
              <button
                onClick={() => setShowRegisterModal(true)}
                style={{
                  padding: '6px 20px',
                  backgroundColor: 'transparent',
                  color: 'var(--ym-text-secondary)',
                  border: '1px solid var(--ym-border)',
                  borderRadius: 'var(--ym-radius-sm)',
                  fontSize: '14px',
                  transition: 'all var(--ym-transition)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ym-text-secondary)';
                  e.currentTarget.style.color = 'var(--ym-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ym-border)';
                  e.currentTarget.style.color = 'var(--ym-text-secondary)';
                }}
              >
                注册
              </button>
            </>
          )}
        </div>
      </nav>

      {/* 网站列表 */}
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px 40px' }}>
        {loading ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div style={{
            padding: '16px',
            backgroundColor: 'var(--ym-danger-bg)',
            color: 'var(--ym-danger)',
            borderRadius: 'var(--ym-radius-sm)',
            borderLeft: '4px solid var(--ym-danger)',
          }}>
            {error}
          </div>
        ) : websites.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: 'var(--ym-bg-card)',
            borderRadius: 'var(--ym-radius-lg)',
            border: '1px solid var(--ym-border)',
          }}>
            <div style={{
              fontFamily: 'var(--ym-font-display)',
              fontSize: '20px',
              color: 'var(--ym-text-primary)',
              marginBottom: '8px',
            }}>这里还没有网站</div>
            <div style={{ color: 'var(--ym-text-secondary)', fontSize: '14px' }}>
              点击右上角提交第一个网站
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {websites.map((site, index) => (
              <div
                key={site.id}
                onClick={() => navigate(`/website/${site.id}`)}
                style={{
                  position: 'relative',
                  padding: '16px 20px',
                  border: '1px solid var(--ym-border)',
                  borderRadius: 'var(--ym-radius-md)',
                  backgroundColor: 'var(--ym-bg-card)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'transform var(--ym-transition), border-color var(--ym-transition)',
                  paddingLeft: 'calc(20px + 12px)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(4px)';
                  e.currentTarget.style.borderColor = 'var(--ym-border-strong)';
                  const line = e.currentTarget.querySelector('.card-line');
                  if (line) line.style.transform = 'scaleY(1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.borderColor = 'var(--ym-border)';
                  const line = e.currentTarget.querySelector('.card-line');
                  if (line) line.style.transform = 'scaleY(0)';
                }}
              >
                {/* 左侧竖线（装饰） */}
                <div className="card-line" style={{
                  position: 'absolute',
                  left: '0',
                  top: '6px',
                  width: '3px',
                  height: 'calc(100% - 12px)',
                  backgroundColor: 'var(--ym-border-strong)',
                  borderRadius: '2px',
                  transform: 'scaleY(0)',
                  transformOrigin: 'center',
                  transition: 'transform var(--ym-transition)',
                }} />
                {/* 编号（两位数字） */}
                <div style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontFamily: 'var(--ym-font-display)',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'var(--ym-text-muted)',
                  letterSpacing: '0.5px',
                  lineHeight: 1,
                }}>
                  {String(index + 1).padStart(2, '0')}
                </div>

                <div style={{ flex: 1, minWidth: '200px', paddingLeft: '4px' }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '500',
                    color: 'var(--ym-text-primary)',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}>
                    {site.title}
                    <span style={{
                      fontSize: '12px',
                      color: 'var(--ym-text-muted)',
                      fontWeight: '400',
                    }}>↗</span>
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--ym-text-secondary)',
                    display: 'flex',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}>
                    <span>📎 {site.url}</span>
                    <span>👤 {site.username}</span>
                  </div>
                </div>
                <div style={{
                  fontSize: '13px',
                  color: 'var(--ym-text-muted)',
                  whiteSpace: 'nowrap',
                }}>
                  {site.created_at ? new Date(site.created_at).toLocaleDateString('zh-CN') : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 登录 Modal */}
      {showLoginModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            animation: 'ym-fade-in var(--ym-transition) forwards',
          }}
          onClick={closeLoginModal}
        >
          <div
            className={modalClosing ? 'ym-scale-out' : 'ym-scale-in'}
            style={{
              backgroundColor: 'var(--ym-bg-card)',
              padding: '24px',
              borderRadius: 'var(--ym-radius-lg)',
              maxWidth: '420px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <LoginPage
              onSuccess={handleLoginSuccess}
              onSwitchToRegister={() => {
                setShowLoginModal(false);
                setShowRegisterModal(true);
              }}
            />
            <div style={{ textAlign: 'right', marginTop: '16px' }}>
              <button
                onClick={closeLoginModal}
                style={{
                  padding: '6px 16px',
                  backgroundColor: 'transparent',
                  color: 'var(--ym-text-secondary)',
                  border: '1px solid var(--ym-border)',
                  borderRadius: 'var(--ym-radius-sm)',
                  fontSize: '14px',
                  transition: 'all var(--ym-transition)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ym-text-secondary)';
                  e.currentTarget.style.color = 'var(--ym-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ym-border)';
                  e.currentTarget.style.color = 'var(--ym-text-secondary)';
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 注册 Modal */}
      {showRegisterModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            animation: 'ym-fade-in var(--ym-transition) forwards',
          }}
          onClick={closeRegisterModal}
        >
          <div
            className={modalClosing ? 'ym-scale-out' : 'ym-scale-in'}
            style={{
              backgroundColor: 'var(--ym-bg-card)',
              padding: '24px',
              borderRadius: 'var(--ym-radius-lg)',
              maxWidth: '420px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <RegisterPage onSuccess={handleRegisterSuccess} />
            <div style={{ textAlign: 'right', marginTop: '16px' }}>
              <button
                onClick={closeRegisterModal}
                style={{
                  padding: '6px 16px',
                  backgroundColor: 'transparent',
                  color: 'var(--ym-text-secondary)',
                  border: '1px solid var(--ym-border)',
                  borderRadius: 'var(--ym-radius-sm)',
                  fontSize: '14px',
                  transition: 'all var(--ym-transition)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ym-text-secondary)';
                  e.currentTarget.style.color = 'var(--ym-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ym-border)';
                  e.currentTarget.style.color = 'var(--ym-text-secondary)';
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}