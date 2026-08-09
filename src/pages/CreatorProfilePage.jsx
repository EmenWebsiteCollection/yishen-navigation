// src/pages/CreatorProfilePage.jsx
// 创作者主页（公开）：品牌展示 + 统计 + 作品集 + 创作时间线
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getProfile, getCreatorStats } from '../services/users.js';
import { getWorksByUser, workTypeLabel } from '../services/works.js';

import { getPartitions } from '../services/partitions.js';
import '../styles/global.css';

const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"%3E%3Crect width="128" height="128" fill="%23EDE3CC"/%3E%3Ctext x="64" y="78" font-family="Arial" font-size="44" fill="%239C6B2E" text-anchor="middle"%3E?%3C/text%3E%3C/svg%3E';

const TagChip = ({ children }) => (
  <span style={{
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: 'var(--ym-bg-subtle)',
    color: 'var(--ym-text-secondary)',
    borderRadius: '20px',
    fontSize: '13px',
  }}>
    {children}
  </span>
);

const SectionTitle = ({ children }) => (
  <h2 style={{
    fontFamily: 'var(--ym-font-display)',
    fontSize: '18px',
    fontWeight: '500',
    color: 'var(--ym-text-primary)',
    margin: '28px 0 14px',
    letterSpacing: '0.5px',
  }}>
    {children}
  </h2>
);

const WorkCard = ({ work }) => (
  <Link
    to={`/website/${work.id}`}
    style={{
      display: 'block',
      border: '1px solid var(--ym-border)',
      borderRadius: 'var(--ym-radius-md)',
      backgroundColor: 'var(--ym-bg-card)',
      overflow: 'hidden',
      textDecoration: 'none',
      transition: 'transform var(--ym-transition), border-color var(--ym-transition)',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'var(--ym-border-strong)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--ym-border)'; }}
  >
    <div style={{ aspectRatio: '16/9', backgroundColor: 'var(--ym-bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ym-text-muted)', fontSize: '12px' }}>
      {work.image_url ? (
        <img src={work.image_url} alt={work.title} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        workTypeLabel(work.work_type)
      )}
    </div>
    <div style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--ym-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {work.title}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginTop: '4px' }}>
        {workTypeLabel(work.work_type)} · ❤️ {work.like_count} · {new Date(work.created_at).toLocaleDateString('zh-CN')}
      </div>
    </div>
  </Link>
);

