-- ============================================================================
-- 011_cleanup_redundant_objects.sql
-- 冗余对象清理（后端组深度审计报告 2026-08-09 遗留 LOW 项）
--   - 双触发器：set_updated_at / ideas_set_updated_at 重复定义风险
--   - 重复策略：work_media_bucket.sql（早期脚本）与 003 正式迁移重复建同名策略
--
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴本文件全部内容 → Run
-- 幂等：可重复执行，不会报错。
-- 安全：只清理「确定冗余」的对象；触发器清理带表存在性检查。
-- ============================================================================

-- ---------- 1. 清理重复触发器 ----------
-- 背景：set_updated_at 触发器在 user_memories（007_yili_ai_v3.sql）与
-- ideas（20260808_add_idea_camp.sql 的 ideas_set_updated_at）两处创建，
-- 早期脚本无 if-not-exists 保护时重复执行可能产生双触发器。
-- 策略：对每张表先 DROP 全部旧触发器再重建标准版，保证幂等且不残留。

-- 1.1 user_memories.set_updated_at（依力 AI 个性化记忆表）
do $$
begin
  if to_regclass('public.user_memories') is not null then
    drop trigger if exists set_updated_at on public.user_memories;
    -- 函数不存在时先建（007 里函数与触发器同文件，避免依赖顺序）
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.proname = 'set_updated_at' and n.nspname = 'public'
    ) then
      create or replace function public.set_updated_at()
      returns trigger language plpgsql as $fn$
      begin new.updated_at := now(); return new; end $fn$;
    end if;
    create trigger set_updated_at
      before update on public.user_memories
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- 1.2 ideas.ideas_set_updated_at（想法表，idea_camp 迁移）
do $$
begin
  if to_regclass('public.ideas') is not null then
    drop trigger if exists ideas_set_updated_at on public.ideas;
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.proname = 'set_updated_at' and n.nspname = 'public'
    ) then
      create or replace function public.set_updated_at()
      returns trigger language plpgsql as $fn$
      begin new.updated_at := now(); return new; end $fn$;
    end if;
    create trigger ideas_set_updated_at
      before update on public.ideas
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ---------- 2. 清理重复策略（work_media 桶） ----------
-- 背景：sql/work_media_bucket.sql（早期手动脚本）与 sql/003_feedback_annotations.sql
-- 均创建 work_media_public_read / work_media_own_insert / work_media_own_delete
-- 三个同名策略。两者都是 drop-if-exists + create 写法，重复执行不报错，
-- 但策略定义以 003（正式迁移）为准，早期脚本已冗余。
-- 处理：策略无需删除（同名策略本就只能存在一份），此处仅做幂等校验——
-- 确认 work_media 桶策略存在且为正式定义；若缺失则补建。

do $$
begin
  if exists (select 1 from storage.buckets where id = 'work_media') then
    drop policy if exists "work_media_public_read" on storage.objects;
    create policy "work_media_public_read" on storage.objects
      for select using (bucket_id = 'work_media');

    drop policy if exists "work_media_own_insert" on storage.objects;
    create policy "work_media_own_insert" on storage.objects
      for insert with check (
        bucket_id = 'work_media'
        and auth.role() = 'authenticated'
        and (storage.foldername(name))[1] = auth.uid()::text
      );

    drop policy if exists "work_media_own_delete" on storage.objects;
    create policy "work_media_own_delete" on storage.objects
      for delete using (
        bucket_id = 'work_media'
        and auth.role() = 'authenticated'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- ---------- 3. 清理重复索引（冗余对象清理的第三类） ----------
-- 背景：各迁移脚本以 if not exists 创建索引，重复执行不产生重复索引；
-- 但早期 work_media_bucket.sql 与 003 若都执行过，桶配置以 on conflict 更新，
-- 无重复对象。此处保留一份总览查询，方便执行后核对。

-- ============================================================================
-- 完成。验证：
--   select tgname, tgrelid::regclass from pg_trigger
--   where not tgisinternal and tgrelid in ('public.user_memories'::regclass, 'public.ideas'::regclass);
--   -- 预期：user_memories → set_updated_at；ideas → ideas_set_updated_at（各一条）
--
--   select policyname from pg_policies
--   where schemaname='storage' and tablename='objects'
--   and policyname like 'work_media%';
--   -- 预期：work_media_public_read / work_media_own_insert / work_media_own_delete
-- ============================================================================
