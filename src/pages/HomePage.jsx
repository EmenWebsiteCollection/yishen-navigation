// src/pages/HomePage.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getWorks, likeWork, unlikeWork } from '../services/works.js';
import { logout } from '../services/auth.js';
import { supabase } from '../services/supabase.js';
import { LoginPage } from './LoginPage.jsx';
import { RegisterPage } from './RegisterPage.jsx';
import { HighRatedCarousel } from '../components/HighRatedCarousel.jsx';
import { SearchBar } from '../components/SearchBar.jsx';
import { SiteHeader } from '../components/SiteHeader.jsx';
import { getProfile } from '../services/users.js';
import '../styles/global.css';

const PAGE_SIZE = 10;

const SkeletonCard = () => (
  <div style={{
    border: '1px solid var(--ym-border)',
    borderRadius: 'var(--ym-radius-md)',
    backgroundColor: 'var(--ym-bg-card)',
    overflow: 'hidden',
    animation: 'ym-skeleton-pulse 1.2s ease-in-out infinite',
  }}>
    <div style={{ aspectRatio: '16/9', backgroundColor: 'var(--ym-bg-subtle)' }} />
    <div style={{ padding: '14px 16px' }}>
      <div style={{ height: '18px', width: '70%', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '4px', marginBottom: '8px' }} />
      <div style={{ height: '13px', width: '50%', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '4px' }} />
    </div>
  </div>
);

