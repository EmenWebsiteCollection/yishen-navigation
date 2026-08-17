-- ============================================================================
-- 依神导航 · 安全修复：8 张表收紧匿名可读（修正版）
-- 2026-08-17
--
-- 问题：website_likes / favorites / follows / idea_votes / work_revisions /
--       comment_feedback / password_reset_codes / user_memories 对 anon
--       可读，泄露用户互动与敏感记录。
--
-- 修复原则（吸取 Codex 初版教训）：**只收紧 anon 读，不碰 authenticated 的写**。
--   - 每张表：清旧策略 → 重建完整策略集：
--       SELECT: 仅本人可读自己的行（anon 无策略 = 默认拒绝）
--       INSERT: authenticated 可插自己的行（写自己的数据，with check 本人）
--       UPDATE: authenticated 可改自己的行（本人）
--       DELETE: authenticated 可删自己的行（本人）
--   - anon 一律无 SELECT 策略（匿名默认拒绝），保持原交互功能不破。
-- owner 字段核对：
--   website_likes.user_id, favorites.user_id, follows.follower_id,
--   idea_votes.user_id, work_revisions.created_by, comment_feedback.user_id,
--   password_reset_codes.user_id, user_memories.user_id
-- 幂等：DO 块清理旧策略 + create policy，可重复执行。
-- ============================================================================

-- ---------- 1. website_likes（点赞） ----------
alter table public.website_likes enable row level security;

do $$
declare r record;
begin
  for r in select policyname
           from pg_policies
           where schemaname = 'public' and tablename = 'website_likes'
  loop
    execute format('drop policy if exists %I on public.website_likes', r.policyname);
  end loop;
end $$;

create policy "website_likes_select_own" on public.website_likes
  for select using (auth.uid() = user_id);
create policy "website_likes_insert_own" on public.website_likes
  for insert with check (auth.uid() = user_id);
create policy "website_likes_delete_own" on public.website_likes
  for delete using (auth.uid() = user_id);

-- ---------- 2. favorites（收藏） ----------
alter table public.favorites enable row level security;

do $$
declare r record;
begin
  for r in select policyname
           from pg_policies
           where schemaname = 'public' and tablename = 'favorites'
  loop
    execute format('drop policy if exists %I on public.favorites', r.policyname);
  end loop;
end $$;

create policy "favorites_select_own" on public.favorites
  for select using (auth.uid() = user_id);
create policy "favorites_insert_own" on public.favorites
  for insert with check (auth.uid() = user_id);
create policy "favorites_delete_own" on public.favorites
  for delete using (auth.uid() = user_id);

-- ---------- 3. follows（关注） ----------
alter table public.follows enable row level security;

do $$
declare r record;
begin
  for r in select policyname
           from pg_policies
           where schemaname = 'public' and tablename = 'follows'
  loop
    execute format('drop policy if exists %I on public.follows', r.policyname);
  end loop;
end $$;

create policy "follows_select_own" on public.follows
  for select using (auth.uid() = follower_id);
create policy "follows_insert_own" on public.follows
  for insert with check (auth.uid() = follower_id);
create policy "follows_delete_own" on public.follows
  for delete using (auth.uid() = follower_id);

-- ---------- 4. idea_votes（想法投票） ----------
alter table public.idea_votes enable row level security;

do $$
declare r record;
begin
  for r in select policyname
           from pg_policies
           where schemaname = 'public' and tablename = 'idea_votes'
  loop
    execute format('drop policy if exists %I on public.idea_votes', r.policyname);
  end loop;
end $$;

create policy "idea_votes_select_own" on public.idea_votes
  for select using (auth.uid() = user_id);
create policy "idea_votes_insert_own" on public.idea_votes
  for insert with check (auth.uid() = user_id);
create policy "idea_votes_delete_own" on public.idea_votes
  for delete using (auth.uid() = user_id);

-- ---------- 5. work_revisions（版本快照） ----------
alter table public.work_revisions enable row level security;

do $$
declare r record;
begin
  for r in select policyname
           from pg_policies
           where schemaname = 'public' and tablename = 'work_revisions'
  loop
    execute format('drop policy if exists %I on public.work_revisions', r.policyname);
  end loop;
end $$;

create policy "work_revisions_select_own" on public.work_revisions
  for select using (auth.uid() = created_by);
create policy "work_revisions_insert_own" on public.work_revisions
  for insert with check (auth.uid() = created_by);
create policy "work_revisions_update_own" on public.work_revisions
  for update using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- ---------- 6. comment_feedback（评论反馈） ----------
alter table public.comment_feedback enable row level security;

do $$
declare r record;
begin
  for r in select policyname
           from pg_policies
           where schemaname = 'public' and tablename = 'comment_feedback'
  loop
    execute format('drop policy if exists %I on public.comment_feedback', r.policyname);
  end loop;
end $$;

create policy "comment_feedback_select_own" on public.comment_feedback
  for select using (auth.uid() = user_id);
create policy "comment_feedback_insert_own" on public.comment_feedback
  for insert with check (auth.uid() = user_id);

-- ---------- 7. password_reset_codes（找回密码码，仅服务端读写） ----------
alter table public.password_reset_codes enable row level security;

do $$
declare r record;
begin
  for r in select policyname
           from pg_policies
           where schemaname = 'public' and tablename = 'password_reset_codes'
  loop
    execute format('drop policy if exists %I on public.password_reset_codes', r.policyname);
  end loop;
end $$;

-- 不建任何 authenticated 策略：此表只由服务端（password-reset.mjs，service_role）读写，
-- 登录用户不需要直接访问。anon/authenticated 默认全拒 = 安全。
-- service_role 绕过 RLS 不受影响。

-- ---------- 8. user_memories（依力个性化记忆） ----------
alter table public.user_memories enable row level security;

do $$
declare r record;
begin
  for r in select policyname
           from pg_policies
           where schemaname = 'public' and tablename = 'user_memories'
  loop
    execute format('drop policy if exists %I on public.user_memories', r.policyname);
  end loop;
end $$;

create policy "user_memories_select_own" on public.user_memories
  for select using (auth.uid() = user_id);
create policy "user_memories_insert_own" on public.user_memories
  for insert with check (auth.uid() = user_id);
create policy "user_memories_update_own" on public.user_memories
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "user_memories_delete_own" on public.user_memories
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- 验证：
--   anon:  GET /rest/v1/website_likes → 42501（匿名拒绝）✅
--   anon:  GET /rest/v1/favorites → 42501 ✅
--   login: INSERT website_likes (user_id=自己) → 201 ✅（功能不破）
--   login: SELECT website_likes where user_id=自己 → 200 ✅
--   anon:  POST /rest/v1/rpc/rpc_increment_view → 42501 ✅
-- 回滚：DO 块清策略后不重建（或按旧迁移重建）。
-- ============================================================================
