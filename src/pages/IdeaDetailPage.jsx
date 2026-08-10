// src/pages/IdeaDetailPage.jsx
// Issue #12 想法详情：投票 / 关注 / 评论树 / 进展时间线 / 状态管理 / 孵化闭环 / 管理员合并
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { isAdmin as isAdminRpc } from '../services/works.js';
import { IdeaStatusBadge } from '../components/IdeaStatusBadge.jsx';
import { ThemeSelect } from '../components/ThemeSelect.jsx';
import {
  getIdeaById,
  getIdeaUpdates,
  getIdeaComments,
  createIdeaComment,
  deleteIdeaComment,
  toggleIdeaVote,
  toggleIdeaFavorite,
  updateIdeaStatus,
  addIdeaUpdate,
  mergeIdeas,
  exportIdeaToGithub,
} from '../services/ideas.js';
import { IDEA_STATUSES } from '../services/idea-logic.js';
import { getProfile } from '../services/users.js';
import '../styles/global.css';

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--ym-border)',
  borderRadius: 'var(--ym-radius-sm)',
  fontSize: '14px',
  backgroundColor: 'var(--ym-bg-card)',
  color: 'var(--ym-text-primary)',
  boxSizing: 'border-box',
  fontFamily: 'var(--ym-font-body)',
};

const smallBtn = {
  padding: '6px 14px',
  fontSize: '13px',
  border: '1px solid var(--ym-border)',
  borderRadius: 'var(--ym-radius-sm)',
  backgroundColor: 'var(--ym-bg-card)',
  color: 'var(--ym-text-secondary)',
  cursor: 'pointer',
  transition: 'all var(--ym-transition)',
};

// ---------- 进展时间线条目 ----------
const UpdateItem = ({ update }) => {
  const kindMeta = {
    status: { label: '状态', bg: 'var(--ym-bg-subtle)', color: 'var(--ym-accent)' },
    progress: { label: '进展', bg: 'var(--ym-success-bg)', color: 'var(--ym-success)' },
    merge: { label: '合并', bg: 'var(--ym-danger-bg)', color: 'var(--ym-danger)' },
  };
  const meta = kindMeta[update.kind] || kindMeta.progress;
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '12px 0', borderTop: '1px solid var(--ym-border)' }}>
      <span
        style={{
          flexShrink: 0,
          fontSize: '11px',
          padding: '2px 8px',
          borderRadius: '8px',
          backgroundColor: meta.bg,
          color: meta.color,
          height: 'fit-content',
          fontWeight: '500',
        }}
      >
        {meta.label}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', color: 'var(--ym-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {update.content}
        </div>
        <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--ym-text-muted)' }}>
          {update.username} · {new Date(update.created_at).toLocaleString('zh-CN')}
        </div>
      </div>
    </div>
  );
};

