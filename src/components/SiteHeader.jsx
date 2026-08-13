import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo.jsx';
import { SearchBar } from './SearchBar.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { logout } from '../services/auth.js';
import { getProfile } from '../services/users.js';

const NAV_LINKS = [
  { to: '/', label: '首页' },
  { to: '/ideas', label: '灵感' },
  { to: '/discover', label: '发现' },
  { to: '/about', label: '关于' },
  { to: '/changelog', label: '更新记录' },
  { to: '/contact', label: '联系我们' },
];

const isActivePath = (pathname, to) => (
  to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)
);

export function SiteHeader({ onLogin }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, isAnonymous } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [indicator, setIndicator] = useState({ x: 0, width: 0, visible: false });
  const scrolledRef = useRef(false);
  const profileRef = useRef(null);
  const navRef = useRef(null);
  const linkRefs = useRef(new Map());
  const isLoggedIn = Boolean(user && !isAnonymous);

  const loadAvatar = useCallback(async () => {
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
    window.addEventListener('ym-profile-updated', loadAvatar);
    return () => window.removeEventListener('ym-profile-updated', loadAvatar);
  }, [loadAvatar]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
    };
    const onScroll = () => {
      const nextScrolled = window.scrollY > 16;
      if (nextScrolled === scrolledRef.current) return;
      scrolledRef.current = nextScrolled;
      setScrolled(nextScrolled);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  const measureIndicator = useCallback(() => {
    const activeLink = NAV_LINKS.find((link) => isActivePath(pathname, link.to));
    const nav = navRef.current;
    const element = activeLink ? linkRefs.current.get(activeLink.to) : null;
    if (!nav || !element) {
      setIndicator((current) => ({ ...current, visible: false }));
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const linkRect = element.getBoundingClientRect();
    setIndicator({ x: linkRect.left - navRect.left, width: linkRect.width, visible: true });
  }, [pathname]);

  useLayoutEffect(() => {
    measureIndicator();
    window.addEventListener('resize', measureIndicator);
    return () => window.removeEventListener('resize', measureIndicator);
  }, [measureIndicator]);

  const openTheme = () => window.dispatchEvent(new CustomEvent('ym-open-theme'));
  const handleLogout = async () => {
    setProfileOpen(false);
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('退出失败:', err.message);
    }
  };

  const displayName = user?.email?.replace('@nav.local', '') || user?.email || '';
  const openLogin = () => {
    setMobileMenuOpen(false);
    onLogin?.();
  };

  return (
    <header className={`ym-site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="ym-header-inner">
        <div className="ym-header-left">
          <Link to="/" className="ym-brand-link" aria-label="依神网站汇总首页"><Logo /></Link>
          <nav ref={navRef} className="ym-header-links" aria-label="主导航">
            <span
              className={`ym-nav-indicator${indicator.visible ? ' is-visible' : ''}`}
              style={{ width: `${indicator.width}px`, transform: `translateX(${indicator.x}px)` }}
              aria-hidden="true"
            />
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                ref={(node) => {
                  if (node) linkRefs.current.set(link.to, node);
                  else linkRefs.current.delete(link.to);
                }}
                to={link.to}
                className={`ym-header-link${isActivePath(pathname, link.to) ? ' active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="ym-header-center"><SearchBar /></div>

        <div className="ym-header-actions ym-desktop-actions">
          <button type="button" className="ym-btn ym-btn-sm" onClick={openTheme}>主题</button>
          {isLoggedIn && <Link to="/create" className="ym-btn ym-btn-primary ym-btn-sm">投稿</Link>}
          {isLoggedIn ? (
            <div ref={profileRef} style={{ position: 'relative' }}>
              <button type="button" className="ym-profile-trigger" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen}>
                {avatarUrl ? <img className="ym-avatar ym-avatar-md" src={avatarUrl} alt="头像" /> : <span className="ym-avatar-fallback ym-avatar-md">神</span>}
                <span className="ym-profile-name">{displayName}</span>
              </button>
              {profileOpen && (
                <div className="ym-profile-menu">
                  <Link to="/profile">个人中心</Link>
                  <Link to="/profile?tab=settings">编辑主页</Link>
                  <button type="button" className="ym-profile-danger" onClick={handleLogout}>退出</button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" className="ym-btn ym-btn-primary ym-btn-sm" onClick={openLogin}>登录</button>
          )}
        </div>

        <div className="ym-mobile-actions">
          {isLoggedIn ? <Link to="/create" className="ym-btn ym-btn-primary ym-btn-sm">投稿</Link> : <button type="button" className="ym-btn ym-btn-primary ym-btn-sm" onClick={openLogin}>登录</button>}
          <button
            type="button"
            className="ym-btn ym-mobile-icon-button"
            onClick={() => { setMobileSearchOpen((open) => !open); setMobileMenuOpen(false); }}
            aria-expanded={mobileSearchOpen}
          >搜索</button>
          <button
            type="button"
            className="ym-btn ym-mobile-icon-button"
            onClick={() => { setMobileMenuOpen((open) => !open); setMobileSearchOpen(false); }}
            aria-expanded={mobileMenuOpen}
          >菜单</button>
        </div>
      </div>

      <div className={`ym-mobile-search-panel${mobileSearchOpen ? ' is-open' : ''}`}><SearchBar /></div>
      <div className={`ym-mobile-drawer${mobileMenuOpen ? ' is-open' : ''}`}>
        <nav className="ym-mobile-nav" aria-label="移动端主导航">
          {NAV_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className={`ym-mobile-nav-link${isActivePath(pathname, link.to) ? ' active' : ''}`}>{link.label}</Link>
          ))}
        </nav>
        <div className="ym-mobile-drawer-footer">
          <button type="button" className="ym-btn" onClick={openTheme}>切换主题</button>
          {isLoggedIn ? (
            <>
              <Link to="/profile" className="ym-btn">个人中心</Link>
              <button type="button" className="ym-btn" onClick={handleLogout}>退出登录</button>
            </>
          ) : <button type="button" className="ym-btn ym-btn-primary" onClick={openLogin}>登录账号</button>}
        </div>
      </div>
    </header>
  );
}
