-- ============================================================================
-- 20260808_add_yili_ai_v3.sql
-- 依力 AI 3.0「不微调」方案（语料样本注入 + 全站工具 + 个性化记忆）
--   - 启用 pgvector 扩展
--   - yili_corpus：依力课程语料向量库（切块 + DashScope text-embedding-v4 嵌入）
--   - user_memories：用户个性化记忆（RLS 仅本人）
--   - RPC：
--       get_yili_samples  —— 混合检索（关键词 + 向量，RRF 融合）返回风格样本
--       save_user_memory  —— upsert 用户记忆（RLS 约束仅本人）
--
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴本文件全部内容 → Run
-- 幂等：可重复执行。
-- ============================================================================

-- ---------- 0. 启用 pgvector ----------
create extension if not exists vector;

-- ---------- 1. yili_corpus 语料向量库 ----------
create table if not exists public.yili_corpus (
  id uuid primary key default gen_random_uuid(),
  doc_id text not null,                 -- 来源文件名，如 base_01_Python入门第二课.txt
  chunk_index int not null,             -- 块序号（每份文件内从 0 开始）
  content text not null,                -- 句群切块文本（保留语气词，不重写）
  token_count int not null default 0,   -- 粗略字数/字符数
  source_file text,                     -- 冗余文件名（便于检索展示来源）
  embedding vector(1024),               -- DashScope text-embedding-v4，1024 维；未嵌入为 null
  created_at timestamptz not null default now(),
  constraint yili_corpus_chunk_unique unique (doc_id, chunk_index)
);

-- 向量索引（余弦相似度，HNSW）
create index if not exists idx_yili_corpus_embedding
  on public.yili_corpus using hnsw (embedding vector_cosine_ops);

-- 关键词检索索引（lower(content) LIKE 走 pg_trgm 可选，先建普通 btree 不划算；
-- 语料量小（约 1500 块），关键词路用顺序扫 + 匹配计数即可，量级完全可接受）

-- 语料表为站内自有数据：不启用 RLS（仅供服务端 RPC/函数读取），
-- 读权限仅授予 anon/authenticated（函数内降级直查用）
grant select on public.yili_corpus to anon, authenticated;

-- ---------- 2. user_memories 个性化记忆 ----------
create table if not exists public.user_memories (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  memory_text text not null,                      -- 用户偏好/事实摘要（≤3000 字）
  preferences jsonb not null default '{}',        -- 结构化偏好，如 {"likes":["科幻"],"topics":["python"]}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at 触发器（若存在 set_updated_at 则复用，否则就地建）
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at' and tgrelid = 'public.user_memories'::regclass) then
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where p.proname = 'set_updated_at' and n.nspname = 'public') then
      create trigger set_updated_at before update on public.user_memories
        for each row execute function public.set_updated_at();
    else
      create or replace function public.set_updated_at() returns trigger language plpgsql as $fn$
      begin new.updated_at := now(); return new; end $fn$;
      create trigger set_updated_at before update on public.user_memories
        for each row execute function public.set_updated_at();
    end if;
  end if;
end $$;

alter table public.user_memories enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'user_memories' loop
    execute format('drop policy if exists %I on public.user_memories', r.policyname);
  end loop;
end $$;

create policy "user_memories_select_own" on public.user_memories for select
  using (auth.uid() = user_id);
create policy "user_memories_insert_own" on public.user_memories for insert
  with check (
    auth.uid() = user_id
    and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)
  );
create policy "user_memories_update_own" on public.user_memories for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)
  );
create policy "user_memories_delete_own" on public.user_memories for delete
  using (auth.uid() = user_id);

-- ---------- 3. RPC：get_yili_samples 混合检索（关键词 + 向量 + RRF） ----------
create or replace function public.get_yili_samples(
  p_query text default '',
  p_tokens text[] default '{}',
  p_embedding vector default null,
  p_limit int default 5
)
returns table (content text, source_file text, doc_id text, chunk_index int, score float8)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 5), 1), 10);
  v_tokens text[] := coalesce(p_tokens, '{}');
  v_has_kw boolean := cardinality(v_tokens) > 0;
  v_has_vec boolean := p_embedding is not null;
