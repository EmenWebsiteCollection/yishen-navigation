// src/pages/WorkMapPage.jsx
// Issue #39 P1：灵感地图 —— 以当前作品为中心的创作关系节点图
// 数据 = work_relations 显式关系（衍生/改编/同灵感/合作）+ 标签/风格/工具重叠自动相似边
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getWorkById } from '../services/works.js';
import { getWorkRelations, getDiscoveryRail, RELATION_TYPES } from '../services/discovery.js';
import { workTypeLabel } from '../services/works.js';
import '../styles/global.css';

const W = 860;
const H = 620;
const CX = W / 2;
const CY = H / 2;
const R1 = 170; // 显式关系环
const R2 = 300; // 相似关系环

const TYPE_EMOJI = {
  website: '🌐', novel: '📖', illustration: '🎨', game: '🎮',
  music: '🎵', video: '🎬', photo: '📷', other: '✨',
};

const relLabel = (type, isSource) => {
  const def = RELATION_TYPES.find((r) => r.id === type);
  if (!def) return type;
  return isSource ? def.label : def.reverse;
};

export function WorkMapPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [work, setWork] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nodes, setNodes] = useState([]); // {id,title,work_type,relationLabel,group}

  const loadMap = useCallback(async () => {
    try {
      const w = await getWorkById(id);
      if (!w) {
        setError('作品不存在');
        return;
      }
      setWork(w);

      // 显式关系
      const rels = await getWorkRelations(id);
      const explicit = [];
      const neighborIds = new Set();
      for (const r of rels) {
        const isSource = r.source_work_id === id;
        const nid = isSource ? r.target_work_id : r.source_work_id;
        explicit.push({ nid, label: relLabel(r.relation_type, isSource) });
        neighborIds.add(nid);
      }
      // 拉取关系邻居的标题/类型
      const neighborWorks = {};
      await Promise.all(
        [...neighborIds].map(async (nid) => {
          try {
            const nw = await getWorkById(nid);
            if (nw) neighborWorks[nid] = nw;
          } catch (_) { /* 忽略单个失败 */ }
        })
      );

      // 自动相似（标签/风格/工具重叠）
      let similar = [];
      try {
        similar = await getDiscoveryRail('similar', { workId: id, limit: 8, maxPerAuthor: 8 });
      } catch (e) {
        console.warn('相似 rail 加载失败:', e.message);
      }
      const similarNodes = similar
        .filter((s) => !neighborIds.has(s.id))
        .map((s) => ({
          id: s.id,
          title: s.title,
          work_type: s.work_type,
          relationLabel: '相似风格/主题/工具',
          group: 'similar',
        }));

      const explicitNodes = explicit
        .filter((x) => neighborWorks[x.nid])
        .map((x) => {
          const nw = neighborWorks[x.nid];
          return {
            id: nw.id,
            title: nw.title,
            work_type: nw.work_type,
            relationLabel: x.label,
            group: 'explicit',
          };
        });

      setNodes([...explicitNodes, ...similarNodes].slice(0, 16));
    } catch (e) {
      console.error(e);
      setError('加载灵感地图失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadMap(); }, [loadMap]);

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '80px', color: 'var(--ym-text-secondary)' }}>加载灵感地图...</div>;
  }

  if (error) {
    return (
      <div style={{ maxWidth: '560px', margin: '80px auto', textAlign: 'center', color: 'var(--ym-danger)' }}>
        <p>{error}</p>
        <Link to="/" style={{ color: 'var(--ym-accent)', fontSize: '14px' }}>返回首页</Link>
      </div>
    );
  }

  if (!work) {
    return (
      <div style={{ maxWidth: '560px', margin: '80px auto', textAlign: 'center', color: 'var(--ym-text-secondary)' }}>
        <p>作品不存在</p>
        <Link to="/" style={{ color: 'var(--ym-accent)', fontSize: '14px' }}>返回首页</Link>
      </div>
    );
  }

  // 节点布局：中心 + 显式环 + 相似环
  const explicitNodes = nodes.filter((n) => n.group === 'explicit');
  const similarNodes = nodes.filter((n) => n.group === 'similar');
  const ring1 = explicitNodes.length > 0 ? explicitNodes : similarNodes;
  const ring2 = explicitNodes.length > 0 ? similarNodes : [];
  const positions = {};
  ring1.forEach((n, i) => {
    const ang = (i / Math.max(ring1.length, 1)) * Math.PI * 2 - Math.PI / 2;
    positions[n.id] = { x: CX + R1 * Math.cos(ang), y: CY + R1 * Math.sin(ang), group: n.group };
  });
  ring2.forEach((n, i) => {
    const ang = (i / Math.max(ring2.length, 1)) * Math.PI * 2 - Math.PI / 2;
    positions[n.id] = { x: CX + R2 * Math.cos(ang), y: CY + R2 * Math.sin(ang), group: n.group };
  });

  const edgeColor = (group) => (group === 'explicit' ? 'var(--ym-accent)' : 'var(--ym-text-muted)');

  return (
    <div style={{ maxWidth: '960px', margin: '32px auto', padding: '0 20px 60px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to={`/website/${work.id}`} style={{ color: 'var(--ym-text-secondary)', fontSize: '14px', textDecoration: 'none' }}>
          ← 返回作品
        </Link>
      </div>
      <h1 style={{ fontFamily: 'var(--ym-font-display)', fontSize: '24px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '6px' }}>
        🗺️ 灵感地图：{work.title}
      </h1>
      <p style={{ color: 'var(--ym-text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
        中心是当前作品。橙色连线 = 显式声明的关系（衍生/改编/同灵感/合作）；灰色连线 = 依据标签/风格/工具自动发现的相似作品。
      </p>

      {nodes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-md)', border: '1px solid var(--ym-border)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌱</div>
          <div style={{ fontSize: '15px', color: 'var(--ym-text-primary)', marginBottom: '8px' }}>还没有发现与这件作品相关联的创作</div>
          <div style={{ fontSize: '13px', color: 'var(--ym-text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
            在作品详情页为它补充「标签 / 风格 / 工具」字段，或由作者在详情页显式声明「衍生 / 改编 / 同一灵感」关系，地图就会慢慢长出来。
          </div>
          <Link to={`/website/${work.id}/edit`} style={{ color: 'var(--ym-accent)', fontSize: '14px' }}>去补充作品信息 →</Link>
        </div>
      ) : (
        <div style={{ backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-md)', border: '1px solid var(--ym-border)', overflow: 'hidden' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* 边 */}
            {nodes.map((n) => {
              const p = positions[n.id];
              if (!p) return null;
              const midX = (CX + p.x) / 2;
              const midY = (CY + p.y) / 2 - 10;
              return (
                <g key={`edge-${n.id}`}>
                  <line x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={edgeColor(p.group)} strokeWidth="1.5" strokeDasharray={p.group === 'similar' ? '5 4' : '0'} />
                  <text x={midX} y={midY} textAnchor="middle" fontSize="11" fill="var(--ym-text-muted)">
                    {n.relationLabel}
                  </text>
                </g>
              );
            })}
            {/* 中心节点 */}
            <circle cx={CX} cy={CY} r="34" fill="var(--ym-accent)" />
            <text x={CX} y={CY + 5} textAnchor="middle" fontSize="26">{TYPE_EMOJI[work.work_type] || '✨'}</text>
            <text x={CX} y={CY + 52} textAnchor="middle" fontSize="13" fill="var(--ym-text-primary)" fontWeight="500">
              {work.title.length > 12 ? work.title.slice(0, 12) + '…' : work.title}
            </text>

            {/* 关联节点 */}
            {nodes.map((n) => {
              const p = positions[n.id];
              if (!p) return null;
              const isExpl = p.group === 'explicit';
              return (
                <g
                  key={`node-${n.id}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/website/${n.id}`)}
                >
                  <circle cx={p.x} cy={p.y} r="26" fill={isExpl ? 'var(--ym-bg-card)' : 'var(--ym-bg-subtle)'} stroke={edgeColor(p.group)} strokeWidth="2" />
                  <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="20">{TYPE_EMOJI[n.work_type] || '✨'}</text>
                  <text x={p.x} y={p.y + 46} textAnchor="middle" fontSize="12" fill="var(--ym-text-secondary)">
                    {n.title.length > 10 ? n.title.slice(0, 10) + '…' : n.title}
                  </text>
                  <text x={p.x} y={p.y + 62} textAnchor="middle" fontSize="10" fill="var(--ym-text-muted)">
                    {workTypeLabel(n.work_type)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--ym-text-muted)', lineHeight: 1.6 }}>
        💡 点击任意节点可跳转到对应作品。显式关系需作品作者在详情页声明。
      </div>
    </div>
  );
}
