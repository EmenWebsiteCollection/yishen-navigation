// src/components/ChatActionCard.jsx
// 依力 AI 3.0：聊天内结构化动作卡片
//   work_card  → 作品卡片（标题/类型/封面，点击跳详情）
//   idea_card  → 想法卡片（点击跳想法详情）
//   guide_card → 入口按钮（兼容旧 {label, to}）
// 样式走站点 --ym-* 变量，保持与网站 UI 一致（不贴干巴巴超链接）。
import React from 'react';
import { useNavigate } from 'react-router-dom';

const WORK_TYPE_ICON = {
  website: '🌐',
  novel: '📖',
  illustration: '🎨',
  game: '🎮',
  music: '🎵',
  video: '🎬',
  photo: '📷',
  other: '🧩',
};

function WorkActionCard({ a }) {
  const navigate = useNavigate();
  const icon = WORK_TYPE_ICON[a.workType] || '🌐';
  return (
    <button type="button" className="ym-chat-action-card" onClick={() => navigate(a.to)}>
      {a.image && (
        <img
          className="ym-chat-action-cover"
          src={a.image}
          alt=""
          loading="lazy"
          decoding="async"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <span className="ym-chat-action-icon" aria-hidden="true">{icon}</span>
      <span className="ym-chat-action-body">
        <span className="ym-chat-action-title">{a.title || '作品'}</span>
        {a.workType && <span className="ym-chat-action-sub">{a.workType}</span>}
      </span>
      <span className="ym-chat-action-go" aria-hidden="true">→</span>
    </button>
  );
}

function IdeaActionCard({ a }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="ym-chat-action-card" onClick={() => navigate(a.to)}>
      <span className="ym-chat-action-icon" aria-hidden="true">💡</span>
      <span className="ym-chat-action-body">
        <span className="ym-chat-action-title">{a.title || '想法'}</span>
        <span className="ym-chat-action-sub">想法集中营</span>
      </span>
      <span className="ym-chat-action-go" aria-hidden="true">→</span>
    </button>
  );
}

function GuideActionCard({ a }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="ym-chat-action" onClick={() => navigate(a.to)}>
      {a.label}
    </button>
  );
}

export function ChatActionCard({ action }) {
  if (!action) return null;
  // 旧契约 {label, to} → 一律按 guide 渲染
  if (action.type === 'work_card') return <WorkActionCard a={action} />;
  if (action.type === 'idea_card') return <IdeaActionCard a={action} />;
  return <GuideActionCard a={action} />;
}

export default ChatActionCard;
