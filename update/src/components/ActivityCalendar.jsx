// src/components/ActivityCalendar.jsx
// 活跃度日历：GitHub 风格活动热力图（默认最近 6 个月，可向前/向后翻页）
// 数据口径：评论 + 回复（comments.created_at）+ 投稿 + 编辑（works.created_at/updated_at）
// 颜色自适应主题（var(--ym-accent) + color-mix 分级，明暗主题通用）
import React, { useEffect, useMemo, useState } from 'react';
import { getUserActivityDates } from '../services/works.js';

// ---------- 纯逻辑（可测） ----------
// 本地时区 YYYY-MM-DD
export const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 按天加权聚合：
//   创作行为 2 点：works 投稿/编辑、comments 评论/回复、ideas 发布想法、
//                  idea_comments 想法评论/回复、idea_updates 想法进展
//   轻量互动 1 点：likes 点赞、favorites 收藏作品、follows 关注、
//                  ideaVotes 想法投票、ideaFavorites 收藏想法、feedback 评论评价
export const aggregateActivity = (data = {}) => {
  const byDay = {};
  const add = (ts, weight) => {
    if (!ts) return;
    const k = dayKey(ts);
    byDay[k] = (byDay[k] || 0) + weight;
  };
  // 创作 2 点
  for (const r of data.works || []) {
    add(r.created_at, 2);
    if (r.updated_at && dayKey(r.updated_at) !== dayKey(r.created_at)) add(r.updated_at, 2);
  }
  for (const r of data.comments || []) add(r.created_at, 2);
  for (const r of data.ideas || []) add(r.created_at, 2);
  for (const r of data.ideaComments || []) add(r.created_at, 2);
  for (const r of data.ideaUpdates || []) add(r.created_at, 2);
  // 轻量 1 点
  for (const r of data.likes || []) add(r.created_at, 1);
  for (const r of data.favorites || []) add(r.created_at, 1);
  for (const r of data.follows || []) add(r.created_at, 1);
  for (const r of data.ideaVotes || []) add(r.created_at, 1);
  for (const r of data.ideaFavorites || []) add(r.created_at, 1);
  for (const r of data.feedback || []) add(r.created_at, 1);
  return byDay;
};

// 生成日期矩阵：weeks[w][d]，d=0 周一 ~ d=6 周日
// 固定分组：每 6 个月（26 周）一组；offset=0 最新一组，1 = 往前推 6 个月……
export const buildWeeks = (today = new Date(), weeks = 26, offset = 0) => {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const dow = (t.getDay() + 6) % 7; // 周一 = 0
  const thisMonday = new Date(t);
  thisMonday.setDate(t.getDate() - dow);
  const endMonday = new Date(thisMonday);
  endMonday.setDate(thisMonday.getDate() - offset * weeks * 7);
  const start = new Date(endMonday);
  start.setDate(endMonday.getDate() - (weeks - 1) * 7);
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      col.push(day);
    }
    cols.push(col);
  }
  return cols;
};

// 活跃度点数 → 颜色档位（0 / 1-2 / 3-4 / 5-6 / 7+）
export const activityLevel = (count) => {
  if (!count) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
};

// 颜色分级：主题自适应（accent 透明度递进）
const LEVEL_BG = [
  'var(--ym-bg-subtle)',
  'color-mix(in srgb, var(--ym-accent) 22%, transparent)',
  'color-mix(in srgb, var(--ym-accent) 45%, transparent)',
  'color-mix(in srgb, var(--ym-accent) 72%, transparent)',
  'var(--ym-accent)',
];

const CELL = 9; // 格子边长 px
const GAP = 2; // 格子间距 px

