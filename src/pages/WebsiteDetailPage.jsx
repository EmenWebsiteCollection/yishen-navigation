// src/pages/WebsiteDetailPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import {
  getWorkById,
  deleteWork,
  likeWork,
  unlikeWork,
  hasLikedWork,
  getWorkFavoriteCount,
  favoriteWork,
  unfavoriteWork,
} from '../services/works.js';
import {
  getCommentsByWebsite,
  createComment,
  deleteComment,
} from '../services/comments.js';
import '../styles/global.css';

// ---------- 辅助组件 ----------
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

// ---------- 评论卡片组件（包含回复功能） ----------
const CommentCard = ({
  comment,
  currentUserId,
  onDelete,
  onReplyClick,
  isReplying,
  replyContent,
  onReplyContentChange,
  onReplySubmit,
  onReplyCancel,
  replySubmitting,
  replyToUsername,
}) => {
  const isOwner = currentUserId && comment.user_id === currentUserId;
  const isReply = Boolean(replyToUsername);

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
      {/* 用户名显示 */}
      <div
        style={{
          fontWeight: '500',
          color: 'var(--ym-text-primary)',
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexWrap: 'wrap',
        }}
      >
        <Link
          to={`/user/${comment.user_id}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: 'var(--ym-text-primary)' }}
        >
          {comment.avatar_url ? (
            <img src={comment.avatar_url} alt='' style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <span style={{ display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--ym-bg-subtle)', textAlign: 'center', lineHeight: '20px', fontSize: '11px' }}>👤</span>
          )}
          {comment.username}
        </Link>
        {isReply && (
          <span style={{ color: 'var(--ym-text-muted)', fontWeight: '400', fontSize: '13px' }}>
            回复 <span style={{ color: 'var(--ym-accent)' }}>@{replyToUsername}</span>
          </span>
        )}
      </div>

      {/* 评论内容 */}
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

      {/* 底部：时间 + 操作按钮 */}
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
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {currentUserId && (
            <button
              onClick={() => onReplyClick(comment.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ym-text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'color var(--ym-transition)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ym-accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ym-text-secondary)')}
            >
              回复
            </button>
          )}
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

      {/* 回复输入框（展开状态）- 统一使用较小尺寸，所有层级一致 */}
      {isReplying && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--ym-border)' }}>
          <textarea
            value={replyContent}
            onChange={(e) => onReplyContentChange(e.target.value)}
            placeholder={`回复 @${comment.username}...`}
            rows={1}          // 改为 1 行，整体变小
            disabled={replySubmitting}
            maxLength="1000"
            style={{
              width: '100%',
              padding: '6px 10px',
              border: '1px solid var(--ym-border)',
              borderRadius: 'var(--ym-radius-sm)',
              fontSize: '13px',
              backgroundColor: 'var(--ym-bg-subtle)',
              color: 'var(--ym-text-primary)',
              resize: 'vertical',
              fontFamily: 'var(--ym-font-body)',
              boxSizing: 'border-box',
              marginBottom: '6px',
              lineHeight: 1.4,
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={onReplyCancel}
              disabled={replySubmitting}
              style={{
                padding: '4px 14px',
                backgroundColor: 'transparent',
                color: 'var(--ym-text-secondary)',
                border: '1px solid var(--ym-border)',
                borderRadius: 'var(--ym-radius-sm)',
                fontSize: '12px',
                cursor: replySubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              取消
            </button>
            <button
              onClick={onReplySubmit}
              disabled={replySubmitting}
              style={{
                padding: '4px 14px',
                backgroundColor: 'var(--ym-accent)',
                color: 'var(--ym-accent-text-on)',
                border: 'none',
                borderRadius: 'var(--ym-radius-sm)',
                fontSize: '12px',
                fontWeight: '500',
                cursor: replySubmitting ? 'not-allowed' : 'pointer',
                opacity: replySubmitting ? 0.6 : 1,
              }}
            >
              {replySubmitting ? '回复中...' : '回复'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- 主组件 ----------
export function WebsiteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // 网站详情
  const [website, setWebsite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // 点赞
  const [likeCount, setLikeCount] = useState(0);
  const [likedByUser, setLikedByUser] = useState(false);
  const [likeToggling, setLikeToggling] = useState(false);

  // 收藏
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [favoritedByUser, setFavoritedByUser] = useState(false);
  const [favoriteToggling, setFavoriteToggling] = useState(false);

  // 评论
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentsError, setCommentsError] = useState(null);
  const [commentContent, setCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 回复状态
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // ----- 加载详情 -----
  useEffect(() => {
    const loadWebsite = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getWorkById(id, user?.id);
        if (data === null) {
          setError('网站不存在');
          setWebsite(null);
          return;
        }
        setWebsite(data);
        setLikeCount(data.like_count || 0);
        setFavoriteCount(await getWorkFavoriteCount(id));
        setFavoritedByUser(data.favorited_by_user || false);

        if (user) {
          const liked = await hasLikedWork(id, user.id);
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

  // ----- 加载评论（含 parent_id） -----
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

  // ----- 点赞 -----
  const handleLikeToggle = async () => {
    if (!user || likeToggling) return;
    setLikeToggling(true);
    try {
      if (likedByUser) {
        await unlikeWork(id, user.id);
        setLikeCount((prev) => prev - 1);
        setLikedByUser(false);
      } else {
        await likeWork(id, user.id);
        setLikeCount((prev) => prev + 1);
        setLikedByUser(true);
      }
    } catch (err) {
      console.error('点赞操作失败:', err);
    } finally {
      setLikeToggling(false);
    }
  };

  // ----- 收藏 -----
  const handleFavoriteToggle = async () => {
    if (!user || favoriteToggling) return;
    setFavoriteToggling(true);
    try {
      if (favoritedByUser) {
        await unfavoriteWork(id, user.id);
        setFavoriteCount((prev) => Math.max(0, prev - 1));
        setFavoritedByUser(false);
      } else {
        await favoriteWork(id, user.id);
        setFavoriteCount((prev) => prev + 1);
        setFavoritedByUser(true);
      }
    } catch (err) {
      console.error('收藏操作失败:', err);
    } finally {
      setFavoriteToggling(false);
    }
  };

  // ----- 发表顶级评论 -----
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    const trimmed = commentContent.trim();
    if (!trimmed) {
      alert('评论不能为空');
      return;
    }
    if (trimmed.length > 1000) {
      alert('评论不能超过 1000 字');
      return;
    }
    const newlineCount = (trimmed.match(/\n/g) || []).length;
    if (newlineCount > 10) {
      alert('评论中的换行不能超过 10 个');
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
      await loadComments();
    } catch (err) {
      console.error('发表评论失败:', err);
      alert('发表评论失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // ----- 发表回复 -----
  const handleReplySubmit = async () => {
    if (!user || !replyingTo) return;
    const trimmed = replyContent.trim();
    if (!trimmed) {
      alert('回复不能为空');
      return;
    }
    if (trimmed.length > 1000) {
      alert('回复不能超过 1000 字');
      return;
    }
    const newlineCount = (trimmed.match(/\n/g) || []).length;
    if (newlineCount > 10) {
      alert('回复中的换行不能超过 10 个');
      return;
    }

    setSubmittingReply(true);
    try {
      await createComment(id, user.id, trimmed, replyingTo);
      setReplyContent('');
      setReplyingTo(null);
      await loadComments();
    } catch (err) {
      console.error('发表回复失败:', err);
      alert('发表回复失败，请稍后重试');
    } finally {
      setSubmittingReply(false);
    }
  };

  // ----- 删除评论（级联删除由数据库 ON DELETE CASCADE 处理） -----
  const handleDeleteComment = async (commentId) => {
    const confirmed = window.confirm('确认删除该评论吗？（其下的回复会一并删除）');
    if (!confirmed) return;
    try {
      await deleteComment(commentId);
      await loadComments();
      if (replyingTo === commentId) setReplyingTo(null);
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
      await deleteWork(id);
      navigate('/', { state: { deleteSuccess: true } });
    } catch (err) {
      console.error('删除失败:', err);
      setError('删除失败，请稍后重试。');
      setDeleting(false);
    }
  };

  // ----- 渲染树形评论（递归构建） -----
  const buildCommentTree = (commentsList) => {
    const map = {};
    const roots = [];
    commentsList.forEach((c) => (map[c.id] = { ...c, children: [] }));
    commentsList.forEach((c) => {
      if (c.parent_id && map[c.parent_id]) {
        map[c.parent_id].children.push(map[c.id]);
      } else {
        roots.push(map[c.id]);
      }
    });
    roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    roots.forEach((root) => {
      if (root.children) {
        root.children.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      }
    });
    return roots;
  };

  const commentTree = buildCommentTree(comments);

  // 递归渲染评论（无限深度，通过缩进控制，但所有回复输入框尺寸一致）
  const renderCommentTree = (nodes, depth = 0) => {
    if (!nodes || nodes.length === 0) return null;

    return nodes.map((node) => {
      const replyToUsername = node.parent_id
        ? comments.find((c) => c.id === node.parent_id)?.username || null
        : null;

      return (
        <div key={node.id} style={{ marginLeft: depth > 0 ? '24px' : '0' }}>
          {depth > 0 && (
            <div
              style={{
                marginLeft: '-12px',
                paddingLeft: '16px',
                borderLeft: '2px solid var(--ym-border)',
              }}
            >
              <CommentCard
                comment={node}
                currentUserId={user?.id}
                onDelete={handleDeleteComment}
                onReplyClick={(cid) => {
                  setReplyingTo(cid);
                  setReplyContent('');
                }}
                isReplying={replyingTo === node.id}
                replyContent={replyContent}
                onReplyContentChange={setReplyContent}
                onReplySubmit={handleReplySubmit}
                onReplyCancel={() => setReplyingTo(null)}
                replySubmitting={submittingReply}
                replyToUsername={replyToUsername}
              />
            </div>
          )}
          {depth === 0 && (
            <CommentCard
              comment={node}
              currentUserId={user?.id}
              onDelete={handleDeleteComment}
              onReplyClick={(cid) => {
                setReplyingTo(cid);
                setReplyContent('');
              }}
              isReplying={replyingTo === node.id}
              replyContent={replyContent}
              onReplyContentChange={setReplyContent}
              onReplySubmit={handleReplySubmit}
              onReplyCancel={() => setReplyingTo(null)}
              replySubmitting={submittingReply}
            />
          )}
          {node.children && node.children.length > 0 && renderCommentTree(node.children, depth + 1)}
        </div>
      );
    });
  };

  // ---------- 渲染状态 ----------
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

  // ---------- 主界面 ----------
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
      {/* ---------- 顶部：面包屑 + 访问按钮 ---------- */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
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

        {website.url && (
        <button
          onClick={() => window.open(website.url, '_blank')}
          style={{
            padding: '8px 20px',
            backgroundColor: 'var(--ym-accent)',
            color: 'var(--ym-accent-text-on)',
            border: 'none',
            borderRadius: 'var(--ym-radius-sm)',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color var(--ym-transition)',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--ym-accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--ym-accent)')}
        >
          🔗 访问网站
        </button>
        )}
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

      {/* ---------- 大图 ---------- */}
      {website.image_url && (
        <div
          style={{
            borderRadius: 'var(--ym-radius-sm)',
            overflow: 'hidden',
            marginBottom: '20px',
            border: '1px solid var(--ym-border)',
            backgroundColor: 'var(--ym-bg-subtle)',
          }}
        >
          <img
            src={website.image_url}
            alt={website.title}
            style={{ width: '100%', display: 'block' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      )}

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
        <Link to={`/user/${website.user_id}`} style={{ textDecoration: 'none' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: 'var(--ym-bg-subtle)', color: 'var(--ym-text-secondary)', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
            {website.avatar_url ? <img src={website.avatar_url} alt='' style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} /> : null}
            上传者：{website.username}
          </span>
        </Link>
        <Chip label="创建" value={new Date(website.created_at).toLocaleString('zh-CN')} />
        <Chip label="更新" value={new Date(website.updated_at).toLocaleString('zh-CN')} />
      </div>

      {/* ---------- 演示视频 ---------- */}
      {website.video_url && (
        <a
          href={website.video_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            marginBottom: '24px',
            backgroundColor: 'var(--ym-accent)',
            color: 'var(--ym-accent-text-on)',
            borderRadius: 'var(--ym-radius-sm)',
            fontSize: '14px',
            fontWeight: '500',
            textDecoration: 'none',
            transition: 'background-color var(--ym-transition)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--ym-accent-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--ym-accent)'; }}
        >
          ▶ 观看演示视频
        </a>
      )}

      {/* ---------- 描述 ---------- */}
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

      {/* ---------- 更新日志 ---------- */}
      {website.changelog && (
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'var(--ym-bg-subtle)',
            borderRadius: 'var(--ym-radius-sm)',
            marginBottom: '24px',
            fontSize: '14px',
            color: 'var(--ym-text-secondary)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          <div style={{ fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '6px' }}>📝 更新日志</div>
          {website.changelog}
        </div>
      )}

      {/* ---------- 点赞 ---------- */}
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

      {/* ---------- 收藏 ---------- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '16px', color: 'var(--ym-text-primary)' }}>
          🔖 {favoriteCount} 人收藏
        </span>
        {user ? (
          <button
            onClick={handleFavoriteToggle}
            disabled={favoriteToggling}
            style={{
              padding: '6px 16px',
              backgroundColor: favoritedByUser ? 'var(--ym-success)' : 'var(--ym-bg-card)',
              color: favoritedByUser ? '#fff' : 'var(--ym-text-secondary)',
              border: '1px solid var(--ym-border)',
              borderRadius: 'var(--ym-radius-sm)',
              cursor: favoriteToggling ? 'not-allowed' : 'pointer',
              opacity: favoriteToggling ? 0.6 : 1,
              transition: 'background-color var(--ym-transition), opacity var(--ym-transition)',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            {favoriteToggling ? '处理中...' : favoritedByUser ? '🔖 已收藏' : '🔖 收藏'}
          </button>
        ) : (
          <span style={{ fontSize: '14px', color: 'var(--ym-text-muted)' }}>登录后可收藏</span>
        )}
      </div>

      {/* ---------- 评论区域 ---------- */}
      <div style={{ marginTop: '20px' }}>
        <h3
          style={{
            fontSize: '18px',
            fontWeight: '500',
            color: 'var(--ym-text-primary)',
            marginBottom: '16px',
          }}
        >
          💬 评论（{comments.length}）
        </h3>

        {loadingComments ? (
          <div style={{ color: 'var(--ym-text-secondary)', fontSize: '14px' }}>加载评论...</div>
        ) : commentsError ? (
          <div style={{ color: 'var(--ym-danger)', fontSize: '14px' }}>评论加载失败</div>
        ) : comments.length === 0 ? (
          <div
            style={{
              color: 'var(--ym-text-secondary)',
              fontSize: '14px',
              marginBottom: '16px',
            }}
          >
            暂无评论，成为第一个评论的人吧。
          </div>
        ) : (
          <div style={{ marginBottom: '20px' }}>
            {renderCommentTree(commentTree)}
          </div>
        )}

        {/* 发表顶级评论 */}
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
                e.currentTarget.style.boxShadow = '0 0 0 3px var(--ym-focus-ring)';
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
          <div
            style={{
              color: 'var(--ym-text-secondary)',
              fontSize: '14px',
              marginTop: '8px',
            }}
          >
            登录后即可发表评论
          </div>
        )}
      </div>

      {/* ---------- 底部操作按钮（仅编辑/删除） ---------- */}
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
                color: 'var(--ym-danger-text-on)',
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