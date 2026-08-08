// src/pages/WebsiteDetailPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { TechLoader } from '../components/TechLoader.jsx';
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
  isAdmin,
  aiDegreeLabel,
  creativeTypeLabel,
  audienceLabel,
  CONTENT_WARNINGS,
  incrementView,
  getTopRatedWorks,
  workTypeLabel,
} from '../services/works.js';
import { isFollowing, toggleFollow } from '../services/follows.js';
import { getDiscoveryRail, setFeatured } from '../services/discovery.js';
import { FEEDBACK_TYPES, feedbackLabel, validateAnchor, formatTime, checkTextQuoteMismatch } from '../services/comment-logic.js';
import { MediaPlayer } from '../components/MediaPlayer.jsx';
import { ImageAnnotator } from '../components/ImageAnnotator.jsx';
import { uploadWorkMedia, validateMediaFile } from '../services/media.js';
import { getWorkRevisions, markCommentAdopted } from '../services/revisions.js';
import { COMMENT_FEEDBACK_TYPES, toggleCommentFeedback } from '../services/commentFeedback.js';
import {
  getCommentsByWebsite,
  createComment,
  deleteComment,
} from '../services/comments.js';
import { getIdeaById } from '../services/ideas.js';
import { supabase } from '../services/supabase.js';
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
  isAdminUser,
  onDelete,
  onReplyClick,
  isReplying,
  replyContent,
  onReplyContentChange,
  onReplySubmit,
  onReplyCancel,
  replySubmitting,
  replyToUsername,
  workDescription = '',
  feedbackCounts = {},
  feedbackActive = {},
  onToggleFeedback,
  feedbackBusy = false,
  canAdopt = false,
  adopted = false,
  onAdopt,
  adoptBusy = false,
}) => {
  const isOwner = currentUserId && (comment.user_id === currentUserId || isAdminUser);
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
            <img src={comment.avatar_url} alt='' loading="lazy" decoding="async" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
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

      {/* 反馈类型徽章 */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', color: 'var(--ym-accent)', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '10px', padding: '2px 10px' }}>
          {feedbackLabel(comment.feedback_type)}
        </span>
        {comment.anchor && (
          <span style={{ fontSize: '11px', color: 'var(--ym-text-muted)', borderRadius: '10px', padding: '2px 10px', border: '1px dashed var(--ym-border)' }}>
            {comment.anchor.kind === 'image' && '📷 图片区域批注'}
            {comment.anchor.kind === 'text' && `📝 「${(comment.anchor.quote || '').slice(0, 24)}${(comment.anchor.quote || '').length > 24 ? '…' : ''}」`}
            {comment.anchor.kind === 'video' && `🎬 ${formatTime(comment.anchor.start_sec)}${comment.anchor.end_sec != null ? ' - ' + formatTime(comment.anchor.end_sec) : ' 起'}`}
            {comment.anchor.kind === 'audio' && `🎵 ${formatTime(comment.anchor.start_sec)}${comment.anchor.end_sec != null ? ' - ' + formatTime(comment.anchor.end_sec) : ' 起'}`}
            {comment.anchor.kind === 'component' && `🧩 ${comment.anchor.path}`}
          </span>
        )}
      </div>
      {comment.anchor && comment.anchor.kind === 'text' && checkTextQuoteMismatch(comment.anchor, workDescription) && (
        <div style={{ fontSize: '11px', color: 'var(--ym-text-muted)', marginBottom: '6px' }}>
          ⚠️ 原文已修改，该段批注可能已失效
        </div>
      )}

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

      {/* Issue #39 P3：评论质量评价 + 采纳 */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '6px' }}>
        {COMMENT_FEEDBACK_TYPES.map((t) => {
          const active = !!feedbackActive[t.id];
          const count = feedbackCounts[t.id] || 0;
          return (
            <button
              key={t.id}
              onClick={() => onToggleFeedback && onToggleFeedback(comment.id, t.id)}
              disabled={feedbackBusy || !currentUserId}
              title={currentUserId ? '' : '登录后可评价'}
              style={{
                padding: '2px 10px',
                borderRadius: '12px',
                border: '1px solid var(--ym-border)',
                backgroundColor: active ? 'var(--ym-success)' : 'var(--ym-bg-card)',
                color: active ? '#fff' : 'var(--ym-text-secondary)',
                cursor: currentUserId && !feedbackBusy ? 'pointer' : 'not-allowed',
                fontSize: '11px',
                opacity: currentUserId ? 1 : 0.6,
                transition: 'all var(--ym-transition)',
              }}
            >
              {t.label} {count > 0 ? count : ''}
            </button>
          );
        })}
        {canAdopt && !adopted && (
          <button
            onClick={() => onAdopt && onAdopt(comment)}
            disabled={adoptBusy}
            style={{
              padding: '2px 10px',
              borderRadius: '12px',
              border: '1px solid var(--ym-accent)',
              backgroundColor: 'transparent',
              color: 'var(--ym-accent)',
              cursor: adoptBusy ? 'not-allowed' : 'pointer',
              fontSize: '11px',
              opacity: adoptBusy ? 0.6 : 1,
            }}
          >
            采纳这条建议
          </button>
        )}
        {adopted && (
          <span style={{ fontSize: '11px', color: 'var(--ym-success)', fontWeight: '500' }}>
            ✓ 已被作者采纳
          </span>
        )}
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
  const { user, isAnonymous } = useAuth();
  const [isAdminUser, setIsAdminUser] = useState(false);
  useEffect(() => {
    if (user?.id) {
      isAdmin(user.id).then(setIsAdminUser).catch(() => setIsAdminUser(false));
    } else {
      setIsAdminUser(false);
    }
  }, [user?.id]);

  // 浏览量计数：同会话只计一次（刷新/重复进入不重复计），失败静默
  useEffect(() => {
    if (!id) return;
    try {
      const viewed = JSON.parse(sessionStorage.getItem('viewed_works') || '[]');
      if (!viewed.includes(id)) {
        incrementView(id);
        viewed.push(id);
        sessionStorage.setItem('viewed_works', JSON.stringify(viewed));
      }
    } catch (e) {
      // sessionStorage 异常忽略，不影响页面
    }
  }, [id]);

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

  // Issue #39 P1：关注 + 同类型推荐
  const [following, setFollowing] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [similarWorks, setSimilarWorks] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [featuredBusy, setFeaturedBusy] = useState(false);

  // Issue #39 P2：结构化评论 + 局部批注
  const [commentFeedbackType, setCommentFeedbackType] = useState('appreciate');
  const [anchorMode, setAnchorMode] = useState(null); // null|image|text|video|audio|component
  const [pendingAnchor, setPendingAnchor] = useState(null);
  const [mediaRange, setMediaRange] = useState({ start_sec: null, end_sec: null });
  const [manualSec, setManualSec] = useState('');
  const [mediaUploading, setMediaUploading] = useState(false);

  // Issue #39 P3：评论质量评价 + 作品成长档案
  const [feedbackMap, setFeedbackMap] = useState({}); // { [commentId]: { counts, active } }
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [adoptBusy, setAdoptBusy] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(true);

  // 评论
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentsError, setCommentsError] = useState(null);
  const [commentContent, setCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 回复状态
  const [replyingTo, setReplyingTo] = useState(null);

  // 孵化源头（作品 source_idea_id 非空时显示）
  const [sourceIdea, setSourceIdea] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // 右侧推荐
  const [topRated, setTopRated] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getTopRatedWorks(6);
        if (!cancelled) setTopRated(data);
      } catch (err) {
        console.warn('加载高分榜单失败:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
          if (user.id !== data.user_id) {
            isFollowing(user.id, data.user_id).then(setFollowing).catch(() => setFollowing(false));
          }
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

  // Issue #39 P3：评论质量评价聚合（一次查询）
  useEffect(() => {
    let cancelled = false;
    const ids = comments.map((c) => c.id);
    if (ids.length === 0) {
      setFeedbackMap({});
      return;
    }
    supabase
      .from('comment_feedback')
      .select('comment_id, feedback_type, user_id')
      .in('comment_id', ids)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const map = {};
        ids.forEach((cid) => { map[cid] = { counts: {}, active: {} }; });
        (data || []).forEach((f) => {
          if (!map[f.comment_id]) return;
          map[f.comment_id].counts[f.feedback_type] = (map[f.comment_id].counts[f.feedback_type] || 0) + 1;
          if (user && f.user_id === user.id) map[f.comment_id].active[f.feedback_type] = true;
        });
        setFeedbackMap(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [comments, user]);

  // Issue #39 P3：作品成长档案（版本快照）
  useEffect(() => {
    let cancelled = false;
    if (id) {
      setRevisionsLoading(true);
      getWorkRevisions(id)
        .then((list) => { if (!cancelled) setRevisions(list); })
        .catch((e) => { console.warn('加载成长档案失败:', e.message); if (!cancelled) setRevisions([]); })
        .finally(() => { if (!cancelled) setRevisionsLoading(false); });
    }
    return () => { cancelled = true; };
  }, [id]);

  // ----- 评论质量评价 / 采纳 -----
  const handleToggleFeedback = async (commentId, type) => {
    if (!user || isAnonymous || feedbackBusy) return;
    setFeedbackBusy(true);
    try {
      const res = await toggleCommentFeedback(commentId, user.id, type);
      setFeedbackMap((prev) => {
        const cur = prev[commentId] || { counts: {}, active: {} };
        const next = {
          counts: { ...cur.counts },
          active: { ...cur.active },
        };
        if (res.active) {
          next.counts[type] = (next.counts[type] || 0) + 1;
          next.active[type] = true;
        } else {
          next.counts[type] = Math.max(0, (next.counts[type] || 0) - 1);
          delete next.active[type];
        }
        return { ...prev, [commentId]: next };
      });
    } catch (e) {
      console.error('评价操作失败:', e);
    } finally {
      setFeedbackBusy(false);
    }
  };

  const handleAdopt = async (comment) => {
    if (!user || isAnonymous || adoptBusy) return;
    const summary = window.prompt('可选：写一句采纳说明（会记录进成长档案）', '') || '';
    setAdoptBusy(true);
    try {
      await markCommentAdopted(comment.id, id, user.id, summary);
      await loadComments();
    } catch (e) {
      alert(e.message || '采纳失败');
      console.error(e);
    } finally {
      setAdoptBusy(false);
    }
  };

  // Issue #39 P1：同类型推荐
  useEffect(() => {
    let cancelled = false;
    if (id) {
      setSimilarLoading(true);
      getDiscoveryRail('similar', { workId: id, limit: 4, maxPerAuthor: 1 })
        .then((list) => {
          if (!cancelled) setSimilarWorks(list.filter((w) => w.id !== id));
        })
        .catch((e) => {
          console.warn('同类型推荐加载失败:', e.message);
          if (!cancelled) setSimilarWorks([]);
        })
        .finally(() => {
          if (!cancelled) setSimilarLoading(false);
        });
    }
    return () => { cancelled = true; };
  }, [id]);

  // ----- 关注/取关 -----
  const handleFollowToggle = async () => {
    if (!user || isAnonymous) { alert('请先登录后再关注创作者'); return; }
    if (followingLoading || !website) return;
    setFollowingLoading(true);
    try {
      const res = await toggleFollow(user.id, website.user_id);
      setFollowing(res.following);
    } catch (err) {
      console.error('关注操作失败:', err);
    } finally {
      setFollowingLoading(false);
    }
  };

  // ----- 编辑精选（仅管理员） -----
  const handleFeaturedToggle = async () => {
    if (!isAdminUser || featuredBusy || !website) return;
    setFeaturedBusy(true);
    try {
      await setFeatured(website.id, !website.featured);
      setWebsite((prev) => (prev ? { ...prev, featured: !prev.featured } : prev));
    } catch (err) {
      console.error('设置精选失败:', err.message);
      alert(err.message || '设置精选失败');
    } finally {
      setFeaturedBusy(false);
    }
  };

  // ----- Issue #39 P2：批注 -----
  const descRef = React.useRef(null);

  const startAnchorMode = (mode) => {
    setAnchorMode((prev) => (prev === mode ? null : mode));
    setPendingAnchor(null);
    setMediaRange({ start_sec: null, end_sec: null });
    setManualSec('');
  };

  const handleTextSelection = () => {
    if (anchorMode !== 'text') return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const node = sel.anchorNode;
    if (node && descRef.current && descRef.current.contains(node)) {
      const start = Math.min(sel.anchorOffset, sel.focusOffset);
      const end = Math.max(sel.anchorOffset, sel.focusOffset);
      if (end > start) {
        setPendingAnchor({ kind: 'text', start, end, quote: sel.toString().slice(0, 500) });
      }
    }
  };

  const getComponentPath = (el) => {
    const parts = [];
    let node = el;
    while (node && node !== document.body && parts.length < 4) {
      let sel = node.tagName ? node.tagName.toLowerCase() : '';
      if (node.id) sel = '#' + node.id;
      else if (node.className && typeof node.className === 'string') {
        const cls = node.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.');
        if (cls) sel += '.' + cls;
      }
      parts.unshift(sel);
      node = node.parentElement;
    }
    return parts.join(' > ');
  };

  const handleComponentCapture = (e) => {
    if (anchorMode !== 'component') return;
    e.preventDefault();
    e.stopPropagation();
    const path = getComponentPath(e.target);
    if (path) setPendingAnchor({ kind: 'component', path });
  };

  const handleMediaRange = (startSec, endSec) => {
    setMediaRange({ start_sec: startSec, end_sec: endSec });
    setPendingAnchor({
      kind: website?.work_type === 'music' || website?.work_type === 'audio' ? 'audio' : 'video',
      start_sec: startSec,
      end_sec: endSec,
    });
  };

  const handleManualTimeAnchor = () => {
    const sec = Math.floor(Number(manualSec));
    if (!Number.isFinite(sec) || sec < 0) {
      alert('请输入有效的时间秒数');
      return;
    }
    const kind = website?.work_type === 'music' || website?.work_type === 'audio' ? 'audio' : 'video';
    setPendingAnchor({ kind, start_sec: sec });
    setMediaRange({ start_sec: sec, end_sec: null });
  };

  const anchorSummary = (a) => {
    if (!a) return '';
    if (a.kind === 'image') return `📷 图片区域 (${Math.round(a.x * 100)}%, ${Math.round(a.y * 100)}%)`;
    if (a.kind === 'text') return `📝 「${(a.quote || '').slice(0, 20)}${(a.quote || '').length > 20 ? '…' : ''}」`;
    if (a.kind === 'video' || a.kind === 'audio') {
      return `${a.kind === 'video' ? '🎬' : '🎵'} ${formatTime(a.start_sec)}${a.end_sec != null ? ' - ' + formatTime(a.end_sec) : ' 起'}`;
    }
    if (a.kind === 'component') return `🧩 ${a.path}`;
    return '';
  };

  // ----- 点赞 -----
  const handleLikeToggle = async () => {
    if (!user || isAnonymous) { alert('请先登录后再点赞'); return; }
    if (likeToggling) return;
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
    if (!user || isAnonymous) { alert('请先登录后再收藏'); return; }
    if (favoriteToggling) return;
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
    if (!user || isAnonymous) {
      alert('请先登录');
      return;
    }

    setSubmitting(true);
    try {
      let anchor = null;
      try {
        anchor = validateAnchor(pendingAnchor);
      } catch (e) {
        alert(e.message);
        setSubmitting(false);
        return;
      }
      await createComment(id, user.id, trimmed, {
        parentId: null,
        feedbackType: commentFeedbackType,
        anchor,
      });
      setCommentContent('');
      setPendingAnchor(null);
      setAnchorMode(null);
      setMediaRange({ start_sec: null, end_sec: null });
      setManualSec('');
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
    if (!user || isAnonymous) { alert('请先登录后再回复'); return; }
    if (!replyingTo) return;
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
      await createComment(id, user.id, trimmed, { parentId: replyingTo, feedbackType: 'appreciate', anchor: null });
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

  useEffect(() => {
    if (!website?.source_idea_id) {
      setSourceIdea(null);
      return;
    }
    getIdeaById(website.source_idea_id)
      .then((idea) => setSourceIdea(idea))
      .catch(() => setSourceIdea(null));
  }, [website?.source_idea_id]);

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
                workDescription={website?.description || ''}
                feedbackCounts={feedbackMap[node.id]?.counts || {}}
                feedbackActive={feedbackMap[node.id]?.active || {}}
                onToggleFeedback={handleToggleFeedback}
                feedbackBusy={feedbackBusy}
                canAdopt={!!user && user.id === website?.user_id && node.user_id !== user.id}
                adopted={!!node.adopted}
                onAdopt={handleAdopt}
                adoptBusy={adoptBusy}
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
              workDescription={website?.description || ''}
              feedbackCounts={feedbackMap[node.id]?.counts || {}}
              feedbackActive={feedbackMap[node.id]?.active || {}}
              onToggleFeedback={handleToggleFeedback}
              feedbackBusy={feedbackBusy}
              canAdopt={!!user && user.id === website?.user_id && node.user_id !== user.id}
              adopted={!!node.adopted}
              onAdopt={handleAdopt}
              adoptBusy={adoptBusy}
            />
          )}
          {node.children && node.children.length > 0 && renderCommentTree(node.children, depth + 1)}
        </div>
      );
    });
  };

  // ---------- 渲染状态 ----------
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '60px' }}><TechLoader text="加载中..." /></div>;
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

  const isOwner = user && (user.id === website.user_id || isAdminUser);

  // ---------- 主界面 ----------
  return (
    <div className="ym-detail-layout" onClickCapture={handleComponentCapture}>
      <div
        style={{
          padding: '28px',
          backgroundColor: 'var(--ym-bg-card)',
          borderRadius: 'var(--ym-radius-md)',
          border: '1px solid var(--ym-border)',
        }}
      >
      {sourceIdea && (
        <Link
          to={`/ideas/${sourceIdea.id}`}
          style={{ display: 'block', textDecoration: 'none', marginBottom: '16px', padding: '10px 14px', borderRadius: 'var(--ym-radius-sm)', backgroundColor: 'var(--ym-success-bg)', color: 'var(--ym-success)', fontSize: '14px' }}
        >
          💡 孵化自想法「{sourceIdea.title}」→ 查看想法
        </Link>
      )}

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

      {/* ---------- 大图（Issue #39 P2：支持图片局部批注） ---------- */}
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
          <ImageAnnotator
            src={website.image_url}
            alt={website.title}
            addMode={anchorMode === 'image'}
            onAdd={(x, y, w, h) => {
              setPendingAnchor({ kind: 'image', x, y, w, h });
              setAnchorMode(null);
            }}
            anchors={comments
              .filter((c) => c.anchor && c.anchor.kind === 'image')
              .map((c) => ({ id: c.id, ...c.anchor }))}
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
            {website.avatar_url ? <img src={website.avatar_url} alt='' loading="lazy" decoding="async" style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} /> : null}
            上传者：{website.username}
          </span>
        </Link>
        {user && user.id !== website.user_id && (
          <button
            onClick={handleFollowToggle}
            disabled={followingLoading}
            style={{
              padding: '4px 16px',
              borderRadius: '20px',
              border: '1px solid var(--ym-border)',
              backgroundColor: following ? 'var(--ym-success)' : 'transparent',
              color: following ? '#fff' : 'var(--ym-text-secondary)',
              cursor: followingLoading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              transition: 'all var(--ym-transition)',
            }}
          >
            {followingLoading ? '处理中...' : following ? '✓ 已关注' : '+ 关注'}
          </button>
        )}
        <Chip label="创建" value={new Date(website.created_at).toLocaleString('zh-CN')} />
        <Chip label="更新" value={new Date(website.updated_at).toLocaleString('zh-CN')} />
        <Chip label="分区" value={workTypeLabel(website.work_type)} />
      </div>

      {/* ---------- Issue #39 P1：创作标签与信息 ---------- */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: '500',
              padding: '3px 12px',
              borderRadius: '14px',
              color: website.ai_degree === 'unknown' ? 'var(--ym-text-muted)' : '#fff',
              backgroundColor:
                website.ai_degree === 'none' ? 'var(--ym-success)'
                : website.ai_degree === 'generated' ? 'var(--ym-danger)'
                : website.ai_degree === 'unknown' ? 'var(--ym-bg-subtle)'
                : 'var(--ym-accent)',
              border: '1px solid var(--ym-border)',
            }}
            title="AI 参与程度（合规标识）"
          >
            🤖 AI 参与：{aiDegreeLabel(website.ai_degree)}
          </span>
          {website.creative_type && (
            <span style={{ fontSize: '12px', color: 'var(--ym-text-secondary)', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '14px', padding: '3px 12px' }}>
              {creativeTypeLabel(website.creative_type)}
            </span>
          )}
          {website.completion != null && (
            <span style={{ fontSize: '12px', color: 'var(--ym-text-secondary)', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '14px', padding: '3px 12px' }}>
              完成度 {website.completion}%
            </span>
          )}
          {website.seeking_collab && (
            <span style={{ fontSize: '12px', color: '#fff', backgroundColor: 'var(--ym-success)', borderRadius: '14px', padding: '3px 12px' }}>
              寻找合作
            </span>
          )}
          {website.derivative_allowed && (
            <span style={{ fontSize: '12px', color: 'var(--ym-text-secondary)', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '14px', padding: '3px 12px' }}>
              允许二创
            </span>
          )}
          {website.commercial_use && (
            <span style={{ fontSize: '12px', color: 'var(--ym-text-secondary)', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '14px', padding: '3px 12px' }}>
              可商用
            </span>
          )}
          {website.audience && (
            <span style={{ fontSize: '12px', color: 'var(--ym-text-secondary)', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '14px', padding: '3px 12px' }}>
              受众：{audienceLabel(website.audience)}
            </span>
          )}
        </div>

        {website.ai_degree === 'unknown' && (
          <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginBottom: '10px' }}>
            ⚠️ 该作品未标注 AI 参与程度。根据《人工智能生成合成内容标识办法》，平台对未标识/疑似内容加注风险提示。
          </div>
        )}

        {(website.tags || []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {(website.tags || []).map((t) => (
              <Link
                key={t}
                to={`/discover?tag=${encodeURIComponent(t)}`}
                style={{ fontSize: '12px', color: 'var(--ym-accent)', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '12px', padding: '2px 10px', textDecoration: 'none' }}
              >
                #{t}
              </Link>
            ))}
          </div>
        )}
        {((website.styles || []).length > 0 || (website.tools || []).length > 0) && (
          <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', lineHeight: 1.8 }}>
            {(website.styles || []).length > 0 && (
              <div>🎨 风格：{(website.styles || []).join(' / ')}</div>
            )}
            {(website.tools || []).length > 0 && (
              <div>🛠️ 工具：{(website.tools || []).join(' / ')}</div>
            )}
          </div>
        )}
        {(website.content_warning || []).length > 0 && (
          <div style={{ fontSize: '12px', color: 'var(--ym-danger)', marginTop: '6px' }}>
            ⚠️ 内容警告：{(website.content_warning || []).map((c) => CONTENT_WARNINGS.find((x) => x.id === c)?.label || c).join(' / ')}
          </div>
        )}
      </div>

      {/* ---------- 媒体（Issue #39 P2：内嵌播放器 + 时间区间批注） ---------- */}
      {website.media_url && (
        <div style={{ marginBottom: '24px' }}>
          <MediaPlayer
            src={website.media_url}
            type={website.work_type === 'music' ? 'audio' : 'video'}
            selectMode={anchorMode === 'video' || anchorMode === 'audio'}
            onRangeSelect={handleMediaRange}
            markers={comments
              .filter((c) => c.anchor && (c.anchor.kind === 'video' || c.anchor.kind === 'audio'))
              .map((c) => ({ id: c.id, start_sec: c.anchor.start_sec, end_sec: c.anchor.end_sec }))}
          />
        </div>
      )}

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
          ▶ 观看演示视频（外链）
        </a>
      )}

      {/* 外链视频/音频的时间锚降级批注 */}
      {(anchorMode === 'video' || anchorMode === 'audio') && !website.media_url && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '24px', padding: '12px 16px', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: 'var(--ym-radius-sm)' }}>
          <span style={{ fontSize: '13px', color: 'var(--ym-text-secondary)' }}>
            该媒体为外链，暂无法内嵌播放；可手动填写时间点（秒）做时间锚批注：
          </span>
          <input
            type="number"
            min="0"
            value={manualSec}
            onChange={(e) => setManualSec(e.target.value)}
            placeholder="如 90"
            style={{ width: '90px', padding: '6px 10px', border: '1px solid var(--ym-border)', borderRadius: 'var(--ym-radius-sm)', fontSize: '13px' }}
          />
          <button
            onClick={handleManualTimeAnchor}
            style={{ padding: '6px 14px', backgroundColor: 'var(--ym-accent)', color: 'var(--ym-accent-text-on)', border: 'none', borderRadius: 'var(--ym-radius-sm)', cursor: 'pointer', fontSize: '13px' }}
          >
            使用此时间点
          </button>
        </div>
      )}

      {/* ---------- 描述（Issue #39 P2：支持文字选中批注） ---------- */}
      <div
        ref={descRef}
        onMouseUp={handleTextSelection}
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
          cursor: anchorMode === 'text' ? 'text' : 'default',
        }}
      >
        {website.description || '暂无详情'}
        {anchorMode === 'text' && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--ym-text-muted)' }}>
            已进入文字批注模式：直接用鼠标选中想点评的段落，松开即生成批注。
          </div>
        )}
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
        <span style={{ fontSize: '16px', color: 'var(--ym-text-secondary)' }}>
          👁 {website.view_count ?? 0} 次浏览
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

      {/* ---------- Issue #39 P1：灵感地图 + 同类型推荐 ---------- */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <Link
          to={`/work/${id}/map`}
          style={{
            padding: '10px 20px',
            backgroundColor: 'transparent',
            color: 'var(--ym-text-secondary)',
            border: '1px solid var(--ym-border)',
            borderRadius: 'var(--ym-radius-sm)',
            fontSize: '14px',
            fontWeight: '500',
            textDecoration: 'none',
            transition: 'all var(--ym-transition)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--ym-accent)';
            e.currentTarget.style.color = 'var(--ym-accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--ym-border)';
            e.currentTarget.style.color = 'var(--ym-text-secondary)';
          }}
        >
          🗺️ 灵感地图
        </Link>
      </div>

      {similarLoading ? (
        <div style={{ color: 'var(--ym-text-secondary)', fontSize: '13px', marginBottom: '24px' }}>正在寻找同类作品...</div>
      ) : similarWorks.length > 0 ? (
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '12px' }}>
            同类型推荐
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {similarWorks.map((w) => (
              <Link
                key={w.id}
                to={`/website/${w.id}`}
                style={{ textDecoration: 'none', border: '1px solid var(--ym-border)', borderRadius: 'var(--ym-radius-sm)', overflow: 'hidden', display: 'block', backgroundColor: 'var(--ym-bg-card)' }}
              >
                {w.image_url ? (
                  <img src={w.image_url} alt={w.title} loading="lazy" decoding="async" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <div style={{ aspectRatio: '16/9', backgroundColor: 'var(--ym-bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>✨</div>
                )}
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--ym-text-primary)', fontWeight: '500', lineHeight: 1.35 }}>{w.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginTop: '4px' }}>❤️ {w.like_count ?? 0} · 💬 {w.comment_count ?? 0}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

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
            {/* 反馈类型（Issue #39 P2） */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {FEEDBACK_TYPES.map((f) => {
                const active = commentFeedbackType === f.id;
                return (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => setCommentFeedbackType(f.id)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '16px',
                      border: '1px solid var(--ym-border)',
                      backgroundColor: active ? 'var(--ym-accent)' : 'var(--ym-bg-card)',
                      color: active ? 'var(--ym-accent-text-on)' : 'var(--ym-text-secondary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      transition: 'all var(--ym-transition)',
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* 局部批注模式（Issue #39 P2） */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--ym-text-muted)' }}>局部批注：</span>
              {[
                { id: 'image', label: '📷 图片区域' },
                { id: 'text', label: '📝 文字选中' },
                { id: 'video', label: '🎬 视频时间' },
                { id: 'audio', label: '🎵 音频时间' },
                { id: 'component', label: '🧩 组件位置' },
              ].map((m) => {
                const active = anchorMode === m.id;
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => startAnchorMode(m.id)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '16px',
                      border: '1px solid var(--ym-border)',
                      backgroundColor: active ? 'var(--ym-success)' : 'var(--ym-bg-card)',
                      color: active ? '#fff' : 'var(--ym-text-secondary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      transition: 'all var(--ym-transition)',
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {pendingAnchor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', padding: '8px 12px', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: 'var(--ym-radius-sm)', fontSize: '13px', color: 'var(--ym-text-secondary)' }}>
                <span>批注：{anchorSummary(pendingAnchor)}</span>
                <button type="button" onClick={() => setPendingAnchor(null)} style={{ background: 'none', border: 'none', color: 'var(--ym-danger)', cursor: 'pointer', fontSize: '13px' }}>
                  移除
                </button>
              </div>
            )}

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

      {/* ---------- Issue #39 P3：作品成长档案 ---------- */}
      <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--ym-border)' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '4px' }}>
          📜 作品成长档案
        </h3>
        <div style={{ fontSize: '13px', color: 'var(--ym-text-muted)', marginBottom: '16px' }}>
          首次上传和每次编辑都会自动生成只读快照；被作者采纳的评论会回链到这里。
        </div>

        {revisionsLoading ? (
          <div style={{ color: 'var(--ym-text-secondary)', fontSize: '14px' }}>加载成长档案...</div>
        ) : revisions.length === 0 ? (
          <div style={{ color: 'var(--ym-text-secondary)', fontSize: '14px' }}>
            暂无版本记录。首次上传或编辑作品后会自动生成版本快照。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {revisions.map((rev, idx) => {
              const prev = idx > 0 ? revisions[idx - 1] : null;
              const changes = [];
              if (prev) {
                if (prev.title !== rev.title) changes.push('标题');
                if (prev.description !== rev.description) changes.push('描述');
                if ((prev.image_url || null) !== (rev.image_url || null)) changes.push('封面/图片');
                if ((prev.cover_url || null) !== (rev.cover_url || null)) changes.push('封面');
                if (prev.changelog !== rev.changelog) changes.push('更新日志');
              } else {
                changes.push('首次发布');
              }
              const adoptedComments = (rev.adopted_comment_ids || [])
                .map((cid) => comments.find((c) => c.id === cid))
                .filter(Boolean);
              const labelMap = { first: '第一版', revised: '修改版', final: '最终版' };
              const isLast = idx === revisions.length - 1;
              return (
                <div
                  key={rev.id}
                  style={{
                    padding: '14px 16px',
                    backgroundColor: isLast ? 'var(--ym-bg-subtle)' : 'var(--ym-bg-card)',
                    border: `1px solid ${isLast ? 'var(--ym-accent)' : 'var(--ym-border)'}`,
                    borderRadius: 'var(--ym-radius-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: isLast ? 'var(--ym-accent)' : 'var(--ym-text-primary)' }}>
                      {labelMap[rev.version_label] || rev.version_label}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--ym-text-muted)' }}>
                      v{rev.revision_no} · {new Date(rev.created_at).toLocaleString('zh-CN')}
                    </span>
                    {isLast && (
                      <span style={{ fontSize: '11px', color: '#fff', backgroundColor: 'var(--ym-accent)', borderRadius: '10px', padding: '1px 8px' }}>
                        当前版本
                      </span>
                    )}
                  </div>
                  {changes.length > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--ym-text-secondary)', marginBottom: '4px' }}>
                      变更：{changes.join(' / ')}
                    </div>
                  )}
                  {rev.note && (
                    <div style={{ fontSize: '13px', color: 'var(--ym-text-secondary)', marginBottom: '4px', whiteSpace: 'pre-wrap' }}>{rev.note}</div>
                  )}
                  {rev.adopted_summary && (
                    <div style={{ fontSize: '12px', color: 'var(--ym-text-secondary)', marginBottom: '4px' }}>
                      采纳说明：{rev.adopted_summary}
                    </div>
                  )}
                  {adoptedComments.length > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--ym-text-secondary)', marginTop: '6px' }}>
                      ✓ 采纳了 {adoptedComments.length} 条建议：
                      {adoptedComments.map((c) => (
                        <span key={c.id} style={{ display: 'inline-block', backgroundColor: 'var(--ym-success-bg)', borderRadius: '6px', padding: '2px 8px', margin: '2px 4px 0 0' }}>
                          @{c.username}：「{(c.content || '').slice(0, 24)}{(c.content || '').length > 24 ? '…' : ''}」
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
            {isAdminUser && (
              <button
                onClick={handleFeaturedToggle}
                disabled={featuredBusy}
                style={{
                  padding: '10px 24px',
                  backgroundColor: 'transparent',
                  color: website.featured ? 'var(--ym-accent)' : 'var(--ym-text-secondary)',
                  border: '1px solid var(--ym-border)',
                  borderRadius: 'var(--ym-radius-sm)',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: featuredBusy ? 'not-allowed' : 'pointer',
                  opacity: featuredBusy ? 0.5 : 1,
                  transition: 'all var(--ym-transition)',
                }}
              >
                {featuredBusy ? '处理中...' : website.featured ? '★ 取消编辑精选' : '☆ 设为编辑精选'}
              </button>
            )}
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

      <aside className="ym-detail-side">
        <div className="ym-section-block">
          <Link to={`/user/${website.user_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {website.avatar_url ? (
                <img className="ym-avatar ym-avatar-lg" src={website.avatar_url} alt={website.username} loading="lazy" decoding="async" />
              ) : (
                <span className="ym-avatar-fallback ym-avatar-lg" style={{ fontSize: '20px' }}>👤</span>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--ym-text-primary)' }}>{website.username}</div>
                <div style={{ fontSize: '13px', color: 'var(--ym-text-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {website.bio || '这位创作者还没有填写介绍'}
                </div>
              </div>
            </div>
          </Link>
          <Link to={`/user/${website.user_id}`} className="ym-btn ym-btn-ghost ym-btn-sm" style={{ marginTop: '14px', width: '100%' }}>
            查看主页
          </Link>
        </div>

        {topRated.length > 0 && (
          <div className="ym-section-block">
            <h3 className="ym-section-title" style={{ margin: '0 0 12px' }}>高分榜单</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topRated.map((site, i) => (
                <Link
                  key={site.id}
                  to={`/website/${site.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'inherit', textDecoration: 'none' }}
                >
                  <span style={{ flex: '0 0 22px', fontSize: '15px', fontWeight: '600', color: i < 3 ? 'var(--ym-accent)' : 'var(--ym-text-muted)', textAlign: 'center' }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: '0 0 72px', aspectRatio: '16/10', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'var(--ym-bg-subtle)' }}>
                    {site.image_url ? (
                      <img src={site.image_url} alt={site.title} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--ym-text-muted)' }}>
                        {(site.title || '网').trim()[0]}
                      </div>
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '13px', color: 'var(--ym-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginTop: '4px' }}>❤️ {site.like_count || 0}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
