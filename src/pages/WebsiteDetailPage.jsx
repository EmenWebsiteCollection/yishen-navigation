// src/pages/WebsiteDetailPage.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import {
  getWebsiteById,
  deleteWebsite,
  likeWebsite,
  unlikeWebsite,
  hasLikedWebsite,
} from '../services/websites.js';
import '../styles/global.css';

const Chip = ({ label, value }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '4px 12px',
      backgroundColor: 'var(--ym-bg-subtle)',
      color: 'var(--ym-text-secondary)',
      borderRadius: '20px',
      fontSize: '13px',
      fontWeight: '500',
    }}
  >
    {label}：{value}
  </span>
);

export function WebsiteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [website, setWebsite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likedByUser, setLikedByUser] = useState(false);
  const [likeToggling, setLikeToggling] = useState(false);

  // 使用 ref 作为额外的锁定标志，防止并发点击
  const isLikingRef = useRef(false);

  useEffect(() => {
    const loadWebsite = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getWebsiteById(id);
        if (data === null) {
          setError('网站不存在');
          setWebsite(null);
          return;
        }
        setWebsite(data);
        setLikeCount(data.like_count || 0);

        if (user) {
          const liked = await hasLikedWebsite(id, user.id);
          setLikedByUser(liked);
        } else {
          setLikedByUser(false);
        }
      } catch (err) {
        console.error('加载详情错误:', err);
        setError('加载网站详情失败，请稍后重试。');
      } finally {
        setLoading(false);
      }
    };
    if (id) loadWebsite();
    else {
      setError('无效的网站 ID');
      setLoading(false);
    }
  }, [id, user]);

  const handleLikeToggle = useCallback(async () => {
    // 双重检查：状态锁和 ref 锁
    if (likeToggling || isLikingRef.current) return;
    if (!user) return;

    isLikingRef.current = true;
    setLikeToggling(true);

    try {
      if (likedByUser) {
        await unlikeWebsite(id, user.id);
        // 成功减少点赞数，并反转状态
        setLikeCount((prev) => prev - 1);
        setLikedByUser(false);
      } else {
        await likeWebsite(id, user.id);
        setLikeCount((prev) => prev + 1);
        setLikedByUser(true);
      }
    } catch (err) {
      console.error('点赞操作失败:', err);
      // 发生错误时，不更新状态，保持原样
    } finally {
      isLikingRef.current = false;
      setLikeToggling(false);
    }
  }, [id, user, likedByUser, likeToggling]);

  const handleDelete = async () => {
    if (!website) return;
    const confirmed = window.confirm(
      `确认删除网站“${website.title}”吗？\n此操作不可撤销。`
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteWebsite(id);
      navigate('/', { state: { deleteSuccess: true } });
    } catch (err) {
      console.error('删除失败:', err);
      setError('删除失败，请稍后重试。');
      setDeleting(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--ym-text-secondary)' }}>加载中...</div>;
  }

  if (error) {
    return (
      <div
        style={{
          maxWidth: '560px',
          margin: '60px auto',
          padding: '32px 28px',
          backgroundColor: 'var(--ym-bg-card)',
          borderRadius: 'var(--ym-radius-lg)',
          border: '1px solid var(--ym-border)',
          textAlign: 'center',
        }}
      >
        <p style={{ color: 'var(--ym-danger)' }}>{error}</p>
        <Link
          to="/"
          style={{
            color: 'var(--ym-accent)',
            fontSize: '14px',
            marginTop: '12px',
            display: 'inline-block',
            textDecoration: 'none',
          }}
        >
          返回首页
        </Link>
      </div>
    );
  }

  if (!website) {
    return (
      <div
        style={{
          maxWidth: '560px',
          margin: '60px auto',
          padding: '32px 28px',
          backgroundColor: 'var(--ym-bg-card)',
          borderRadius: 'var(--ym-radius-lg)',
          border: '1px solid var(--ym-border)',
          textAlign: 'center',
        }}
      >
        <p>网站不存在</p>
        <Link
          to="/"
          style={{
            color: 'var(--ym-accent)',
            fontSize: '14px',
            marginTop: '12px',
            display: 'inline-block',
            textDecoration: 'none',
          }}
        >
          返回首页
        </Link>
      </div>
    );
  }

  const isOwner = user && user.id === website.user_id;

  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '40px auto',
        padding: '32px 28px',
        backgroundColor: 'var(--ym-bg-card)',
        borderRadius: 'var(--ym-radius-lg)',
        border: '1px solid var(--ym-border)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ marginBottom: '20px' }}>
        <Link
          to="/"
          style={{
            color: 'var(--ym-text-secondary)',
            fontSize: '14px',
            textDecoration: 'none',
            transition: 'color var(--ym-transition)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ym-text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ym-text-secondary)')}
        >
          ← 返回首页
        </Link>
        <span style={{ color: 'var(--ym-text-muted)', margin: '0 8px' }}>/</span>
        <span style={{ color: 'var(--ym-text-secondary)', fontSize: '14px' }}>详情</span>
      </div>

      <h1
        style={{
          fontFamily: 'var(--ym-font-display)',
          fontSize: '26px',
          fontWeight: '500',
          color: 'var(--ym-text-primary)',
          marginBottom: '16px',
          letterSpacing: '0.5px',
          lineHeight: 1.3,
        }}
      >
        {website.title}
      </h1>

      <hr
        style={{
          border: 'none',
          borderTop: '1px solid var(--ym-border)',
          margin: '20px 0',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '24px',
        }}
      >
        <Chip label="上传者" value={website.username} />
        <Chip label="创建" value={new Date(website.created_at).toLocaleString('zh-CN')} />
        <Chip label="更新" value={new Date(website.updated_at).toLocaleString('zh-CN')} />
      </div>

      <div
        style={{
          padding: '16px 20px',
          backgroundColor: 'var(--ym-bg-subtle)',
          borderRadius: 'var(--ym-radius-sm)',
          marginBottom: '24px',
          fontSize: '15px',
          color: 'var(--ym-text-primary)',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {website.description || '暂无详情'}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '16px', color: 'var(--ym-text-primary)' }}>
          ❤️ {likeCount} 人喜欢
        </span>
        {user ? (
          <button
            onClick={handleLikeToggle}
            disabled={likeToggling}
            style={{
              padding: '6px 16px',
              backgroundColor: likedByUser ? 'var(--ym-success)' : 'var(--ym-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--ym-radius-sm)',
              cursor: likeToggling ? 'not-allowed' : 'pointer',
              opacity: likeToggling ? 0.6 : 1,
              transition: 'background-color var(--ym-transition), opacity var(--ym-transition)',
              fontSize: '14px',
              fontWeight: '500',
            }}
            onMouseEnter={(e) => {
              if (!likeToggling && !likedByUser) {
                e.currentTarget.style.backgroundColor = 'var(--ym-accent-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!likeToggling) {
                e.currentTarget.style.backgroundColor = likedByUser
                  ? 'var(--ym-success)'
                  : 'var(--ym-accent)';
              }
            }}
          >
            {likeToggling ? '处理中...' : likedByUser ? '♥ 已赞' : '♡ 点赞'}
          </button>
        ) : (
          <span style={{ fontSize: '14px', color: 'var(--ym-text-muted)' }}>
            登录后可点赞
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <button
          onClick={() => window.open(website.url, '_blank')}
          style={{
            padding: '10px 24px',
            backgroundColor: 'var(--ym-accent)',
            color: 'var(--ym-accent-text-on)',
            border: 'none',
            borderRadius: 'var(--ym-radius-sm)',
            fontSize: '15px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color var(--ym-transition)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--ym-accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--ym-accent)')}
        >
          访问网站
        </button>

        {isOwner && (
          <>
            <Link
              to={`/website/${id}/edit`}
              style={{
                padding: '10px 24px',
                backgroundColor: 'transparent',
                color: 'var(--ym-text-secondary)',
                border: '1px solid var(--ym-border)',
                borderRadius: 'var(--ym-radius-sm)',
                fontSize: '15px',
                fontWeight: '500',
                textDecoration: 'none',
                transition: 'all var(--ym-transition)',
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
              编辑
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: '10px 24px',
                backgroundColor: 'var(--ym-danger)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--ym-radius-sm)',
                fontSize: '15px',
                fontWeight: '500',
                cursor: deleting ? 'not-allowed' : 'pointer',
                opacity: deleting ? 0.5 : 1,
                transition: 'background-color var(--ym-transition)',
              }}
              onMouseEnter={(e) => {
                if (!deleting) {
                  e.currentTarget.style.backgroundColor = 'var(--ym-danger-hover)';
                  e.currentTarget.style.transform = 'scale(0.98)';
                }
              }}
              onMouseLeave={(e) => {
                if (!deleting) {
                  e.currentTarget.style.backgroundColor = 'var(--ym-danger)';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              {deleting ? '删除中...' : '删除'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}