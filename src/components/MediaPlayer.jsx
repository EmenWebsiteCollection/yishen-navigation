// src/components/MediaPlayer.jsx
// Issue #39 P2：内嵌视频/音频播放器 + 时间区间批注（时间轴标记/选区）
import React, { useRef, useState, useEffect } from 'react';
import { formatTime } from '../services/comment-logic.js';

export function MediaPlayer({ src, type = 'video', selectMode = false, onRangeSelect, markers = [] }) {
  const mediaRef = useRef(null);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const isVideo = type === 'video';

  useEffect(() => {
    setStart(null);
    setEnd(null);
  }, [selectMode]);

  const captureStart = () => {
    const t = mediaRef.current?.currentTime ?? 0;
    setStart(t);
    setEnd(null);
  };
  const captureEnd = () => {
    const t = mediaRef.current?.currentTime ?? 0;
    if (start == null) {
      setStart(t);
      return;
    }
    if (t < start) {
      setEnd(start);
      setStart(t);
    } else {
      setEnd(t);
    }
  };
  const commit = () => {
    if (start == null) return;
    onRangeSelect?.(Math.round(start), end != null ? Math.round(end) : null);
    setStart(null);
    setEnd(null);
  };

  const pct = (sec) => (duration > 0 ? (Math.min(Math.max(sec, 0), duration) / duration) * 100 : 0);

  return (
    <div>
      {isVideo ? (
        <video
          ref={mediaRef}
          src={src}
          controls
          playsInline
          preload="metadata"
          style={{ width: '100%', borderRadius: 'var(--ym-radius-sm)', backgroundColor: '#000', display: 'block' }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        />
      ) : (
        <audio
          ref={mediaRef}
          src={src}
          controls
          preload="metadata"
          style={{ width: '100%', display: 'block' }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        />
      )}

      {/* 时间轴 + 标记 */}
      <div style={{ marginTop: '8px', position: 'relative', height: '26px', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
        {/* 选中区间高亮 */}
        {start != null && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${pct(start)}%`,
              width: `${pct((end != null ? end : current) - start)}%`,
              backgroundColor: 'var(--ym-accent)',
              opacity: 0.35,
            }}
          />
        )}
        {/* 已有点评标记 */}
        {(markers || []).map((m) => (
          <div
            key={m.id}
            title={`${formatTime(m.start_sec)}${m.end_sec != null ? ' - ' + formatTime(m.end_sec) : ''}`}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${pct(m.start_sec)}%`,
              width: `${Math.max(3, pct((m.end_sec != null ? m.end_sec : m.start_sec + 1) - m.start_sec))}%`,
              backgroundColor: 'var(--ym-danger)',
              opacity: 0.8,
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (mediaRef.current && m.start_sec != null) mediaRef.current.currentTime = m.start_sec;
            }}
          />
        ))}
        {/* 播放进度 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: `${pct(current)}%`,
            backgroundColor: 'var(--ym-border-strong)',
            opacity: 0.4,
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'absolute', right: '6px', top: '4px', fontSize: '11px', color: 'var(--ym-text-muted)' }}>
          {formatTime(current)} / {formatTime(duration)}
        </div>
      </div>

      {selectMode && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px', fontSize: '13px' }}>
          <button
            onClick={captureStart}
            style={{ padding: '6px 14px', backgroundColor: 'var(--ym-accent)', color: 'var(--ym-accent-text-on)', border: 'none', borderRadius: 'var(--ym-radius-sm)', cursor: 'pointer', fontSize: '13px' }}
          >
            设置起点
          </button>
          <button
            onClick={captureEnd}
            style={{ padding: '6px 14px', backgroundColor: 'transparent', color: 'var(--ym-text-secondary)', border: '1px solid var(--ym-border)', borderRadius: 'var(--ym-radius-sm)', cursor: 'pointer', fontSize: '13px' }}
          >
            设置终点
          </button>
          <span style={{ color: 'var(--ym-text-muted)' }}>
            {start != null ? `起点 ${formatTime(start)}` : '先播放/拖动到想批注的时间点'}
            {end != null ? ` → 终点 ${formatTime(end)}` : ''}
          </span>
          {start != null && (
            <button
              onClick={commit}
              style={{ padding: '6px 14px', backgroundColor: 'var(--ym-success)', color: '#fff', border: 'none', borderRadius: 'var(--ym-radius-sm)', cursor: 'pointer', fontSize: '13px' }}
            >
              使用此区间
            </button>
          )}
        </div>
      )}
    </div>
  );
}