begin
  -- 两路都不可用时直接返回空
  if not v_has_kw and not v_has_vec then
    return;
  end if;

  return query
  with kw as (
    select c.id, c.doc_id, c.chunk_index, c.content, c.source_file, c.created_at,
           (select count(*) from unnest(v_tokens) t where c.content ilike '%' || t || '%') as k_matches
    from public.yili_corpus c
    where v_has_kw
      and exists (select 1 from unnest(v_tokens) t where c.content ilike '%' || t || '%')
    order by k_matches desc, c.created_at desc
    limit 20
  ),
  vec as (
    select c.id, c.doc_id, c.chunk_index, c.content, c.source_file
    from public.yili_corpus c
    where v_has_vec and c.embedding is not null
    order by c.embedding <=> p_embedding
    limit 20
  ),
  kw_r as (
    select kw.*, row_number() over (order by kw.k_matches desc, kw.created_at desc) as rk
    from kw
  ),
  vec_r as (
    select vec.*, row_number() over (order by vec.doc_id, vec.chunk_index) as rk
    from vec
  ),
  fused as (
    select coalesce(k.doc_id, v.doc_id) as doc_id,
           coalesce(k.chunk_index, v.chunk_index) as chunk_index,
           coalesce(k.content, v.content) as content,
           coalesce(k.source_file, v.source_file) as source_file,
           ((case when k.rk is not null then 1.0 / (60.0 + k.rk) else 0.0 end)
         + (case when v.rk is not null then 1.0 / (60.0 + v.rk) else 0.0 end))::float8 as score
    from kw_r k
    full outer join vec_r v
      on v.doc_id = k.doc_id and v.chunk_index = k.chunk_index
  )
  select f.content, f.source_file, f.doc_id, f.chunk_index, f.score
  from fused f
  order by f.score desc, f.doc_id, f.chunk_index
  limit v_limit;
end $$;

grant execute on function public.get_yili_samples(text, text[], vector, int) to anon, authenticated;

-- ---------- 4. RPC：save_user_memory（RLS 约束，仅本人） ----------
create or replace function public.save_user_memory(
  p_user_id uuid,
  p_memory_text text,
  p_preferences jsonb default '{}'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- RLS（invoker）保证 auth.uid() = p_user_id 才可写
  insert into public.user_memories (user_id, memory_text, preferences)
  values (p_user_id, left(p_memory_text, 3000), coalesce(p_preferences, '{}'::jsonb))
  on conflict (user_id)
  do update set
    memory_text = left(excluded.memory_text, 3000),
    preferences = coalesce(excluded.preferences, '{}'::jsonb),
    updated_at = now();
end $$;

grant execute on function public.save_user_memory(uuid, text, jsonb) to authenticated;

-- ============================================================================
-- 完成。验证：
--   select * from public.yili_corpus limit 1;          -- 空表正常
--   select * from public.user_memories limit 1;        -- 空表正常
--   select public.get_yili_samples('python', array['python'], null, 3); -- 空表返回空
-- ============================================================================

-- ---------- 5. RPC：upsert_yili_chunks 嵌入入库（jsonb → vector 显式转换） ----------
create or replace function public.upsert_yili_chunks(p_chunks jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c jsonb;
  v_vec vector(1024);
begin
  for c in select value from jsonb_array_elements(p_chunks) loop
    begin
      v_vec := ('[' || (
        select string_agg(elem, ',')
        from jsonb_array_elements_text(c -> 'embedding') elem
      ) || ']')::vector;
    exception when others then
      v_vec := null;
    end;
    insert into public.yili_corpus (doc_id, chunk_index, content, token_count, source_file, embedding)
    values (
      c ->> 'doc_id',
      coalesce((c ->> 'chunk_index')::int, 0),
      c ->> 'content',
      coalesce((c ->> 'token_count')::int, 0),
      c ->> 'source_file',
      v_vec
    )
    on conflict (doc_id, chunk_index) do update set
      content = excluded.content,
      token_count = excluded.token_count,
      source_file = excluded.source_file,
      embedding = excluded.embedding;
  end loop;
end $$;

revoke all on function public.upsert_yili_chunks(jsonb) from public;
grant execute on function public.upsert_yili_chunks(jsonb) to service_role;

-- ============================================================================
-- 完成。验证：
--   select count(*) from public.yili_corpus;   -- 应为 0（嵌入后为 775）
-- ============================================================================





