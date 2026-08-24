-- ═══════════════════════════════════════════════
-- 依神导航 · 浏览量计数函数升级：返回计数后的最新值
-- 2026-08-24（修复首页/详情页浏览量不一致，见 issue #150）
--
-- 背景：详情页展示的浏览量来自并发发起的 SELECT，与本次
--       rpc_increment_view 存在竞态——RPC 先落地则显示 N+1，
--       后落地则显示 N；叠加首页列表 5 分钟缓存，同一作品在
--       不同入口显示的浏览量对不上。让 RPC 返回更新后的真实值，
--       前端在回调里覆盖展示，消除不确定性。
--
-- 兼容性：返回类型 void → integer，旧调用方（不使用返回值）无需改动；
--         前端对 null / 非数字返回值按「本次未计数」处理。
-- 幂等：create or replace function，可重复执行（同时统一线上函数版本：
--       无论当前是 restrict 版还是 throttle 版，执行本迁移后均为
--       「游客可计数 + 60s 限流 + 返回新值」的最终形态）。
-- 注意：PG 不允许直接修改函数返回类型（void → integer），须先 DROP 再建；
--       DROP 与 CREATE 同批执行，窗口亚秒级，期间调用方仅损失一次计数（前端静默容错）。
-- ═══════════════════════════════════════════════

drop function if exists public.rpc_increment_view(uuid);

create or replace function public.rpc_increment_view(p_work_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_last timestamptz;
begin
  if p_work_id is null then
    return null;
  end if;

  -- 识别调用者：登录用户按 uid 限频；游客沿用 #137 修正版策略，
  -- 统一匿名键限频（每作品 60 秒窗口内全站匿名只计 1 次，防脚本刷量）
  if auth.uid() is not null then
    v_key := 'u:' || auth.uid()::text;
  else
    v_key := 'anon';
  end if;

  -- 窗口内已计过 → 静默 no-op，返回 null（前端保持现值不动）
  select counted_at into v_last
    from public.view_count_throttle
   where work_id = p_work_id and actor_key = v_key;

  if v_last is not null and v_last > now() - interval '60 seconds' then
    return null;
  end if;

  update public.works
     set view_count = view_count + 1
   where id = p_work_id;

  -- 作品不存在：FOUND 为 false，直接返回 null
  -- （否则继续往限流表 insert 会违反 work_id 外键抛 23503，原 throttle 版的潜在 bug）
  if not found then
    return null;
  end if;

  insert into public.view_count_throttle (work_id, actor_key, counted_at)
  values (p_work_id, v_key, now())
  on conflict (work_id, actor_key)
  do update set counted_at = excluded.counted_at;

  return (select view_count from public.works where id = p_work_id);
end
$$;

grant execute on function public.rpc_increment_view(uuid) to anon, authenticated;

-- 验证（Supabase Dashboard → SQL Editor）：
--   select public.rpc_increment_view('<真实作品 uuid>');  → 返回计数后的新值
--   60 秒内重复调用                                        → 返回 null 且 view_count 不变
-- 回滚：重新执行 20260817_fix_increment_view_throttle.sql 的 void 版函数定义即可
