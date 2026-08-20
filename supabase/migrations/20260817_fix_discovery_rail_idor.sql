-- ═══════════════════════════════════════════════
-- 依神导航 · 安全修复 #133：get_discovery_rail IDOR 越权
-- 2026-08-17
--
-- 问题：SECURITY DEFINER 函数 get_discovery_rail 的 favorites/following rail
--       按客户端传入的 p_user_id 读取收藏/关注关系，无 auth.uid() 归属校验。
--       任意匿名用户传目标用户 UUID 即可推断其收藏偏好 / 关注关系
--       （绕过 2026-08-17 的 favorites/follows RLS 收紧，issue #133）。
--
-- 修复：函数开头对 favorites/following rail 加归属校验：
--   - p_user_id 为 null（游客/未传）→ 降级为 latest（不泄露他人数据）
--   - p_user_id = auth.uid()（本人）→ 正常个性化推荐
--   - p_user_id = 其他用户（攻击者）→ raise 42501 permission denied
--
-- 幂等：create or replace + grant，可重复执行。
-- ═══════════════════════════════════════════════

create or replace function public.get_discovery_rail(
  p_rail text default 'latest',
  p_user_id uuid default null,
  p_work_id uuid default null,
  p_limit int default 12,
  p_exclude_ids uuid[] default '{}'
)
returns setof public.works_discovery
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_rail text := lower(coalesce(p_rail, 'latest'));
  v_limit int := least(greatest(coalesce(p_limit, 12), 1), 50);
  v_excl uuid[] := coalesce(p_exclude_ids, '{}');
  v_tags text[] := '{}';
  v_styles text[] := '{}';
  v_tools text[] := '{}';
  v_wtype text := null;
begin
  if v_rail not in ('latest','rising','featured','underrated','growing','zero_comment','similar','favorites','following') then
    v_rail := 'latest';
  end if;

  -- #133 修复：favorites/following 是个性化 rail，仅允许本人使用
  -- 游客(p_user_id=null)降级为 latest；传他人 UUID → 拒绝（防 IDOR）
  if v_rail in ('favorites', 'following') then
    if p_user_id is null then
      v_rail := 'latest';
    elsif p_user_id <> auth.uid() then
      raise exception 'permission denied'
        using errcode = '42501';
    end if;
  end if;

  if v_rail = 'similar' and p_work_id is not null then
    select w.tags, w.styles, w.tools, w.work_type into v_tags, v_styles, v_tools, v_wtype
    from public.works w where w.id = p_work_id;
  end if;

  if v_rail = 'favorites' and p_user_id is not null then
    select coalesce(array_agg(distinct t), '{}') into v_tags from (
      select unnest(w.tags) as t from public.works w
        join public.favorites f on f.work_id = w.id
        where f.user_id = p_user_id and w.visibility = 'public' and w.tags is not null
      union
      select unnest(w.styles) as t from public.works w
        join public.favorites f on f.work_id = w.id
        where f.user_id = p_user_id and w.visibility = 'public' and w.styles is not null
      union
      select unnest(w.tools) as t from public.works w
        join public.favorites f on f.work_id = w.id
        where f.user_id = p_user_id and w.visibility = 'public' and w.tools is not null
    ) s;
  end if;

  if v_rail = 'latest' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl))
      order by wd.created_at desc limit v_limit;
    return;
  end if;

  if v_rail = 'rising' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl))
        and wd.created_at >= now() - interval '7 days' and wd.like_count >= 1
      order by wd.like_count desc, wd.created_at desc limit v_limit;
    return;
  end if;

  if v_rail = 'featured' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl)) and wd.featured
      order by wd.updated_at desc limit v_limit;
    return;
  end if;

  if v_rail = 'underrated' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl))
        and wd.like_count <= 10 and (wd.favorite_count + wd.comment_count) >= 2
      order by (wd.favorite_count * 2 + wd.comment_count) desc, wd.like_count desc limit v_limit;
    return;
  end if;

  if v_rail = 'growing' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl))
        and wd.like_count between 5 and 50 and (wd.favorite_count + wd.comment_count) >= 1
      order by (wd.favorite_count + wd.comment_count) desc, wd.created_at desc limit v_limit;
    return;
  end if;

  if v_rail = 'zero_comment' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl)) and wd.comment_count = 0
      order by wd.like_count desc, wd.created_at desc limit v_limit;
    return;
  end if;

  if v_rail = 'following' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl))
        and exists (select 1 from public.follows fo
          where fo.follower_id = p_user_id and fo.following_id = wd.user_id)
      order by wd.created_at desc limit v_limit;
    return;
  end if;

  if v_rail = 'similar' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl))
        and wd.id <> p_work_id
        and (
          (select count(*) from unnest(wd.tags) t where t = any(v_tags))
          + (select count(*) from unnest(wd.styles) t where t = any(v_styles))
          + (select count(*) from unnest(wd.tools) t where t = any(v_tools))
          + case when wd.work_type = v_wtype then 1 else 0 end
        ) > 0
      order by (
        (select count(*) from unnest(wd.tags) t where t = any(v_tags))
        + (select count(*) from unnest(wd.styles) t where t = any(v_styles))
        + (select count(*) from unnest(wd.tools) t where t = any(v_tools))
        + case when wd.work_type = v_wtype then 1 else 0 end
      ) desc, wd.like_count desc limit v_limit;
    return;
  end if;

  if v_rail = 'favorites' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl)) and wd.user_id <> p_user_id
        and (
          (select count(*) from unnest(wd.tags) t where t = any(v_tags))
          + (select count(*) from unnest(wd.styles) t where t = any(v_styles))
          + (select count(*) from unnest(wd.tools) t where t = any(v_tools))
        ) > 0
      order by (
        (select count(*) from unnest(wd.tags) t where t = any(v_tags))
        + (select count(*) from unnest(wd.styles) t where t = any(v_styles))
        + (select count(*) from unnest(wd.tools) t where t = any(v_tools))
      ) desc, wd.like_count desc limit v_limit;
    return;
  end if;

  return query select wd.* from public.works_discovery wd
    where wd.visibility = 'public' and not (wd.id = any(v_excl))
    order by wd.created_at desc limit v_limit;
end;
$$;

grant execute on function public.get_discovery_rail(text, uuid, uuid, int, uuid[]) to anon, authenticated;

-- ═══════════════════════════════════════════════
-- 验证：
--   匿名:  POST rpc/get_discovery_rail {"p_rail":"favorites","p_user_id":"<他人UUID>"}
--          → 401 42501 permission denied ✅（IDOR 堵住）
--   匿名:  POST rpc/get_discovery_rail {"p_rail":"favorites","p_user_id":null}
--          → 200 返回 latest 降级数据 ✅（游客功能正常）
--   登录:  POST rpc/get_discovery_rail {"p_rail":"following","p_user_id":"<自己>"}
--          → 200 返回自己的关注推荐 ✅（本人功能正常）
-- ═══════════════════════════════════════════════