// ---------- 评论卡片（含回复，对齐作品详情页模式） ----------
const IdeaCommentCard = ({
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
}) => {
  const isOwner = currentUserId && (comment.user_id === currentUserId || isAdminUser);
  const isReply = Boolean(replyToUsername);
  return (
    <div style={{ padding: '14px 18px', backgroundColor: 'var(--ym-bg-card)', border: '1px solid var(--ym-border)', borderRadius: 'var(--ym-radius-sm)', marginBottom: '12px' }}>
      <div style={{ fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <Link to={`/user/${comment.user_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: 'var(--ym-text-primary)' }}>
          {comment.avatar_url ? (
            <img src={comment.avatar_url} alt="" loading="lazy" decoding="async" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
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
      <div style={{ color: 'var(--ym-text-secondary)', lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap', marginBottom: '8px' }}>
        {comment.content}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--ym-text-muted)' }}>
        <span>{new Date(comment.created_at).toLocaleString('zh-CN')}</span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {currentUserId && (
            <button onClick={() => onReplyClick(comment.id)} style={{ background: 'none', border: 'none', color: 'var(--ym-text-secondary)', cursor: 'pointer', fontSize: '13px' }}>
              回复
            </button>
          )}
          {isOwner && (
            <button onClick={() => onDelete(comment.id)} style={{ background: 'none', border: 'none', color: 'var(--ym-danger)', cursor: 'pointer', fontSize: '13px' }}>
              删除
            </button>
          )}
        </div>
      </div>
      {isReplying && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--ym-border)' }}>
          <textarea
            value={replyContent}
            onChange={(e) => onReplyContentChange(e.target.value)}
            placeholder={`回复 @${comment.username}...`}
            rows={2}
            disabled={replySubmitting}
            maxLength="1000"
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.4 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button onClick={onReplyCancel} disabled={replySubmitting} style={smallBtn}>取消</button>
            <button
              onClick={onReplySubmit}
              disabled={replySubmitting}
              style={{ padding: '6px 16px', fontSize: '13px', backgroundColor: 'var(--ym-accent)', color: 'var(--ym-accent-text-on)', border: 'none', borderRadius: 'var(--ym-radius-sm)', cursor: replySubmitting ? 'not-allowed' : 'pointer', opacity: replySubmitting ? 0.6 : 1 }}
            >
              {replySubmitting ? '发送中…' : '回复'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- 页面主体 ----------
export function IdeaDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAnonymous } = useAuth();
  const authed = user && !isAnonymous;

  const [idea, setIdea] = useState({});
  const [notFound, setNotFound] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notice, setNotice] = useState('');

  const [voteCount, setVoteCount] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const [hasFaved, setHasFaved] = useState(false);
  const [favToggling, setFavToggling] = useState(false);

  const [updates, setUpdates] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentContent, setCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const [newStatus, setNewStatus] = useState('idea');
  const [statusNote, setStatusNote] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [progressContent, setProgressContent] = useState('');
  const [progressSubmitting, setProgressSubmitting] = useState(false);
  const [mergeInput, setMergeInput] = useState('');
  const [mergeSubmitting, setMergeSubmitting] = useState(false);
  const [exportSubmitting, setExportSubmitting] = useState(false);

  const handleExportIssue = async () => {
    if (!isAdmin || exportSubmitting) return;
    const confirmed = window.confirm(
      '确认把这个想法导出为 GitHub Issue 吗？\n导出后会记录 issue 编号，不可重复导出。'
    );
    if (!confirmed) return;
    setExportSubmitting(true);
    setNotice('');
    try {
      const result = await exportIdeaToGithub(idea.id);
      setIdea((prev) => ({ ...prev, github_issue_number: result.issueNumber }));
      setNotice(`✅ 已导出为 GitHub Issue #${result.issueNumber}`);
    } catch (err) {
      setNotice(err.message || '导出失败');
    } finally {
      setExportSubmitting(false);
    }
  };

  const loadAll = useCallback(async () => {
    if (!id) return;
    setNotFound(false);
    try {
      const data = await getIdeaById(id, user?.id);
      if (!data) {
        setNotFound(true);
        return;
      }
      setIdea(data);
      setVoteCount(data.vote_count || 0);
      setFavCount(data.favorite_count || 0);
      setHasVoted(!!data.has_voted);
      setHasFaved(!!data.has_favorited);
      setNewStatus(data.status);
      const [u, c] = await Promise.all([getIdeaUpdates(id), getIdeaComments(id)]);
      setUpdates(u);
      setComments(c);
      if (user) {
        // is_admin 列已对客户端撤销 SELECT，改走 SECURITY DEFINER RPC
        const adminFlag = await isAdminRpc(user.id).catch(() => false);
        setIsAdmin(!!adminFlag);
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      console.error('加载想法详情失败:', err);
      setNotFound(true);
    }
  }, [id, user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const reloadComments = useCallback(async () => {
    if (!id) return;
    try {
      setComments(await getIdeaComments(id));
    } catch (err) {
      console.error('刷新评论失败:', err);
    }
  }, [id]);

  const canManage = idea && authed && (idea.user_id === user.id || isAdmin);

  // ---------- 互动 ----------
  const handleVote = async () => {
    if (!authed) {
      setNotice('请先登录后再投票');
      return;
    }
    if (voting) return;
    setVoting(true);
    setNotice('');
    try {
      const { voted } = await toggleIdeaVote(id, user.id);
      setHasVoted(voted);
      setVoteCount((p) => Math.max(0, p + (voted ? 1 : -1)));
    } catch (err) {
      setNotice(err.message || '投票失败');
    } finally {
      setVoting(false);
    }
  };

  const handleFavorite = async () => {
    if (!authed) {
      setNotice('请先登录后再关注想法');
      return;
    }
    if (favToggling) return;
    setFavToggling(true);
    setNotice('');
    try {
      const { favorited } = await toggleIdeaFavorite(id, user.id);
      setHasFaved(favorited);
      setFavCount((p) => Math.max(0, p + (favorited ? 1 : -1)));
    } catch (err) {
      setNotice(err.message || '操作失败');
    } finally {
      setFavToggling(false);
    }
  };

  // ---------- 状态变更 ----------
  const handleStatusChange = async (e) => {
    e.preventDefault();
    if (!canManage || statusSubmitting) return;
    setStatusSubmitting(true);
    setNotice('');
    try {
      await updateIdeaStatus(id, newStatus, statusNote, user.id);
      setStatusNote('');
      setNotice('✅ 状态已更新，并写入进展时间线');
      await loadAll();
    } catch (err) {
      setNotice(err.message || '更新失败');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // ---------- 补进展 ----------
  const handleProgress = async (e) => {
    e.preventDefault();
    if (!canManage || progressSubmitting) return;
    setProgressSubmitting(true);
    setNotice('');
    try {
      await addIdeaUpdate(id, progressContent, user.id);
      setProgressContent('');
      setNotice('✅ 进展已记录');
      setUpdates(await getIdeaUpdates(id));
    } catch (err) {
      setNotice(err.message || '记录失败');
    } finally {
      setProgressSubmitting(false);
    }
  };

  // ---------- 管理员合并 ----------
  const handleMerge = async (e) => {
    e.preventDefault();
    if (!isAdmin || mergeSubmitting) return;
    const sourceId = mergeInput.trim();
    if (!sourceId) {
      setNotice('请输入要合并的想法 ID');
      return;
    }
    setMergeSubmitting(true);
    setNotice('');
    try {
      await mergeIdeas(id, [sourceId], user.id);
      setMergeInput('');
      setNotice('✅ 合并完成：投票与评论已转移到本想法，源想法已关闭');
      await loadAll();
    } catch (err) {
      setNotice(err.message || '合并失败');
    } finally {
      setMergeSubmitting(false);
    }
  };

  // ---------- 评论 ----------
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!authed) {
      setNotice('请先登录后再评论');
      return;
    }
    const trimmed = commentContent.trim();
    if (!trimmed) {
      setNotice('评论不能为空');
      return;
    }
    setSubmitting(true);
    setNotice('');
    try {
      await createIdeaComment(id, user.id, trimmed);
      setCommentContent('');
      await reloadComments();
    } catch (err) {
      setNotice(err.message || '评论失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async () => {
    if (!authed || !replyingTo) return;
    const trimmed = replyContent.trim();
    if (!trimmed) {
      setNotice('回复不能为空');
      return;
    }
    setSubmittingReply(true);
    setNotice('');
    try {
      await createIdeaComment(id, user.id, trimmed, replyingTo);
      setReplyContent('');
      setReplyingTo(null);
      await reloadComments();
    } catch (err) {
      setNotice(err.message || '回复失败');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    const confirmed = window.confirm('确认删除该评论吗？（其下的回复会一并删除）');
    if (!confirmed) return;
    try {
      await deleteIdeaComment(commentId);
      await reloadComments();
      if (replyingTo === commentId) setReplyingTo(null);
    } catch (err) {
      setNotice('删除失败，请重试');
    }
  };

  const buildCommentTree = (list) => {
    const map = {};
    const roots = [];
    list.forEach((c) => (map[c.id] = { ...c, children: [] }));
    list.forEach((c) => {
      if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(map[c.id]);
      else roots.push(map[c.id]);
    });
    roots.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    roots.forEach((r) => r.children.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    return roots;
  };

  const renderCommentTree = (nodes, depth = 0) => {
    if (!nodes || nodes.length === 0) return null;
    return nodes.map((node) => {
      const replyToUsername = node.parent_id ? comments.find((c) => c.id === node.parent_id)?.username || null : null;
      return (
        <div key={node.id} style={{ marginLeft: depth > 0 ? '24px' : '0' }}>
          <IdeaCommentCard
            comment={node}
            currentUserId={user?.id}
            isAdminUser={isAdmin}
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
          {node.children && node.children.length > 0 && renderCommentTree(node.children, depth + 1)}
        </div>
      );
    });
  };

  // ---------- 渲染 ----------
  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--ym-bg-page)' }}>
        <div style={{ maxWidth: '560px', margin: '60px auto', padding: '32px 28px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-lg)', border: '1px solid var(--ym-border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--ym-danger)' }}>想法不存在</p>
          <Link to="/ideas" style={{ color: 'var(--ym-accent)', fontSize: '14px', textDecoration: 'none' }}>← 返回灵感</Link>
        </div>
      </div>
    );
  }
  const commentTree = buildCommentTree(comments);
  const showImplement = canManage && idea.status !== 'done' && idea.status !== 'closed';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--ym-bg-page)' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 20px 60px' }}>
        <div style={{ marginTop: '32px', marginBottom: '12px' }}>
          <Link to="/ideas" style={{ fontSize: '14px', color: 'var(--ym-text-secondary)', textDecoration: 'none' }}>← 返回灵感</Link>
        </div>

        {/* 主卡片 */}
        <div style={{ padding: '28px 26px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-lg)', border: '1px solid var(--ym-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <IdeaStatusBadge status={idea.status} />
            {idea.pinned && <span style={{ fontSize: '13px', color: 'var(--ym-accent)', fontWeight: '500' }}>📌 置顶</span>}
            <span style={{ fontSize: '13px', padding: '2px 10px', borderRadius: '10px', backgroundColor: 'var(--ym-bg-subtle)', color: 'var(--ym-text-secondary)' }}>
              {idea.category === 'other' ? '其他' : idea.category}
            </span>
          </div>

          <h1 style={{ margin: '0 0 14px', fontFamily: 'var(--ym-font-display)', fontSize: '24px', fontWeight: '500', color: 'var(--ym-text-primary)', letterSpacing: '0.5px', lineHeight: 1.4 }}>
            {idea.title}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', fontSize: '13px', color: 'var(--ym-text-muted)' }}>
            <Link to={`/user/${idea.user_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: 'var(--ym-text-secondary)' }}>
              {idea.avatar_url ? (
                <img src={idea.avatar_url} alt="" loading="lazy" decoding="async" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span style={{ display: 'inline-block', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--ym-bg-subtle)', textAlign: 'center', lineHeight: '24px', fontSize: '12px' }}>👤</span>
              )}
              {idea.username}
            </Link>
            <span>·</span>
            <span>{new Date(idea.created_at).toLocaleDateString('zh-CN')} 发布</span>
            {(idea.tags || []).map((t) => (
              <span key={t} style={{ color: 'var(--ym-text-muted)' }}>#{t}</span>
            ))}
          </div>

          {idea.description && (
            <p style={{ fontSize: '15px', lineHeight: 1.8, color: 'var(--ym-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 18px' }}>
              {idea.description}
            </p>
          )}

          {/* 关联作品（已实现回链） */}
          {idea.related_work_title && (
            <Link
              to={`/website/${idea.related_work_id}`}
              style={{ display: 'block', textDecoration: 'none', marginBottom: '16px', padding: '12px 16px', borderRadius: 'var(--ym-radius-sm)', backgroundColor: 'var(--ym-success-bg)', color: 'var(--ym-success)', fontSize: '14px' }}
            >
              🎉 已实现：作品「{idea.related_work_title}」→ 去看看
            </Link>
          )}

          {/* 操作区 */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
            <button
              type="button"
              onClick={handleVote}
              disabled={voting}
              style={{
                padding: '8px 18px',
                borderRadius: '20px',
                border: hasVoted ? 'none' : '1px solid var(--ym-border)',
                backgroundColor: hasVoted ? 'var(--ym-accent)' : 'var(--ym-bg-card)',
                color: hasVoted ? 'var(--ym-accent-text-on)' : 'var(--ym-text-secondary)',
                fontSize: '14px',
                cursor: voting ? 'not-allowed' : 'pointer',
                transition: 'all var(--ym-transition)',
              }}
            >
              {hasVoted ? '👍 已投票' : '👍 投票'} {voteCount}
            </button>
            <button
              type="button"
              onClick={handleFavorite}
              disabled={favToggling}
              style={{
                padding: '8px 18px',
                borderRadius: '20px',
                border: hasFaved ? 'none' : '1px solid var(--ym-border)',
                backgroundColor: hasFaved ? 'var(--ym-success)' : 'var(--ym-bg-card)',
                color: hasFaved ? 'var(--ym-success-text-on)' : 'var(--ym-text-secondary)',
                fontSize: '14px',
                cursor: favToggling ? 'not-allowed' : 'pointer',
                transition: 'all var(--ym-transition)',
              }}
            >
              {hasFaved ? '⭐ 已关注' : '⭐ 关注'} {favCount}
            </button>
            <span style={{ fontSize: '14px', color: 'var(--ym-text-muted)' }}>💬 {idea.comment_count} 条讨论</span>
            {showImplement && (
              <button
                type="button"
                onClick={() => navigate(`/create?source_idea_id=${idea.id}`)}
                style={{
                  marginLeft: 'auto',
                  padding: '8px 18px',
                  borderRadius: 'var(--ym-radius-sm)',
                  backgroundColor: 'var(--ym-success)',
                  color: 'var(--ym-success-text-on)',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                🚀 去实现这个想法
              </button>
            )}
          </div>

          {notice && (
            <div style={{ padding: '10px 14px', marginTop: '10px', borderRadius: 'var(--ym-radius-sm)', backgroundColor: notice.startsWith('✅') ? 'var(--ym-success-bg)' : 'var(--ym-danger-bg)', color: notice.startsWith('✅') ? 'var(--ym-success)' : 'var(--ym-danger)', fontSize: '14px' }}>
              {notice}
            </div>
          )}

          {/* 管理员合并 */}
          {isAdmin && (
            <form onSubmit={handleMerge} style={{ marginTop: '18px', padding: '14px 16px', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: 'var(--ym-radius-sm)' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '8px' }}>🛠 管理员：合并重复想法到本条</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={mergeInput} onChange={(e) => setMergeInput(e.target.value)} placeholder="粘贴要合并的想法 ID" style={inputStyle} />
                <button type="submit" disabled={mergeSubmitting} style={{ padding: '8px 16px', backgroundColor: 'var(--ym-danger)', color: '#fff', border: 'none', borderRadius: 'var(--ym-radius-sm)', fontSize: '13px', cursor: mergeSubmitting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                  {mergeSubmitting ? '合并中…' : '合并'}
                </button>
              </div>
            </form>
          )}

          {/* 管理员：一键导出 GitHub Issue */}
          {isAdmin && (
            <div style={{ marginTop: '18px', padding: '14px 16px', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: 'var(--ym-radius-sm)' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '8px' }}>🐙 管理员：导出到 GitHub Issue（进入开发队列）</div>
              {idea.github_issue_number ? (
                <a
                  href={`https://github.com/EmenWebsiteCollection/yishen-navigation/issues/${idea.github_issue_number}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '14px', color: 'var(--ym-accent)', textDecoration: 'none' }}
                >
                  ✅ 已导出 → Issue #{idea.github_issue_number} ↗
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleExportIssue}
                  disabled={exportSubmitting}
                  style={{ padding: '8px 16px', backgroundColor: 'var(--ym-accent)', color: 'var(--ym-accent-text-on)', border: 'none', borderRadius: 'var(--ym-radius-sm)', fontSize: '13px', cursor: exportSubmitting ? 'not-allowed' : 'pointer' }}
                >
                  {exportSubmitting ? '导出中…' : '一键导出为 GitHub Issue'}
                </button>
              )}
            </div>
          )}

          {/* 作者/管理员：状态变更 + 补进展 */}
          {canManage && (
            <div style={{ marginTop: '18px', padding: '16px', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: 'var(--ym-radius-sm)' }}>
              <form onSubmit={handleStatusChange}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '8px' }}>状态变更（会自动写入进展时间线）</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
                  <ThemeSelect className="ym-theme-select--compact" value={newStatus} onChange={setNewStatus} ariaLabel="想法状态" options={IDEA_STATUSES.map((s) => ({ value: s.id, label: s.label }))} />
                  <input
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder={newStatus === 'closed' ? '关闭理由（必填）' : '备注（可选）'}
                    style={{ ...inputStyle, flex: 1, minWidth: '160px' }}
                  />
                  <button type="submit" disabled={statusSubmitting} style={{ padding: '8px 18px', backgroundColor: 'var(--ym-accent)', color: 'var(--ym-accent-text-on)', border: 'none', borderRadius: 'var(--ym-radius-sm)', fontSize: '13px', cursor: statusSubmitting ? 'not-allowed' : 'pointer' }}>
                    {statusSubmitting ? '更新中…' : '更新状态'}
                  </button>
                </div>
              </form>
              <form onSubmit={handleProgress} style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '8px' }}>补充进展（作者 / 管理员）</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={progressContent} onChange={(e) => setProgressContent(e.target.value)} placeholder="例如：已找到开发伙伴，预计两周内出原型" maxLength="500" style={inputStyle} />
                  <button type="submit" disabled={progressSubmitting} style={{ padding: '8px 18px', backgroundColor: 'var(--ym-success)', color: 'var(--ym-success-text-on)', border: 'none', borderRadius: 'var(--ym-radius-sm)', fontSize: '13px', cursor: progressSubmitting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                    {progressSubmitting ? '记录中…' : '记录'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* 进展时间线 */}
        <div style={{ marginTop: '20px', padding: '22px 24px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-lg)', border: '1px solid var(--ym-border)' }}>
          <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--ym-font-display)', fontSize: '18px', fontWeight: '500', color: 'var(--ym-text-primary)' }}>📈 进展时间线</h2>
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--ym-text-muted)' }}>从灵感到实现的每一步都会被记录</p>
          {updates.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--ym-text-muted)', padding: '12px 0' }}>还没有进展记录</p>
          ) : (
            updates.map((u) => <UpdateItem key={u.id} update={u} />)
          )}
        </div>

        {/* 讨论 */}
        <div style={{ marginTop: '20px', padding: '22px 24px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-lg)', border: '1px solid var(--ym-border)' }}>
          <h2 style={{ margin: '0 0 14px', fontFamily: 'var(--ym-font-display)', fontSize: '18px', fontWeight: '500', color: 'var(--ym-text-primary)' }}>💬 讨论（{comments.length}）</h2>

          <form onSubmit={handleCommentSubmit} style={{ marginBottom: '18px' }}>
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder={authed ? '说说你的看法…' : '请先登录后再评论'}
              rows="3"
              maxLength="1000"
              disabled={!authed}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                type="submit"
                disabled={submitting || !authed}
                style={{ padding: '8px 22px', backgroundColor: 'var(--ym-accent)', color: 'var(--ym-accent-text-on)', border: 'none', borderRadius: 'var(--ym-radius-sm)', fontSize: '14px', cursor: submitting || !authed ? 'not-allowed' : 'pointer', opacity: submitting || !authed ? 0.6 : 1 }}
              >
                {submitting ? '发表中…' : '发表评论'}
              </button>
            </div>
          </form>

          {comments.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--ym-text-muted)' }}>还没有讨论，来抢沙发～</p>
          ) : (
            renderCommentTree(commentTree)
          )}
        </div>
      </div>
    </div>
  );
}
