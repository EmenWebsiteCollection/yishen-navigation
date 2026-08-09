# 依力语料管线（yili-corpus-pipeline）

> 依力 AI 3.0「不微调」方案的语料 → 切块 → 嵌入 → 检索流水线。目标：让 DeepSeek 照着依力的原话样本说话，而不是微调模型。

## 一、流水线总览

```
依力课程语料（base_01..11_*.txt，约 57 万字，语气词 100% 保留）
   ↓ 01_chunk_corpus.mjs（句群切块，400-800 字/块，相邻重叠 1 句）
corpus_chunks.json（775 块）
   ↓ 03_style_dna.mjs（表达 DNA 蒸馏：语气词/口癖/句长/句式统计）
yili-style-dna.js + docs/yili-style-dna.md（常驻风格底座）
   ↓ 02_embed_corpus.mjs（DashScope text-embedding-v4，1024 维）
yili_corpus 表（pgvector + HNSW 索引）
   ↓ 运行时：yili-chat.mjs 按用户消息混合检索（关键词 + 向量 RRF）
3-5 段依力原话样本 → 注入 system 的 <yili_samples> 区
```

## 二、脚本清单

| 脚本 | 作用 | 幂等 |
|------|------|------|
| `scripts/yili/01_chunk_corpus.mjs` | base_*.txt → corpus_chunks.json | 是（覆盖写） |
| `scripts/yili/02_embed_corpus.mjs` | chunks → DashScope 嵌入 → yili_corpus 表 | 是（按 doc_id+chunk_index upsert） |
| `scripts/yili/03_style_dna.mjs` | chunks → 表达 DNA（JS 常量 + md 档案） | 是（覆盖写） |
| `scripts/yili/chunk.test.mjs` | 切块纯逻辑测试 | 只读 |

## 三、前置凭据

`02_embed_corpus.mjs` 需要（`.env.local` 或环境变量）：
- `DASHSCOPE_API_KEY`：阿里云百炼 key（text-embedding-v4，新用户有免费额度）
- 入库二选一：
  - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`（service role 直连）
  - `SUPABASE_MGMT_TOKEN` + `SUPABASE_REF`（管理令牌，经 Management API 执行 upsert SQL）

## 四、执行步骤

```powershell
# 1. 切块（已生成 corpus_chunks.json）
$OutputEncoding = [System.Text.Encoding]::UTF8
node scripts/yili/01_chunk_corpus.mjs

# 2. 表达 DNA 蒸馏（已生成 yili-style-dna.js / docs/yili-style-dna.md）
node scripts/yili/03_style_dna.mjs

# 3. 嵌入入库（需 DASHSCOPE_API_KEY；可重跑，增量覆盖）
node scripts/yili/02_embed_corpus.mjs
```

## 五、数据层（迁移 supabase/migrations/20260808_add_yili_ai_v3.sql）

- `yili_corpus`：doc_id / chunk_index / content / token_count / source_file / embedding(vector(1024))，唯一(doc_id,chunk_index)，HNSW 索引
- `user_memories`：user_id 主键 / memory_text / preferences jsonb，RLS 仅本人
- RPC：
  - `get_yili_samples(p_query, p_tokens, p_embedding, p_limit)`：关键词 ILIKE top20 + 向量余弦 top20 → RRF(k=60) → 前 5
  - `save_user_memory(p_user_id, p_memory_text, p_preferences)`：upsert，RLS 约束仅本人
  - `upsert_yili_chunks(p_chunks jsonb)`：嵌入入库（jsonb → vector 显式转换），仅 service_role 可执行

## 六、运行时注入（yili-chat.mjs v3）

1. 取用户最后一条消息 → `getYiliSamples`（关键词 token + DashScope 查询嵌入 → RPC RRF）
2. system prompt 结构：人设 → **常驻表达 DNA**（buildStyleDnaBlock）→ **实时样本**（<yili_samples>）→ 用户记忆 → 站内记忆库
3. 检索/嵌入失败 → 跳过注入，仅用 DNA + 人设（永远可聊）

## 七、征集语料增量

征集语料（Excel 模板）到货后：转成 `base_XX_*.txt` 放入语料目录 → 重跑 `01_chunk_corpus.mjs`（增量文件自动纳入）→ `02_embed_corpus.mjs`（幂等 upsert）。无需改代码。
