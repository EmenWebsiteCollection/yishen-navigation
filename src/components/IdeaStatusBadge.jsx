// src/components/IdeaStatusBadge.jsx
import React from 'react';
import { ideaStatusLabel, IDEA_STATUS_COLOR } from '../services/idea-logic.js';

export function IdeaStatusBadge({ status, size = 'md' }) {
  const color = IDEA_STATUS_COLOR[status] || '#7A8794';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
        borderRadius: '10px',
        fontSize: size === 'sm' ? '11px' : '12px',
        fontWeight: '500',
        color: '#fff',
        backgroundColor: color,
        whiteSpace: 'nowrap',
      }}
    >
      {ideaStatusLabel(status)}
    </span>
  );
}
