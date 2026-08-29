// src/pages/FollowListPage.jsx
// Issue #161：粉丝列表 / 关注列表页面
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getProfile } from '../services/users.js';
import { getFollowers, getFollowing, toggleFollow, getFollowerCount, getFollowingCount } from '../services/follows.js';
import '../styles/global.css';

const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"%3E%3Crect width="128" height="128" fill="%23EDE3CC"/%3E%3Ctext x="64" y="78" font-family="Arial" font-size="44" fill="%239C6B2E" text-anchor="middle"%3E?%3C/text%3E%3C/svg%3E';

const PAGE_SIZE = 20;

const UserCard = ({ user, currentUserId, onFollowChange }) => {
  const [isFollowing, setIsFollowing] = useState(user.isFollowing);
  const [toggling, setToggling] = useState(false);

  const handleFollow = async () => {
    if (!currentUserId || currentUserId === user.id) return;
    setToggling(true);
    try {
      const res = await toggleFollow(currentUserId, user.id);
      setIsFollowing(res.following);
      onFollowChange?.(user.id, res.following);
    } catch (err) {
      console.error('关注操作失败:', err);
      alert(err.message || '操作失败，请稍后重试');
    } finally {
      setToggling(false);
    }
  };

  const isSelf = currentUserId === user.id;

  return (
    <div style={{
      display: 'flex',
      gap: '14px',
      padding: '14px 16px',
      backgroundColor: 'var(--ym-bg-card)',
      borderRadius: 'var(--ym-radius-md)',
      border: '1px solid var(--ym-border)',
      marginBottom: '10px',
      alignItems: 'center',
      flexWrap: 'wrap',
    }}>
      <Link to={`/user/${user.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '200px' }}>
        <img
          src={user.avatar_url || DEFAULT_AVATAR}
          alt={user.username}
          decoding="async"
          onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
          style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--ym-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.username}
          </div>
          {user.bio && (
            <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>
              {user.bio}
            </div>
          )}
        </div>
      </Link>
      {!isSelf && (
        <button
          onClick={handleFollow}
          disabled={toggling}
          style={{
            padding: '6px 16px',
            borderRadius: 'var(--ym-radius-sm)',
            border: isFollowing ? 'none' : '1px solid var(--ym-border)',
            backgroundColor: isFollowing ? 'var(--ym-bg-subtle)' : 'var(--ym-accent)',
            color: isFollowing ? 'var(--ym-text-secondary)' : 'var(--ym-accent-text-on)',
            fontSize: '13px',
            fontWeight: '500',
            cursor: toggling ? 'not-allowed' : 'pointer',
            opacity: toggling ? 0.6 : 1,
            transition: 'all var(--ym-transition)',
            whiteSpace: 'nowrap',
          }}
        >
          {toggling ? '处理中...' : isFollowing ? '已关注' : '关注'}
        </button>
      )}
    </div>
  );
};

function FollowListPage() {
  const { id } = useParams();
  const location = useLocation();
  const { user: currentUser } = useAuth();

  // 从路径判断模式：/user/:id/followers -> 'followers', /user/:id/following -> 'following'
  const isFollowersMode = location.pathname.endsWith('/followers');
  const mode = isFollowersMode ? 'followers' : 'following';

  const [targetProfile, setTargetProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ followerCount: 0, followingCount: 0 });

  const currentUserId = currentUser?.id;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [profileRes, statsRes, listRes] = await Promise.all([
        getProfile(id),
        Promise.all([
          getFollowerCount(id),
          getFollowingCount(id),
        ]),
        (isFollowersMode ? getFollowers : getFollowing)(id, {
          page,
          pageSize: PAGE_SIZE,
          currentUserId,
        }),
      ]);

      if (!profileRes) {
        setError('用户不存在');
        return;
      }

      setTargetProfile(profileRes);
      setStats({ followerCount: statsRes[0], followingCount: statsRes[1] });
      setUsers(listRes.users);
      setTotal(listRes.total);
      setTotalPages(Math.ceil(listRes.total / PAGE_SIZE) || 1);
    } catch (err) {
      console.error('加载列表失败:', err);
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [id, page, isFollowersMode, currentUserId]);

  useEffect(() => { load(); }, [load]);

  if (error || (!loading && !targetProfile)) {
    return (
      <div style={{ maxWidth: '560px', margin: '60px auto', padding: '32px 28px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-lg)', border: '1px solid var(--ym-border)', textAlign: 'center' }}>
        <p style={{ color: 'var(--ym-danger)' }}>{error || '用户不存在'}</p>
        <Link to="/" style={{ color: 'var(--ym-accent)', fontSize: '14px', marginTop: '12px', display: 'inline-block', textDecoration: 'none' }}>返回首页</Link>
      </div>
    );
  }

  if (!targetProfile) return <div />;

  const username = targetProfile.username || '未命名用户';
  const modeLabel = isFollowersMode ? '粉丝' : '关注';
  const modeCount = isFollowersMode ? stats.followerCount : stats.followingCount;
  const otherCount = isFollowersMode ? stats.followingCount : stats.followerCount;
  const otherPath = isFollowersMode ? `/user/${id}/following` : `/user/${id}/followers`;
  const otherLabel = isFollowersMode ? '关注' : '粉丝';

  return (
    <div>
      {/* 封面横幅 */}
      <div className="ym-space-cover">
        {targetProfile.cover_url ? (
          <img src={targetProfile.cover_url} alt="封面" decoding="async" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ym-text-muted)', fontSize: '14px' }}>
            {modeLabel}列表
          </div>
        )}
      </div>

      <div className="ym-space-body">
        {/* 头部：头像 + 用户名 + 返回创作者主页 */}
        <div className="ym-space-head">
          <div className="ym-space-avatar">
            <img
              src={targetProfile.avatar_url || DEFAULT_AVATAR}
              alt={username}
              decoding="async"
              onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
            />
          </div>
          <div className="ym-space-head-info" style={{ flex: 1, minWidth: '220px', paddingBottom: '4px' }}>
            <h1 style={{ fontFamily: 'var(--ym-font-display)', fontSize: '24px', fontWeight: '500', color: 'var(--ym-text-primary)', margin: 0 }}>
              {username}
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--ym-text-secondary)', margin: '6px 0 0' }}>
              {modeLabel} · 共 {modeCount} 人
            </p>
          </div>
          <Link to={`/user/${id}`} className="ym-btn ym-btn-secondary ym-btn-sm" style={{ alignSelf: 'flex-end' }}>
            返回主页
          </Link>
        </div>

        {/* 统计切换 */}
        <div className="ym-stats" style={{ marginBottom: '16px' }}>
          <Link to={isFollowersMode ? `/user/${id}/following` : `/user/${id}/followers`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="ym-stat">
              <b>{otherCount}</b>
              <span>{otherLabel}</span>
            </div>
          </Link>
          <div className="ym-stat" style={{ opacity: 0.5, pointerEvents: 'none' }}>
            <b>{modeCount}</b>
            <span>{modeLabel}（当前）</span>
          </div>
        </div>

        {/* 列表 */}
        <div className="ym-profile-list-slot">
          {loading ? (
            <div className="ym-profile-loading" aria-label="内容加载中" aria-busy="true">
              <div className="ym-profile-loading__row" />
              <div className="ym-profile-loading__row" />
              <div className="ym-profile-loading__row" />
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--ym-text-muted)' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>👥</div>
              <div style={{ fontSize: '15px', color: 'var(--ym-text-secondary)' }}>
                {isFollowersMode ? '暂无粉丝' : '还没有关注任何人'}
              </div>
            </div>
          ) : (
            <>
              {users.map((u, index) => (
                <UserCard
                  key={u.id}
                  user={u}
                  currentUserId={currentUserId}
                  onFollowChange={(targetId, following) => {
                    setUsers((prev) => prev.map((x) => (x.id === targetId ? { ...x, isFollowing: following } : x)));
                  }}
                />
              ))}
              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid var(--ym-border)',
                      borderRadius: 'var(--ym-radius-sm)',
                      backgroundColor: page <= 1 ? 'var(--ym-bg-subtle)' : 'var(--ym-bg-card)',
                      color: page <= 1 ? 'var(--ym-text-muted)' : 'var(--ym-text-primary)',
                      cursor: page <= 1 ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    上一页
                  </button>
                  <span style={{ fontSize: '13px', color: 'var(--ym-text-secondary)', alignSelf: 'center', padding: '0 8px' }}>
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid var(--ym-border)',
                      borderRadius: 'var(--ym-radius-sm)',
                      backgroundColor: page >= totalPages ? 'var(--ym-bg-subtle)' : 'var(--ym-bg-card)',
                      color: page >= totalPages ? 'var(--ym-text-muted)' : 'var(--ym-text-primary)',
                      cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default FollowListPage;