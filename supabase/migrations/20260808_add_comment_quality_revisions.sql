-- ============================================================================
-- 20260808_add_comment_quality_revisions.sql
-- 依门（yishen-navigation）Issue #39 第三阶段（P3）：
--   评论质量评价 + 评论者声誉 + 修改前后对比（作品成长档案）
--   - comment_feedback（有帮助/有洞察/专业/表达友善，一人一票一类型）
--   - comments.adopted（作者采纳标记）
--   - work_revisions（版本快照，只读不可篡改，含采纳建议回链）
--   - get_commenter_reputation RPC（信誉分 + 徽章档位）
--
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴本文件全部内容 → Run
-- 幂等：可重复执行。
-- ============================================================================

-- ---------- 1. comments.adopted ----------
alter table public.comments add column if not exists adopted boolean not null default false;

-- ---------- 2. comment_feedback（评论质量评价） ----------
create table if not exists public.comment_feedback (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('helpful','insightful','professional','friendly')),
  created_at timestamptz not null default now(),
  constraint comment_feedback_unique unique (comment_id, user_id, feedback_type)
);

alter table public.comment_feedback enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'comment_feedback' loop
    execute format('drop policy if exists %I on public.comment_feedback', r.policyname);
  end loop;
end $$;

create policy "comment_feedback_select_public" on public.comment_feedback for select using (true);
create policy "comment_feedback_insert_own" on public.comment_feedback for insert
  with check (auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false));
create policy "comment_feedback_delete_own" on public.comment_feedback for delete
  using ((auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)) or is_admin());

create index if not exists idx_comment_feedback_comment on public.comment_feedback (comment_id);
create index if not exists idx_comment_feedback_user on public.comment_feedback (user_id);

-- ---------- 3. work_revisions（作品成长档案 / 版本快照） ----------
create table if not exists public.work_revisions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  revision_no int not null,
  version_label text not null default 'revised' check (version_label in ('first','revised','final')),
  title text,
  description text,
  image_url text,
  cover_url text,
  changelog text,
  note text,
  adopted_comment_ids uuid[] not null default '{}',
  adopted_summary text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint work_revisions_work_no_unique unique (work_id, revision_no)
);

alter table public.work_revisions enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'work_revisions' loop
    execute format('drop policy if exists %I on public.work_revisions', r.policyname);
  end loop;
end $$;

create policy "work_revisions_select_public" on public.work_revisions for select using (true);
create policy "work_revisions_insert_own" on public.work_revisions for insert
  with check (
    not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)
    and (
      exists (select 1 from public.works w where w.id = work_id and w.user_id = auth.uid())
      or is_admin()
    )
  );
create policy "work_revisions_update_admin" on public.work_revisions for update using (is_admin());
create policy "work_revisions_delete_admin" on public.work_revisions for delete using (is_admin());

create index if not exists idx_work_revisions_work on public.work_revisions (work_id, revision_no);

-- ---------- 4. 评论者信誉 RPC（SECURITY DEFINER） ----------
create or replace function public.get_commenter_reputation(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'adopted_count',
      (select count(*)::int from public.comments c
        where c.user_id = p_user_id and c.adopted),
    'helpful',
      (select count(*)::int from public.comment_feedback cf
        join public.comments c on c.id = cf.comment_id
        where c.user_id = p_user_id and cf.feedback_type = 'helpful'),
    'insightful',
      (select count(*)::int from public.comment_feedback cf
        join public.comments c on c.id = cf.comment_id
        where c.user_id = p_user_id and cf.feedback_type = 'insightful'),
    'professional',
      (select count(*)::int from public.comment_feedback cf
        join public.comments c on c.id = cf.comment_id
        where c.user_id = p_user_id and cf.feedback_type = 'professional'),
    'friendly',
      (select count(*)::int from public.comment_feedback cf
        join public.comments c on c.id = cf.comment_id
        where c.user_id = p_user_id and cf.feedback_type = 'friendly')
  );
$$;

grant execute on function public.get_commenter_reputation(uuid) to anon, authenticated;

-- ---------- 5. 授权 ----------
grant select on public.comment_feedback to anon, authenticated;
grant select on public.work_revisions to anon, authenticated;
grant insert, delete on public.comment_feedback to authenticated;
grant insert on public.work_revisions to authenticated;

-- ============================================================================
-- 完成。验证：
--   select count(*) from public.comment_feedback;
--   select * from public.get_commenter_reputation('<user_id>');
-- ============================================================================
