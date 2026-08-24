-- ═══════════════════════════════════════════════
-- 依神导航 · 修复 #149：rpc_increment_view 返回计数后的真实浏览量
-- 2026-08-24
--
-- 问题（issue #149 子问题 2）：详情页并发执行 incrementView(RPC +1) 与
--       getWorkById(SELECT 展示)，两请求竞速——RPC 先落库则显示 N+1，
--       SELECT 先返回则显示 N，详情页自己显示的数值都不确定。
--
-- 修复方案（issue 已定）：函数改为 returns integer，返回计数后（或限流
--   no-op 时当前）的真实浏览量；前端在回调里覆盖展示，消除竞态。
--
-- 兼容性：
--   - 防刷逻辑与 20260817_fix_increment_view_throttle.sql 完全一致
--     （游客 'anon' 键 / 登录 'u:<uid>' 键，60s 窗口静默 no-op），
--     本迁移只加返回值，不碰限流行为（#149 子问题 3 留给后端组决策）。
--   - drop + create（而非 create or replace）确保从任何历史版本
--     （restrict 版 / throttle 版）都幂等收敛到本形态；grant 随建随授。
-- ═══════════════════════════════════════════════

drop function if exists public.rpc_increment_view(uuid);

create function public.rpc_increment_view(p_work_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_last timestamptz;
  v_count integer;
begin
  if p_work_id is null then
    return null;
  end if;

  -- 识别调用者：登录用户用 uid；游客统一 'anon' 键（60s 全站匿名每作品计 1 次）
  if auth.uid() is not null then
    v_key := 'u:' || auth.uid()::text;
  else
    v_key := 'anon';
  end if;

  -- 窗口内已计过 → 不重复计数，返回当前真实值（展示口径仍正确）
  select counted_at into v_last
    from public.view_count_throttle
   where work_id = p_work_id and actor_key = v_key;

  if v_last is not null and v_last > now() - interval '60 seconds' then
    select view_count into v_count from public.works where id = p_work_id;
    return v_count;
  end if;

  -- 计数并取回新值 + 记录限流时间（upsert）
  update public.works
     set view_count = coalesce(view_count, 0) + 1
   where id = p_work_id
   returning view_count into v_count;

  insert into public.view_count_throttle (work_id, actor_key, counted_at)
  values (p_work_id, v_key, now())
  on conflict (work_id, actor_key)
  do update set counted_at = excluded.counted_at;

  return v_count;
end
$$;

grant execute on function public.rpc_increment_view(uuid) to anon, authenticated;

-- ═══════════════════════════════════════════════
-- 验证：
--   匿名:  select rpc_increment_view(真实work) 第1次 → 返回 N+1 ✅
--   匿名:  60s 内再调 → 返回 N+1（不再 +1，防刷保持）✅
--   登录:  同上按 uid 键限频 ✅
--   前端:  详情页首次打开稳定显示「进入前数值 + 1」，刷新不变 ✅
-- 回滚：重放 20260817_fix_increment_view_throttle.sql 的函数体即可。
-- ═══════════════════════════════════════════════
