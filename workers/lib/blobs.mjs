// workers/lib/blobs.mjs
// Netlify Blobs 的替代实现（Cloudflare Workers）。
//
// 接口与 @netlify/blobs 的 getStore() 保持兼容，函数代码只需要换 import 路径：
//   get(key, { type: 'json' | 'text' })
//   set(key, value, { metadata })
//   getMetadata(key)
//   delete(key)
//
// 存储后端优先级：
//   1. 绑定的 KV 命名空间（wrangler.toml 里的 [[kv_namespaces]] binding = "CACHE"）——持久、跨实例
//   2. 内存 Map —— 没绑 KV 时的兜底：单实例内有效，跨实例/重启即失效（只影响缓存类用途）
//
// 内存兜底是「尽力而为」：缓存类数据（data-proxy / screenshot）丢了只是变慢；
// 但 el-memory 这种需要持久化的内容必须绑 KV，否则会随实例回收丢失。

let CURRENT_ENV = {};

/** 每个请求进来时由 router 注入，使 getStore() 能拿到 KV 绑定 */
export function setEnv(env) {
  CURRENT_ENV = env || {};
}

const memoryStores = new Map(); // storeName -> Map<key, { value, metadata }>

function memoryStore(name) {
  if (!memoryStores.has(name)) memoryStores.set(name, new Map());
  return memoryStores.get(name);
}

const kvOf = () => CURRENT_ENV.CACHE || null;

/**
 * 获取一个「store」。与 Netlify 版本不同：这里是同步的，且不需要 context 参数。
 * @param {string} name 逻辑存储名（实际会拼进 KV 的 key 前缀）
 */
export function getStore(name = 'default') {
  const kv = kvOf();
  const prefix = `${name}:`;

  if (kv) {
    return {
      async get(key, opts = {}) {
        const raw = await kv.get(prefix + key, 'text');
        if (raw === null || raw === undefined) return null;
        try {
          const rec = JSON.parse(raw);
          return opts.type === 'json' ? JSON.parse(rec.__body) : rec.__body;
        } catch {
          return null;
        }
      },
      async set(key, value, opts = {}) {
        const body = typeof value === 'string' ? value : JSON.stringify(value);
        const params = {};
        if (opts.metadata?.ttlSeconds) params.expirationTtl = opts.metadata.ttlSeconds;
        await kv.put(prefix + key, JSON.stringify({ __meta: opts.metadata || null, __body: body }), params);
      },
      async getMetadata(key) {
        const raw = await kv.get(prefix + key, 'text');
        if (!raw) return null;
        try {
          const rec = JSON.parse(raw);
          return rec.__meta ? { metadata: rec.__meta } : null;
        } catch {
          return null;
        }
      },
      async delete(key) {
        await kv.delete(prefix + key);
      },
    };
  }

  const mem = memoryStore(name);
  return {
    async get(key, opts = {}) {
      const rec = mem.get(key);
      if (!rec) return null;
      if (rec.expiresAt && Date.now() > rec.expiresAt) {
        mem.delete(key);
        return null;
      }
      if (opts.type === 'json') {
        try {
          return JSON.parse(rec.value);
        } catch {
          return null;
        }
      }
      return rec.value;
    },
    async set(key, value, opts = {}) {
      const body = typeof value === 'string' ? value : JSON.stringify(value);
      mem.set(key, {
        value: body,
        metadata: opts.metadata || null,
        expiresAt: opts.metadata?.ttlSeconds ? Date.now() + opts.metadata.ttlSeconds * 1000 : null,
      });
    },
    async getMetadata(key) {
      const rec = mem.get(key);
      return rec?.metadata ? { metadata: rec.metadata } : null;
    },
    async delete(key) {
      mem.delete(key);
    },
  };
}

/** KV 是否已绑定（用于给管理员提示「记忆功能需要绑 KV」） */
export const hasPersistentStore = () => Boolean(kvOf());
