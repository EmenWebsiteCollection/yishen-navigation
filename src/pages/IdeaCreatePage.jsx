// src/pages/IdeaCreatePage.jsx
// Issue #12 发布想法：低摩擦表单 + 发布前相似想法提示（防重复分裂票数）
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { PageHero } from '../components/PageHero.jsx';
import { IdeaStatusBadge } from '../components/IdeaStatusBadge.jsx';
import { createIdea, findSimilarIdeas } from '../services/ideas.js';
import { IDEA_CATEGORIES } from '../services/idea-logic.js';
import '../styles/global.css';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--ym-border)',
  borderRadius: 'var(--ym-radius-sm)',
  fontSize: '15px',
  backgroundColor: 'var(--ym-bg-card)',
  color: 'var(--ym-text-primary)',
  boxSizing: 'border-box',
  fontFamily: 'var(--ym-font-body)',
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  color: 'var(--ym-text-secondary)',
  marginBottom: '4px',
  fontWeight: '500',
};

export function IdeaCreatePage() {
  const { user, isAnonymous } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('website');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 相似想法提示（防重复）
  const [similar, setSimilar] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const q = title.trim();
    if (q.length < 2) {
      setSimilar([]);
      return;
    }
    setSimilarLoading(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const list = await findSimilarIdeas(q, { limit: 3 });
        setSimilar(list);
      } catch (err) {
        console.warn('相似想法查询失败:', err.message);
        setSimilar([]);
      } finally {
        setSimilarLoading(false);
      }
    }, 400);
  }, [title]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    if (!user) {
      setMessage({ type: 'error', text: '请先登录再发布想法。' });
      return;
    }
    if (isAnonymous) {
      setMessage({ type: 'error', text: '匿名账号不能发布想法，请先注册/登录。' });
      return;
    }
    setLoading(true);
    try {
      const created = await createIdea(
        {
          title,
          category,
          description,
          tags: tags.split(/[,，、\n]/).map((t) => t.trim()).filter(Boolean),
        },
        user.id
      );
      setMessage({ type: 'success', text: '✅ 想法发布成功！' });
      setTimeout(() => navigate(`/ideas/${created.id}`), 600);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '发布失败，请稍后重试。' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--ym-bg-page)' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 20px 60px' }}>
        <PageHero emoji="✍️" title="发布想法" subtitle="描述你的脑洞，别担心它太小——被看见的种子会发芽" />

        {isAnonymous && (
          <div style={{ padding: '12px 16px', marginBottom: '16px', borderRadius: 'var(--ym-radius-sm)', backgroundColor: 'var(--ym-danger-bg)', color: 'var(--ym-danger)', fontSize: '14px' }}>
            匿名账号不能发布想法，请先到首页 <Link to="/" style={{ color: 'var(--ym-accent)' }}>注册 / 登录</Link>。
          </div>
        )}

        {/* 相似想法提示 */}
        {(similar.length > 0 || similarLoading) && (
          <div style={{ padding: '14px 18px', marginBottom: '16px', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: 'var(--ym-radius-md)', border: '1px solid var(--ym-border)' }}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '8px' }}>
              {similarLoading ? '正在查找相似想法…' : '🔎 发现已有相似想法，建议先去看看，避免重复发帖'}
            </div>
            {!similarLoading &&
              similar.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderTop: '1px solid var(--ym-border)' }}>
                  <IdeaStatusBadge status={s.status} size="sm" />
                  <Link to={`/ideas/${s.id}`} style={{ flex: 1, fontSize: '14px', color: 'var(--ym-text-primary)', textDecoration: 'none' }}>
                    {s.title}
                  </Link>
                  <span style={{ fontSize: '12px', color: 'var(--ym-text-muted)' }}>👍 {s.vote_count}</span>
                </div>
              ))}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            padding: '28px 26px',
            backgroundColor: 'var(--ym-bg-card)',
            borderRadius: 'var(--ym-radius-lg)',
            border: '1px solid var(--ym-border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          }}
        >
          {message.text && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: '14px',
                borderRadius: 'var(--ym-radius-sm)',
                backgroundColor: message.type === 'error' ? 'var(--ym-danger-bg)' : 'var(--ym-success-bg)',
                color: message.type === 'error' ? 'var(--ym-danger)' : 'var(--ym-success)',
                fontSize: '14px',
              }}
            >
              {message.text}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="idea-title" style={labelStyle}>标题（必填，≤80 字）</label>
            <input
              id="idea-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="一句话说清你的想法，例如：给列表页加暗色模式"
              maxLength="80"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>分类</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {IDEA_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid var(--ym-border)',
                    backgroundColor: category === c.id ? 'var(--ym-accent)' : 'var(--ym-bg-card)',
                    color: category === c.id ? 'var(--ym-accent-text-on)' : 'var(--ym-text-secondary)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'all var(--ym-transition)',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="idea-desc" style={labelStyle}>详细描述（可选，≤2000 字）</label>
            <textarea
              id="idea-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="补充背景、使用场景、你想怎么实现…"
              rows="5"
              maxLength="2000"
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="idea-tags" style={labelStyle}>标签（可选，逗号分隔，最多 10 个）</label>
            <input
              id="idea-tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="例如：AI, 搜索, 移动端"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Link to="/ideas" style={{ fontSize: '14px', color: 'var(--ym-text-secondary)', textDecoration: 'none' }}>
              ← 返回想法列表
            </Link>
            <button
              type="submit"
              disabled={loading || isAnonymous}
              style={{
                padding: '10px 32px',
                backgroundColor: 'var(--ym-accent)',
                color: 'var(--ym-accent-text-on)',
                border: 'none',
                borderRadius: 'var(--ym-radius-sm)',
                fontSize: '15px',
                fontWeight: '500',
                cursor: loading || isAnonymous ? 'not-allowed' : 'pointer',
                opacity: loading || isAnonymous ? 0.6 : 1,
              }}
            >
              {loading ? '发布中…' : '发布想法'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