export function CreatorProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ work_count: 0, like_count: 0, favorite_count: 0, comment_count: 0 });
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isSelf = user && user.id === id;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const p = await getProfile(id);
      if (!p) {
        setError('用户不存在');
        return;
      }
      setProfile(p);
      const [s, { works: list }] = await Promise.all([
        getCreatorStats(id),
        getWorksByUser(id, { currentUserId: user?.id, pageSize: 100 }),
      ]);
      getPartitions().catch(() => {});
      setStats(s);
      setWorks(list);
    } catch (err) {
      console.error('加载创作者主页失败:', err);
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => { load(); }, [load]);

  // 应用用户装扮色（背景/强调色），离开时还原
  useEffect(() => {
    const root = document.documentElement;
    const prevBg = root.style.getPropertyValue('--ym-bg-page');
    const prevAccent = root.style.getPropertyValue('--ym-accent');
    if (profile?.bg_color) root.style.setProperty('--ym-bg-page', profile.bg_color);
    if (profile?.accent_color) root.style.setProperty('--ym-accent', profile.accent_color);
    return () => {
      if (profile?.bg_color) root.style.setProperty('--ym-bg-page', prevBg);
      if (profile?.accent_color) root.style.setProperty('--ym-accent', prevAccent);
    };
  }, [profile?.bg_color, profile?.accent_color]);

  if (error || (!loading && !profile)) {
    return (
      <div style={{ maxWidth: '560px', margin: '60px auto', padding: '32px 28px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-lg)', border: '1px solid var(--ym-border)', textAlign: 'center' }}>
        <p style={{ color: 'var(--ym-danger)' }}>{error || '用户不存在'}</p>
        <Link to="/" style={{ color: 'var(--ym-accent)', fontSize: '14px', marginTop: '12px', display: 'inline-block', textDecoration: 'none' }}>返回首页</Link>
      </div>
    );
  }
  // 加载中渲染空壳
  if (!profile) return <div />;

  const username = profile.username || '未命名用户';
  const featuredWorks = works.filter((w) => w.featured).slice(0, 6);
  const timeline = works.reduce((acc, w) => {
    const year = new Date(w.created_at).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(w);
    return acc;
  }, {});
  const years = Object.keys(timeline).sort((a, b) => Number(b) - Number(a));
  const socials = profile.socials || [];

  return (
    <div>
      {/* 封面横幅 */}
      <div className="ym-space-cover">
        {profile.cover_url ? (
          <img src={profile.cover_url} alt="封面" decoding="async" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ym-text-muted)', fontSize: '14px' }}>
            创作者主页
          </div>
        )}
      </div>

      <div className="ym-space-body">
        {/* 头部：头像 + 用户名 + 介绍 */}
        <div className="ym-space-head">
          <div className="ym-space-avatar">
            <img
              src={profile.avatar_url || DEFAULT_AVATAR}
              alt={username}
              decoding="async"
              onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
            />
          </div>
          <div className="ym-space-head-info" style={{ flex: 1, minWidth: '220px', paddingBottom: '4px' }}>
            <h1 style={{ fontFamily: 'var(--ym-font-display)', fontSize: '24px', fontWeight: '500', color: 'var(--ym-text-primary)', margin: 0 }}>
              {username}
            </h1>
            {profile.bio && (
              <p style={{ fontSize: '14px', color: 'var(--ym-text-secondary)', margin: '6px 0 0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {profile.bio}
              </p>
            )}
          </div>
          {isSelf && (
            <Link to="/profile" className="ym-btn ym-btn-primary ym-btn-sm">
              编辑资料
            </Link>
          )}
        </div>

        {/* 画像标签 */}
        {(profile.expertise?.length || profile.tools?.length || profile.style_tags?.length) ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
            {profile.expertise?.map((t) => <TagChip key={t}>擅长·{t}</TagChip>)}
            {profile.tools?.map((t) => <TagChip key={t}>工具·{t}</TagChip>)}
            {profile.style_tags?.map((t) => <TagChip key={t}>风格·{t}</TagChip>)}
          </div>
        ) : null}

        {/* 统计卡 */}
        <div className="ym-stats">
          {[
            { label: '作品', value: stats.work_count },
            { label: '获赞', value: stats.like_count },
            { label: '被收藏', value: stats.favorite_count },
            { label: '评论', value: stats.comment_count },
          ].map((s) => (
            <div key={s.label} className="ym-stat">
              <b>{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* 状态与商务信息 */}
        {(profile.collab_status || profile.commission_status || profile.current_project || profile.services) ? (
          <>
            <SectionTitle>状态与合作</SectionTitle>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <TagChip>合作：{profile.collab_status === 'open' ? '开放' : profile.collab_status === 'limited' ? '有限' : '暂不合作'}</TagChip>
              <TagChip>委托：{profile.commission_status === 'open' ? '接受中' : '暂不接受'}</TagChip>
              {profile.website_link && <TagChip>🛍 {profile.website_link}</TagChip>}
            </div>
            {profile.current_project && (
              <div style={{ padding: '14px 16px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-md)', border: '1px solid var(--ym-border)', marginBottom: '10px' }}>
                <div style={{ fontSize: '14px', color: 'var(--ym-text-primary)', marginBottom: '8px' }}>
                  当前项目：{profile.current_project}
                </div>
                <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--ym-bg-subtle)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, profile.creation_progress || 0))}%`, height: '100%', backgroundColor: 'var(--ym-accent)' }} />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginTop: '6px' }}>
                  创作进度 {profile.creation_progress || 0}%
                </div>
              </div>
            )}
            {profile.services && (
              <div style={{ fontSize: '14px', color: 'var(--ym-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                可提供服务：{profile.services}
              </div>
            )}
          </>
        ) : null}

        {/* 外链 */}
        {(socials.length > 0 || profile.website_link) ? (
          <>
            <SectionTitle>外链</SectionTitle>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {socials.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noreferrer" style={{ padding: '6px 14px', backgroundColor: 'var(--ym-bg-card)', border: '1px solid var(--ym-border)', borderRadius: 'var(--ym-radius-sm)', color: 'var(--ym-text-secondary)', textDecoration: 'none', fontSize: '13px' }}>
                  {s.platform || '链接'} ↗
                </a>
              ))}
              {profile.website_link && (
                <a href={profile.website_link} target="_blank" rel="noreferrer" style={{ padding: '6px 14px', backgroundColor: 'var(--ym-bg-card)', border: '1px solid var(--ym-border)', borderRadius: 'var(--ym-radius-sm)', color: 'var(--ym-text-secondary)', textDecoration: 'none', fontSize: '13px' }}>
                  个人网站 / 商店 ↗
                </a>
              )}
            </div>
          </>
        ) : null}

        {/* 代表作品 */}
        {featuredWorks.length > 0 && (
          <>
            <SectionTitle>⭐ 代表作品</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
              {featuredWorks.map((w) => <WorkCard key={w.id} work={w} />)}
            </div>
          </>
        )}

        {/* 完整作品集 / 创作时间线 */}
        <SectionTitle>作品集 · 创作时间线</SectionTitle>
        {works.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ym-text-muted)' }}>还没有公开作品</div>
        ) : (
          years.map((year) => (
            <div key={year} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontFamily: 'var(--ym-font-display)', fontSize: '16px', color: 'var(--ym-text-primary)', fontWeight: '500' }}>{year}</span>
                <span style={{ flex: 1, height: '1px', backgroundColor: 'var(--ym-border)' }} />
                <span style={{ fontSize: '12px', color: 'var(--ym-text-muted)' }}>{timeline[year].length} 件</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
                {timeline[year].map((w) => <WorkCard key={w.id} work={w} />)}
              </div>
            </div>
          ))
        )}

        {/* 成就与平台记录 */}
        <SectionTitle>成就与平台记录</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {[
            { label: '加入时间', value: profile.created_at ? new Date(profile.created_at).toLocaleDateString('zh-CN') : '-' },
            { label: '公开作品', value: stats.work_count },
            { label: '累计获赞', value: stats.like_count },
            { label: '被收藏', value: stats.favorite_count },
            { label: '作品评论', value: stats.comment_count },
          ].map((s) => (
            <div key={s.label} style={{ padding: '12px 14px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-md)', border: '1px solid var(--ym-border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--ym-text-secondary)' }}>{s.label}</div>
              <div style={{ fontSize: '16px', color: 'var(--ym-text-primary)', marginTop: '4px', fontWeight: '500' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
