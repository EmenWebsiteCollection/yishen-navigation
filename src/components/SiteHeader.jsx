// 全站统一顶栏：Logo + 导航 + 搜索 + 主题 + 登录/投稿/头像菜单。
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo.jsx';
import { SearchBar } from './SearchBar.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { logout } from '../services/auth.js';
import { getProfile } from '../services/users.js';

const NAV_LINKS = [
  { to: '/', label: '首页' },
  { to: '/about', label: '关于' },
  { to: '/changelog', label: '更新记录' },
  { to: '/contact', label: '联系我们' },
];

const ThemeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.55 0 1-.45 1-1 0-.27-.11-.51-.29-.69-.18-.18-.29-.42-.29-.69 0-.55.45-1 1-1h2.83c2.09 0 3.75-1.66 3.75-3.75C20 6.58 16.42 2 12 2zm-5 11c-.83 0-1.5-.67-1.5-1.5S6.17 10 7 10s1.5.67 1.5 1.5S7.83 13 7 13zm3-4C9.67 9 9 8.33 9 7.5S9.67 6 10 6s1.5.67 1.5 1.5S10.33 9 10 9zm4 0c-.83 0-1.5-.67-1.5-1.5S13.17 6 14 6s1.5.67 1.5 1.5S14.83 9 14 9zm3 4c-.83 0-1.5-.67-1.5-1.5S16.17 10 17 10s1.5.67 1.5 1.5S17.83 13 17 13z" />
  </svg>
);

export function SiteHeader({ onLogin, onRegister }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, isAnonymous } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const menuRef = useRef(null);

  const isLoggedIn = Boolean(user && !isAnonymous);

  const loadAvatar = React.useCallback(async () => {
    if (!isLoggedIn || !user) {
      setAvatarUrl('');
      return;
    }
    try {
      const profile = await getProfile(user.id);
      setAvatarUrl(profile?.avatar_url || '');
    } catch (err) {
      console.warn('加载头像失败:', err);
      setAvatarUrl('');
    }
  }, [isLoggedIn, user]);

  useEffect(() => {
    loadAvatar();
    const onProfileUpdated = () => loadAvatar();
    window.addEventListener('ym-profile-updated', onProfileUpdated);
    return () => window.removeEventListener('ym-profile-updated', onProfileUpdated);
  }, [loadAvatar]);

  useEffect(() => {
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const openTheme = () => {
    window.dispatchEvent(new CustomEvent('ym-open-theme'));
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('退出失败:', err.message);
    }
  };

  const displayName = user?.email?.replace('@nav.local', '') || user?.email || '';

  return (
    <header className="ym-site-header">
      <div className="ym-header-inner">
        <div className="ym-header-left">
          <Link to="/" style={{ textDecoration: 'none', display: 'flex' }}>
            <Logo />
          </Link>
          <nav className="ym-header-links" aria-label="主导航">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={'ym-header-link' + (pathname === link.to ? ' active' : '')}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="ym-header-center">
          <SearchBar />
        </div>

        <div className="ym-header-actions">
          <button type="button" className="ym-btn ym-btn-ghost ym-btn-sm" onClick={openTheme} title="切换主题" aria-label="切换主题">
            <ThemeIcon />
            主题
          </button>

          {isLoggedIn && (
            <Link to="/create" className="ym-btn ym-btn-primary ym-btn-sm">
              投稿
            </Link>
          )}

          {isLoggedIn ? (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 8px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderRadius: 'var(--ym-radius-sm)',
                  color: 'var(--ym-text-secondary)',
                }}
              >
                {avatarUrl ? (
                  <img
                    className="ym-avatar ym-avatar-md"
                    src={avatarUrl}
                    alt="头像"
                  />
                ) : (
                  <span className="ym-avatar-fallback ym-avatar-md" style={{ fontSize: '16px' }}>👤</span>
                )}
                <span style={{ fontSize: '14px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </span>
              </button>

              {menuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 6px)',
                    width: '150px',
                    backgroundColor: 'var(--ym-bg-card)',
                    border: '1px solid var(--ym-border)',
                    borderRadius: 'var(--ym-radius-md)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    padding: '6px',
                    zIndex: 120,
                  }}
                >
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    style={{ display: 'block', padding: '8px 12px', fontSize: '14px', color: 'var(--ym-text-secondary)', borderRadius: 'var(--ym-radius-sm)', textDecoration: 'none' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--ym-bg-subtle)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    个人中心
                  </Link>
                  <Link
                    to="/profile?tab=settings"
                    onClick={() => setMenuOpen(false)}
                    style={{ display: 'block', padding: '8px 12px', fontSize: '14px', color: 'var(--ym-text-secondary)', borderRadius: 'var(--ym-radius-sm)', textDecoration: 'none' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--ym-bg-subtle)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    更换头像
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '14px', color: 'var(--ym-danger)', borderRadius: 'var(--ym-radius-sm)', border: 'none', background: 'none', cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--ym-danger-bg)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    退出
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" className="ym-btn ym-btn-primary ym-btn-sm" onClick={onLogin}>
              登录
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
