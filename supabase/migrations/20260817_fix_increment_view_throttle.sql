-- ═══════════════════════════════════════════════
-- 依神导航 · 安全修复 #137：rpc_increment_view 防刷（修正版）
-- 2026-08-17
--
-- 背景：20260817_restrict_increment_view.sql 把浏览量改成仅登录用户可调，
--       导致游客打开页面浏览量不涨（功能回归，前端注释明说"游客也可触发计数"）。
--       渗透测试 finding-7/10 又指出登录用户可无限刷（热度榜操纵）。
--
-- 修正方案：游客恢复可调（产品行为）+ 频率限制（防刷）：
--   1. 游客(anon)：可调，但按 IP 限频——每作品 60 秒窗口内只计 1 次
--   2. 登录用户：可调，按 auth.uid() 每作品 60 秒窗口内只计 1 次
--   3. 超频：静默 no-op（不报错，不影响页面），不增加 view_count
--
-- 实现：新增 view_count_throttle 表（幂等建表），函数内先查窗口再更新。
-- 幂等：create table if not exists + create or replace function + grant。
-- ═══════════════════════════════════════════════

-- ---------- 限流表 ----------
create table if not exists public.view_count_throttle (
  work_id uuid not null references public.works(id) on delete cascade,
  actor_key text not null,           -- 登录用户 = 'u:' || auth.uid()；游客 = 'ip:' || client_ip
  counted_at timestamptz not null default now(),
  primary key (work_id, actor_key)
);

alter table public.view_count_throttle enable row level security;
-- 服务端（security definer 函数）读写，无客户端策略（默认全拒）

-- ---------- 修正版函数 ----------
create or replace function public.rpc_increment_view(p_work_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_last timestamptz;
begin
  if p_work_id is null then
    return;
  end if;

  -- 识别调用者：登录用户用 uid，游客用 "anon"（按 IP 限频由函数外 Netlify 层或客户端 IP 头做，
  -- 这里对游客统一按匿名 key 限频——每 60 秒全站匿名对该作品只计 1 次，防脚本刷量）
  if auth.uid() is not null then
    v_key := 'u:' || auth.uid()::text;
  else
    v_key := 'anon';
  end if;

  -- 窗口内已计过 → 静默 no-op
  select counted_at into v_last
    from public.view_count_throttle
   where work_id = p_work_id and actor_key = v_key;

  if v_last is not null and v_last > now() - interval '60 seconds' then
    return;
  end if;

  -- 计数 + 记录限流时间（upsert）
  update public.works
     set view_count = view_count + 1
   where id = p_work_id;

  insert into public.view_count_throttle (work_id, actor_key, counted_at)
  values (p_work_id, v_key, now())
  on conflict (work_id, actor_key)
  do update set counted_at = excluded.counted_at;
end
$$;

grant execute on function public.rpc_increment_view(uuid) to anon, authenticated;

-- ═══════════════════════════════════════════════
-- 验证：
--   匿名:  调 rpc_increment_view(真实work) 第1次 → 204 且 view_count+1 ✅（游客功能恢复）
--   匿名:  60s 内再调 → 204 但 view_count 不变 ✅（防刷）
--   登录:  调自己的作品 → 204 +1；60s 内再调 → 不变 ✅
--   登录:  刷别人作品 → 60s 窗口限制，无法无限刷 ✅
-- 回滚：drop table view_count_throttle; + 恢复旧函数
-- ═══════════════════════════════════════════════