export function HomePage() {
  const { user, loading: authLoading, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);

  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (user && !isAnonymous) {
      getProfile(user.id)
        .then((p) => {
          if (!cancelled) setAvatarUrl(p?.avatar_url || null);
        })
        .catch(() => {
          if (!cancelled) setAvatarUrl(null);
        });
    } else {
      setAvatarUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [user, isAnonymous]);

  const likedRefs = useRef({});
  const likingRefs = useRef({});

  const loadWebsites = async (page) => {
    try {
      setLoading(true);
      setError(null);
      const { works: data, total } = await getWorks({ page, pageSize: PAGE_SIZE });
      setTotalItems(total);
      setTotalPages(Math.ceil(total / PAGE_SIZE) || 1);

      if (user) {
        try {
          const { data: likes, error: likeError } = await supabase
            .from('website_likes')
            .select('website_id')
            .eq('user_id', user.id);
          if (!likeError && likes) {
            const likedIds = new Set(likes.map(l => l.website_id));
            data.forEach(site => {
              site.liked_by_user = likedIds.has(site.id);
              likedRefs.current[site.id] = likedIds.has(site.id);
              likingRefs.current[site.id] = false;
            });
          }
        } catch (likeErr) {
          console.warn('获取点赞状态失败:', likeErr);
        }
      } else {
        data.forEach(site => {
          likedRefs.current[site.id] = false;
          likingRefs.current[site.id] = false;
        });
      }
      setWebsites(data);
    } catch (err) {
      setError('加载网站列表失败，请稍后重试。');
      console.error('加载网站列表错误:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const page = parseInt(searchParams.get('page') || '1', 10);
    if (page > 0) {
      loadWebsites(page);
    }
  }, [searchParams, user]);

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

  const handleLikeToggle = async (websiteId, currentLiked) => {
    if (!user) return;
    if (likingRefs.current[websiteId]) return;

    const newLiked = !currentLiked;
    setWebsites(prev =>
      prev.map(site =>
        site.id === websiteId
          ? {
              ...site,
              like_count: newLiked ? site.like_count + 1 : site.like_count - 1,
              liked_by_user: newLiked,
            }
          : site
      )
    );
    likedRefs.current[websiteId] = newLiked;
    likingRefs.current[websiteId] = true;

    try {
      if (newLiked) {
        await likeWork(websiteId, user.id);
      } else {
        await unlikeWork(websiteId, user.id);
      }
    } catch (err) {
      console.error('点赞操作失败:', err);
      setWebsites(prev =>
        prev.map(site =>
          site.id === websiteId
            ? {
                ...site,
                like_count: currentLiked ? site.like_count + 1 : site.like_count - 1,
                liked_by_user: currentLiked,
              }
            : site
        )
      );
      likedRefs.current[websiteId] = currentLiked;
    } finally {
      likingRefs.current[websiteId] = false;
      setWebsites(prev => [...prev]); // 强制重渲染，让按钮从禁用状态恢复
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage === currentPage || newPage < 1 || newPage > totalPages) return;
    setSearchParams({ page: newPage });
    window.scrollTo(0, 0);
  };

  const getPaginationRange = () => {
    const current = currentPage;
    const total = totalPages;
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    let l;
    range.forEach((i) => {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  if (authLoading) {
    return <div style={{ textAlign: 'center', marginTop: '200px', color: 'var(--ym-text-secondary)' }}>加载中...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--ym-bg-page)' }}>
      <SiteHeader
        center={<SearchBar />}
        right={
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {user ? (
            <>
              <span style={{ fontSize: '14px', color: 'var(--ym-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="头像"
                    style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--ym-bg-subtle)',
                      fontSize: '15px',
                      flexShrink: 0,
                    }}
                  >
                    👤
                  </span>
                )}
                {user.email?.replace('@nav.local', '') || user.email}
                {!isAnonymous && (
                  <Link
                    to='/profile'
                    style={{
                      padding: '6px 16px',
                      backgroundColor: 'transparent',
                      color: 'var(--ym-text-secondary)',
                      border: '1px solid var(--ym-border)',
                      borderRadius: 'var(--ym-radius-sm)',
                      fontSize: '14px',
                      textDecoration: 'none',
                      transition: 'all var(--ym-transition)',
                    }}
                  >
                    个人中心
                  </Link>
                )}
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
        }
      />

      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px 40px' }}>
        <HighRatedCarousel />

        {/* Issue #39 P1：发现入口横幅（不改变原首页网站导航逻辑） */}
        <Link
          to="/discover"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            textDecoration: 'none',
            padding: '16px 20px',
            marginBottom: '20px',
            backgroundColor: 'var(--ym-bg-card)',
            border: '1px solid var(--ym-border)',
            borderRadius: 'var(--ym-radius-md)',
            transition: 'border-color var(--ym-transition), box-shadow var(--ym-transition)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--ym-accent)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--ym-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div>
            <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '4px' }}>
              ✨ 作品发现
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ym-text-secondary)' }}>
              本周新锐 · 编辑精选 · 小众宝藏 · 零评论作品 · 每日随机……不只按点赞数推荐
            </div>
          </div>
          <span style={{ color: 'var(--ym-accent)', fontSize: '14px', whiteSpace: 'nowrap' }}>去看看 →</span>
        </Link>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonCard key={i} />)}
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
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {websites.map((site, index) => (
                <div
                  key={site.id}
                  onClick={() => navigate(`/website/${site.id}`)}
                  style={{
                    border: '1px solid var(--ym-border)',
                    borderRadius: 'var(--ym-radius-md)',
                    backgroundColor: 'var(--ym-bg-card)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform var(--ym-transition), border-color var(--ym-transition), box-shadow var(--ym-transition)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.borderColor = 'var(--ym-border-strong)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'var(--ym-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    position: 'relative',
                    aspectRatio: '16/9',
                    backgroundColor: 'var(--ym-bg-subtle)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, var(--ym-bg-subtle), var(--ym-border))',
                    }}>
                      <span style={{
                        fontFamily: 'var(--ym-font-display)',
                        fontSize: '44px',
                        color: 'var(--ym-text-muted)',
                        lineHeight: 1,
                      }}>
                        {(site.title || '网').trim()[0]}
                      </span>
                    </div>
                    {site.image_url && (
                      <img
                        src={site.image_url}
                        alt={site.title}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    )}
                    <span style={{
                      position: 'absolute',
                      left: '10px',
                      top: '10px',
                      fontFamily: 'var(--ym-font-display)',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: 'var(--ym-bg-card)',
                      backgroundColor: 'rgba(0,0,0,0.45)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      letterSpacing: '0.5px',
                      lineHeight: 1.6,
                    }}>
                      {String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(2, '0')}
                    </span>
                  </div>

                  <div style={{
                    padding: '14px 16px',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '500',
                      color: 'var(--ym-text-primary)',
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
                    <div
                      title={site.url}
                      style={{
                        fontSize: '13px',
                        color: 'var(--ym-text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      📎 {site.url}
                    </div>
                    <div style={{
                      marginTop: 'auto',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--ym-border)',
                    }}>
                      <Link
                        to={`/user/${site.user_id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: '13px', color: 'var(--ym-text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        {site.avatar_url ? (
                          <img src={site.avatar_url} alt='' loading="lazy" decoding="async" style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ display: 'inline-block', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'var(--ym-bg-subtle)', textAlign: 'center', lineHeight: '18px', fontSize: '11px' }}>👤</span>
                        )}
                        {site.username}
                      </Link>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--ym-text-muted)' }}>
                          ❤️ {site.like_count || 0}
                        </span>
                        {user && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLikeToggle(site.id, site.liked_by_user || false);
                            }}
                            disabled={likingRefs.current[site.id] || false}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: site.liked_by_user ? 'var(--ym-success)' : 'var(--ym-text-secondary)',
                              cursor: likingRefs.current[site.id] ? 'not-allowed' : 'pointer',
                              fontSize: '13px',
                              fontWeight: site.liked_by_user ? 'bold' : 'normal',
                              transition: 'color var(--ym-transition)',
                              opacity: likingRefs.current[site.id] ? 0.5 : 1,
                            }}
                          >
                            {site.liked_by_user ? '♥ 已赞' : '♡ 点赞'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '6px',
                marginTop: '32px',
                flexWrap: 'wrap',
              }}>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid var(--ym-border)',
                    borderRadius: 'var(--ym-radius-sm)',
                    backgroundColor: 'var(--ym-bg-card)',
                    color: currentPage === 1 ? 'var(--ym-text-muted)' : 'var(--ym-text-secondary)',
                    fontSize: '14px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all var(--ym-transition)',
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.borderColor = 'var(--ym-border-strong)';
                      e.currentTarget.style.color = 'var(--ym-text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.borderColor = 'var(--ym-border)';
                      e.currentTarget.style.color = 'var(--ym-text-secondary)';
                    }
                  }}
                >
                  上一页
                </button>

                {getPaginationRange().map((item, idx) => {
                  if (item === '...') {
                    return <span key={`dots-${idx}`} style={{ padding: '0 4px', color: 'var(--ym-text-muted)' }}>…</span>;
                  }
                  const pageNum = item;
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      disabled={isActive}
                      style={{
                        padding: '6px 12px',
                        minWidth: '36px',
                        border: isActive ? '1px solid var(--ym-accent)' : '1px solid var(--ym-border)',
                        borderRadius: 'var(--ym-radius-sm)',
                        backgroundColor: isActive ? 'var(--ym-accent)' : 'var(--ym-bg-card)',
                        color: isActive ? 'var(--ym-accent-text-on)' : 'var(--ym-text-secondary)',
                        fontSize: '14px',
                        fontWeight: isActive ? '500' : 'normal',
                        cursor: isActive ? 'default' : 'pointer',
                        transition: 'all var(--ym-transition)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.borderColor = 'var(--ym-border-strong)';
                          e.currentTarget.style.color = 'var(--ym-text-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.borderColor = 'var(--ym-border)';
                          e.currentTarget.style.color = 'var(--ym-text-secondary)';
                        }
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid var(--ym-border)',
                    borderRadius: 'var(--ym-radius-sm)',
                    backgroundColor: 'var(--ym-bg-card)',
                    color: currentPage === totalPages ? 'var(--ym-text-muted)' : 'var(--ym-text-secondary)',
                    fontSize: '14px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all var(--ym-transition)',
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.borderColor = 'var(--ym-border-strong)';
                      e.currentTarget.style.color = 'var(--ym-text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.borderColor = 'var(--ym-border)';
                      e.currentTarget.style.color = 'var(--ym-text-secondary)';
                    }
                  }}
                >
                  下一页
                </button>
              </div>
            )}

            <div style={{
              textAlign: 'center',
              marginTop: '16px',
              fontSize: '13px',
              color: 'var(--ym-text-muted)',
            }}>
              共 {totalItems} 个网站，第 {currentPage}/{totalPages} 页
            </div>
          </>
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