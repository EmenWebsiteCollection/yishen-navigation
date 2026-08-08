import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { getPartitions, createPartition, deletePartition } from '../services/partitions.js';

export function PartitionManager({ open, onClose, onChanged }) {
  const { user, isAnonymous } = useAuth();
  const [partitions, setPartitions] = useState([]);
  const [name, setName] = useState('');
  const [workType, setWorkType] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const isLoggedIn = Boolean(user && !isAnonymous);

  const load = async () => {
    try {
      setPartitions(await getPartitions());
    } catch (err) {
      setMessage(err.message || '加载分区失败');
    }
  };

  useEffect(() => {
    if (open) {
      setMessage('');
      load();
    }
  }, [open]);

  if (!open) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!isLoggedIn) {
      setMessage('请先登录后再添加分区');
      return;
    }
    setBusy(true);
    try {
      await createPartition({ name, workType }, user.id);
      setName('');
      setWorkType('');
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      setMessage(err.message || '添加分区失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (partition) => {
    if (!window.confirm(`确认删除分区「${partition.name}」吗？`)) return;
    setMessage('');
    try {
      await deletePartition(partition.id);
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      setMessage(err.message || '删除分区失败');
    }
  };

  return (
    <div className="ym-modal-backdrop" onClick={onClose}>
      <div className="ym-modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ym-text-primary)', marginBottom: '16px' }}>
          管理分区
        </h3>

        {!isLoggedIn ? (
          <div className="ym-alert ym-alert-error">请先登录后再管理分区。</div>
        ) : (
          <form onSubmit={handleCreate} style={{ marginBottom: '18px' }}>
            <div className="ym-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="ym-form-field">
                <label className="ym-form-label" htmlFor="partition-name">分区名称</label>
                <input id="partition-name" className="ym-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：设计" maxLength="20" required />
              </div>
              <div className="ym-form-field">
                <label className="ym-form-label" htmlFor="partition-type">类型标识</label>
                <input id="partition-type" className="ym-input" value={workType} onChange={(e) => setWorkType(e.target.value)} placeholder="如：design" maxLength="30" required />
              </div>
            </div>
            <button type="submit" className="ym-btn ym-btn-primary" disabled={busy} style={{ width: '100%' }}>
              {busy ? '添加中...' : '+ 添加分区'}
            </button>
          </form>
        )}

        {message && <div className="ym-alert ym-alert-error" style={{ marginBottom: '14px' }}>{message}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflow: 'auto' }}>
          {partitions.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: 'var(--ym-radius-sm)' }}>
              <span style={{ flex: 1, fontSize: '14px', color: 'var(--ym-text-primary)' }}>{p.name}</span>
              <span className="ym-chip" style={{ fontSize: '12px' }}>{p.work_type}</span>
              {isLoggedIn && p.created_by === user.id && (
                <button type="button" className="ym-btn ym-btn-danger ym-btn-sm" onClick={() => handleDelete(p)}>
                  删除
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
          <button type="button" className="ym-btn ym-btn-ghost ym-btn-sm" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
