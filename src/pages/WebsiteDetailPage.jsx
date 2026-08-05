// src/pages/WebsiteDetailPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import {
  getWebsiteById,
  deleteWebsite,
  likeWebsite,
  unlikeWebsite,
  hasLikedWebsite,
} from '../services/websites.js';
import {
  getCommentsByWebsite,
  createComment,
  deleteComment,
} from '../services/comments.js';
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

// ---------- 评论卡片组件（已调整） ----------
const CommentCard = ({ comment, currentUserId, onDelete }) => {
  const isOwner = currentUserId && comment.user_id === currentUserId;

  return (
    <div
      style={{
        padding: '14px 18px',
        backgroundColor: 'var(--ym-bg-card)',
        border: '1px solid var(--ym-border)',
        borderRadius: 'var(--ym-radius-sm)',
        marginBottom: '12px',
      }}
    >
      {/* 用户名（前缀“用户：”） */}
      <div
        style={{
          fontWeight: '500',
          color: 'var(--ym-text-primary)',
          marginBottom: '4px',
        }}
      >
        用户：{comment.username}
      </div>

      {/* 评论内容（保留换行） */}
      <div
        style={{
          color: 'var(--ym-text-secondary)',
          lineHeight: 1.6,
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          marginBottom: '8px',
        }}
      >
        {comment.content}
      </div>

      {/* 底部：日期（左） + 删除按钮（右） */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
          color: 'var(--ym-text-muted)',
        }}
      >
        <span>{new Date(comment.created_at).toLocaleString('zh-CN')}</span>
        {isOwner && (
          <button
            onClick={() => onDelete(comment.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ym-danger)',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'color var(--ym-transition)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ym-danger-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ym-danger)')}
          >
            删除
          </button>
        )}
      </div>
    </div>
  );
};

export function WebsiteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  // ----- 网站详情状态 -----
  const [website, setWebsite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ----- 点赞状态 -----
  const [likeCount, setLikeCount] = useState(0);
  const [likedByUser, setLikedByUser] = useState(false);
  const [likeToggling, setLikeToggling] = useState(false);

  // ----- 评论状态 -----
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentsError, setCommentsError] = useState(null);
  const [commentContent, setCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ----- 加载详情 -----
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

  // ----- 加载评论 -----
  const loadComments = useCallback(async () => {
    if (!id) return;
    setLoadingComments(true);
    setCommentsError(null);
    try {
      const data = await getCommentsByWebsite(id);
      setComments(data);
    } catch (err) {
      console.error('加载评论失败:', err);
      setCommentsError('评论加载失败');
    } finally {
      setLoadingComments(false);
    }
  }, [id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // ----- 点赞切换 -----
  const handleLikeToggle = async () => {
    if (!user || likeToggling) return;
    setLikeToggling(true);
    try {
      if (likedByUser) {
        await unlikeWebsite(id, user.id);
        setLikeCount((prev) => prev - 1);
        setLikedByUser(false);
      } else {
        await likeWebsite(id, user.id);
        setLikeCount((prev) => prev + 1);
        setLikedByUser(true);
      }
    } catch (err) {
      console.error('点赞操作失败:', err);
    } finally {
      setLikeToggling(false);
    }
  };

  // ----- 发表评论（含换行符限制） -----
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    const trimmed = commentContent.trim();
    if (!trimmed) {
      alert('评论不能为空');
      return;
    }
    // 限制换行符数量（最多 10 个）
    const newlineCount = (trimmed.match(/\n/g) || []).length;
    if (newlineCount > 10) {
      alert('评论中的换行不能超过 10 个');
      return;
    }
    if (trimmed.length > 1000) {
      alert('评论不能超过 1000 字');
      return;
    }
    if (!user) {
      alert('请先登录');
      return;
    }

    setSubmitting(true);
    try {
      await createComment(id, user.id, trimmed);
      setCommentContent('');
      await loadComments(); // 重新加载评论
    } catch (err) {
      console.error('发表评论失败:', err);
      alert('发表评论失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // ----- 删除评论 -----
  const handleDeleteComment = async (commentId) => {
    const confirmed = window.confirm('确认删除该评论吗？');
    if (!confirmed) return;
    try {
      await deleteComment(commentId);
      // 本地移除该评论
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('删除评论失败:', err);
      alert('删除失败，请重试');
    }
  };

  // ----- 删除网站 -----
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

  // ---------- 渲染 ----------
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
        maxWidth: '720px',
        margin: '40px auto',
        padding: '32px 28px',
        backgroundColor: 'var(--ym-bg-card)',
        borderRadius: 'var(--ym-radius-lg)',
        border: '1px solid var(--ym-border)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      }}
    >
      {/* ---------- 面包屑 ---------- */}
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

      {/* ---------- 标题 ---------- */}
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

      {/* ---------- Meta ---------- */}
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

      {/* ---------- 详情描述 ---------- */}
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

      {/* ---------- 点赞区域 ---------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px',
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

      {/* ========================================================= */}
      {/* ---------- 评论区域（已调整） ---------- */}
      <div style={{ marginTop: '20px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '16px' }}>
          💬 评论（{comments.length}）
        </h3>

        {/* 评论列表 */}
        {loadingComments ? (
          <div style={{ color: 'var(--ym-text-secondary)', fontSize: '14px' }}>加载评论...</div>
        ) : commentsError ? (
          <div style={{ color: 'var(--ym-danger)', fontSize: '14px' }}>评论加载失败</div>
        ) : comments.length === 0 ? (
          <div style={{ color: 'var(--ym-text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
            暂无评论，成为第一个评论的人吧。
          </div>
        ) : (
          <div style={{ marginBottom: '20px' }}>
            {comments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                currentUserId={user?.id}
                onDelete={handleDeleteComment}
              />
            ))}
          </div>
        )}

        {/* 发表评论表单 */}
        {user ? (
          <form onSubmit={handleCommentSubmit} style={{ marginTop: '12px' }}>
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="写评论...（换行最多 10 行）"
              rows="3"
              disabled={submitting}
              maxLength="1000"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--ym-border)',
                borderRadius: 'var(--ym-radius-sm)',
                fontSize: '15px',
                backgroundColor: 'var(--ym-bg-card)',
                color: 'var(--ym-text-primary)',
                resize: 'vertical',
                fontFamily: 'var(--ym-font-body)',
                transition: 'border-color var(--ym-transition), box-shadow var(--ym-transition)',
                marginBottom: '10px',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--ym-border-strong)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(156,107,46,0.12)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--ym-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '8px 24px',
                  backgroundColor: 'var(--ym-accent)',
                  color: 'var(--ym-accent-text-on)',
                  border: 'none',
                  borderRadius: 'var(--ym-radius-sm)',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  transition: 'background-color var(--ym-transition)',
                }}
                onMouseEnter={(e) => {
                  if (!submitting) e.currentTarget.style.backgroundColor = 'var(--ym-accent-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!submitting) e.currentTarget.style.backgroundColor = 'var(--ym-accent)';
                }}
              >
                {submitting ? '发表评论...' : '发表评论'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ color: 'var(--ym-text-secondary)', fontSize: '14px', marginTop: '8px' }}>
            登录后即可发表评论
          </div>
        )}
      </div>
      {/* ---------- 评论区域结束 ---------- */}
      {/* ========================================================= */}

      {/* ---------- 操作按钮 ---------- */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          marginTop: '32px',
          borderTop: '1px solid var(--ym-border)',
          paddingTop: '24px',
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