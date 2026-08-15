-- ═══════════════════════════════════════════════
-- 依神导航 · 安全修复 #114 补丁：get_yili_samples 函数内鉴权
-- 2026-08-15
--
-- 背景：revoke execute on get_yili_samples from anon 被 Supabase 平台
--       自动加回（平台维护 anon/authenticated 对 public schema 函数的
--       默认 EXECUTE），实测匿名仍可调用并拉取语料。
-- 修复：在函数体内显式校验 auth.role()，非 authenticated/service_role
--       直接 raise exception。数据库对象内部逻辑平台不会改。
-- ═══════════════════════════════════════════════

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
  -- 函数内鉴权（#114）：仅登录用户/服务端可调用，匿名一律拒绝
  -- （表级 REVOKE 会被 Supabase 平台加回，必须函数内校验兜底）
  if auth.role() not in ('authenticated', 'service_role') then
    raise exception 'permission denied for function get_yili_samples'
      using errcode = '42501';
  end if;

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

-- 恢复明确授权（表级 revoke 会回滚，函数级显式声明意图；实际拦截靠函数内 auth.role() 检查）
grant execute on function public.get_yili_samples(text, text[], vector, int) to authenticated, service_role;

-- ═══ 验证 ═══
-- 匿名调用应报 42501：
--   （REST）POST /rest/v1/rpc/get_yili_samples → 42501 permission denied
-- 登录用户调用正常。

-- 回滚：用原版函数体重建即可（见 20260808_add_yili_ai_v3.sql）
