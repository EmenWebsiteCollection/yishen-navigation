// netlify/functions/el-memory.mjs
// 依力 AI 记忆存取：作品记忆库（el-ai-memory.md 内容）存 Netlify Blobs
//
// GET  /.netlify/functions/el-memory        → 返回当前记忆文本（供 yili-chat 读取）
// POST /.netlify/functions/el-memory        → 更新记忆（需 Bearer EL_MEMORY_TOKEN）
// DELETE /.netlify/functions/el-memory      → 清空记忆（需 Bearer）
import { getStore } from '@netlify/blobs';

const STORE = 'el-memory';
const KEY = 'memory.md';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function auth(req) {
  const token = process.env.EL_MEMORY_TOKEN;
  if (!token) return false; // 未配置 token：允许读，不允许写
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${token}`;
}

export default async (req) => {
  const method = req.method || 'GET';
  const store = getStore(STORE);

  try {
    if (method === 'GET') {
      const content = await store.get(KEY, { type: 'text' });
      let updatedAt = null;
      try {
        const meta = await store.getMetadata(KEY);
        updatedAt = meta?.metadata?.updatedAt || null;
      } catch {
        // 无元数据时不报错
      }
      return json({ ok: true, updatedAt, content: content || '' });
    }

    if (method === 'POST') {
      if (!auth(req)) return json({ error: '未授权' }, 401);
      const body = await req.json().catch(() => ({}));
      const content = String(body.content || '');
      if (!content.trim()) return json({ error: 'content 不能为空' }, 400);
      await store.set(KEY, content, {
        metadata: { updatedAt: new Date().toISOString() },
      });
      return json({ ok: true, bytes: content.length });
    }

    if (method === 'DELETE') {
      if (!auth(req)) return json({ error: '未授权' }, 401);
      await store.delete(KEY);
      return json({ ok: true });
    }

    return json({ error: 'Method Not Allowed' }, 405);
  } catch (err) {
    console.error('el-memory 操作失败:', err);
    return json({ error: '记忆存取失败，请稍后重试' }, 500);
  }
};