// 窗口起止日期的中文显示（不含未来日）
export const windowRangeLabel = (weeks) => {
  if (!weeks || !weeks.length) return '';
  const first = weeks[0][0];
  const lastCol = weeks[weeks.length - 1];
  const last = lastCol[lastCol.length - 1];
  const fmt = (d) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(first)} ~ ${fmt(last)}`;
};

// ---------- 组件 ----------
export default function ActivityCalendar({ userId }) {
  const [byDay, setByDay] = useState({});
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0); // 0 = 最新半年；>0 = 往前翻

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getUserActivityDates(userId).then((rows) => {
      if (cancelled) return;
      setByDay(aggregateActivity(rows || {}));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const weeks = useMemo(() => buildWeeks(new Date(), 26, offset), [offset]);
  // 只统计当前展示窗口（weeks）内的活跃度，翻页后随之变化
  const total = useMemo(() => {
    let sum = 0;
    for (const col of weeks) {
      for (const day of col) {
        const k = dayKey(day);
        if (byDay[k]) sum += byDay[k];
      }
    }
    return sum;
  }, [weeks, byDay]);
  const hasAny = total > 0;
  const rangeLabel = windowRangeLabel(weeks);
  const colCount = weeks.length;

  // 月份标签：该列（周一）月份与上一列不同则显示
  const monthLabels = useMemo(() => {
    const labels = [];
    let prevMonth = null;
    for (const col of weeks) {
      const m = col[0].getMonth();
      const y = col[0].getFullYear();
      const key = `${y}-${m}`;
      labels.push(key !== prevMonth ? { y, m, label: `${m + 1}月` } : null);
      prevMonth = key;
    }
    return labels;
  }, [weeks]);

  const WEEKDAY_MARKS = ['一', '', '三', '', '五', '', '日'];

  return (
    <div className="ym-activity-calendar">
      <div className="ym-activity-calendar__head">
        <span>🔥 活跃度日历</span>
        <div className="ym-activity-calendar__nav">
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            title="查看更早的半年"
            aria-label="查看更早的半年"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={offset === 0}
            title="查看更新的半年"
            aria-label="查看更新的半年"
          >
            ↓
          </button>
        </div>
      </div>

      <div className="ym-activity-calendar__body">
        {/* 星期标签列 */}
        <div className="ym-activity-calendar__weekdays">
          {WEEKDAY_MARKS.map((w, i) => (
            <span key={i} className="ym-activity-calendar__wd">
              {w}
            </span>
          ))}
        </div>

        <div className="ym-activity-calendar__main">
          {/* 月份行 */}
          <div
            className="ym-activity-calendar__months"
            style={{ gridTemplateColumns: `repeat(${colCount}, 9px)` }}
          >
            {weeks.map((col, wi) => {
              const lbl = monthLabels[wi];
              return (
                <div key={wi} className="ym-activity-calendar__month-cell">
                  {lbl && <span>{lbl.label}</span>}
                </div>
              );
            })}
          </div>

          {/* 热力格子：未来日期留空白 */}
          <div
            className="ym-activity-calendar__grid"
            style={{ gridTemplateColumns: `repeat(${colCount}, 9px)` }}
          >
            {weeks.map((col, wi) =>
              col.map((day, di) => {
                const k = dayKey(day);
                const count = byDay[k] || 0;
                const lv = activityLevel(count);
                const tip = `${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日 · ${count} 次更新`;
                const isFuture = day.getTime() > Date.now();
                return (
                  <div
                    key={`${wi}-${di}`}
                    className="ym-activity-calendar__cell"
                    title={isFuture ? '' : tip}
                    style={{
                      backgroundColor: isFuture ? 'transparent' : LEVEL_BG[lv],
                      border: isFuture ? '1px solid var(--ym-border)' : 'none',
                      opacity: loading ? 0.4 : 1,
                    }}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="ym-activity-calendar__foot">
        <span className="ym-activity-calendar__total">
          {rangeLabel}
          {loading
            ? ' · 加载中…'
            : hasAny
              ? ` · ${total} 点活跃度`
              : ' · 无活跃度'}
        </span>
        <span className="ym-activity-calendar__legend">
          少
          {LEVEL_BG.map((bg, i) => (
            <i key={i} style={{ backgroundColor: bg }} />
          ))}
          多
        </span>
      </div>
    </div>
  );
}
