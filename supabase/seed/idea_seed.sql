-- ============================================================================
-- supabase/seed/idea_seed.sql
-- Issue #12「想法集中营」种子数据：避免空板启动（Empty Fridge 陷阱）
-- 用仓库真实 Issue 作为「已实现」示范，让第一条闭环可见
--
-- 执行方式：迁移 20260808_add_idea_camp.sql 之后执行本文件（幂等，按标题去重）
-- ============================================================================

do $$
declare
  v_author uuid;
  v_work uuid;
begin
  -- 作者：优先取管理员账号，其次取最早注册用户
  select id into v_author from public.profiles where is_admin order by created_at limit 1;
  if v_author is null then
    select id into v_author from public.profiles order by created_at limit 1;
  end if;
  if v_author is null then
    raise notice '暂无用户，跳过想法种子数据';
    return;
  end if;

  -- ===== 已实现示范（对应真实 Issue #19 / #10 / #14）=====
  if not exists (select 1 from public.ideas where title = '网站搜索：标题/URL/描述全局搜索') then
    v_work := null;
    select id into v_work from public.works where title ilike '%搜索%' order by created_at desc limit 1;
    insert into public.ideas (user_id, title, description, category, tags, status, related_work_id)
    values (v_author, '网站搜索：标题/URL/描述全局搜索',
            '在导航页加入搜索框，支持标题、URL、描述模糊匹配，并按相关度与点赞数排序（Issue #19）。',
            'website', array['搜索','导航'], 'done', v_work);
  end if;

  if not exists (select 1 from public.ideas where title = '网站演示视频入口') then
    v_work := null;
    select id into v_work from public.works where video_url is not null order by created_at desc limit 1;
    insert into public.ideas (user_id, title, description, category, tags, status, related_work_id)
    values (v_author, '网站演示视频入口',
            '详情页增加「观看演示视频」入口，跳转到 B 站/YouTube 查看站点演示（Issue #10）。',
            'website', array['视频','详情页'], 'done', v_work);
  end if;

  if not exists (select 1 from public.ideas where title = '图片加载优化：懒加载与占位') then
    v_work := null;
    insert into public.ideas (user_id, title, description, category, tags, status, related_work_id)
    values (v_author, '图片加载优化：懒加载与占位',
            '列表与详情页图片懒加载 + 加载失败占位，减少首屏卡顿（Issue #14）。',
            'website', array['性能','图片'], 'done', v_work);
  end if;

  -- ===== 运营位（置顶）=====
  if not exists (select 1 from public.ideas where title = '想法星期三：每周一个主题征集') then
    insert into public.ideas (user_id, title, description, category, tags, status, pinned)
    values (v_author, '想法星期三：每周一个主题征集',
            '每周由管理员发布一个主题帖并置顶（如「最想被做成网站的 App 点子」），
大家围绕主题发想法，一周后由运营整理成作品待办。保证内容供给稳定，避免板子凉掉。',
            'community', array['运营','周主题'], 'idea', true);
  end if;

  if not exists (select 1 from public.ideas where title = '想法 → 作品一键孵化') then
    insert into public.ideas (user_id, title, description, category, tags, status, pinned)
    values (v_author, '想法 → 作品一键孵化',
            '在想法详情页点「去实现」，直接进入新建作品页并自动关联该想法；作品发布后想法自动标记「已实现」并回链作品，形成完整孵化闭环。',
            'tool', array['孵化','闭环'], 'developing', true);
  end if;

  -- ===== 灵感类新想法 =====
  if not exists (select 1 from public.ideas where title = '创作者匹配：找画师/找程序员') then
    insert into public.ideas (user_id, title, description, category, tags, status)
    values (v_author, '创作者匹配：找画师/找程序员',
            '按「我会什么 / 我需要什么 / 是否付费 / 每周可投入时间」匹配合作对象：编剧找画师、策划找程序员、作者找封面设计师。',
            'community', array['匹配','合作'], 'idea');
  end if;

  if not exists (select 1 from public.ideas where title = '创作小组：小说组 / 独立游戏组') then
    insert into public.ideas (user_id, title, description, category, tags, status)
    values (v_author, '创作小组：小说组 / 独立游戏组',
            '创作者可以创建或加入小组（小说写作组、独立游戏开发组、插画练习组等），组内发布作品、讨论、组织活动、共享资料。',
            'community', array['小组','社区'], 'idea');
  end if;

  if not exists (select 1 from public.ideas where title = '接力创作：原作与衍生关系树') then
    insert into public.ideas (user_id, title, description, category, tags, status)
    values (v_author, '接力创作：原作与衍生关系树',
            '一个人发布基础作品，其他人续写/重设计/二创/混剪；系统清晰展示原作与衍生作品之间的关系链。',
            'writing', array['接力','二创'], 'idea');
  end if;

  if not exists (select 1 from public.ideas where title = '周主题创作挑战 + 自动展览页') then
    insert into public.ideas (user_id, title, description, category, tags, status)
    values (v_author, '周主题创作挑战 + 自动展览页',
            '平台定期发布挑战（每日绘画主题、七日短篇、限定色彩等），挑战结束后自动生成专题展览页。',
            'illustration', array['挑战','展览'], 'idea');
  end if;

  if not exists (select 1 from public.ideas where title = '一键把平台建议导出为 GitHub Issue') then
    insert into public.ideas (user_id, title, description, category, tags, status)
    values (v_author, '一键把平台建议导出为 GitHub Issue',
            '勾选「这是给平台本身的建议」的想法，管理员可一键生成 GitHub Issue，把社区想法直接送进开发队列。',
            'tool', array['建议','GitHub'], 'idea');
  end if;

  if not exists (select 1 from public.ideas where title = '想法被实现后点亮「已实现」徽章') then
    insert into public.ideas (user_id, title, description, category, tags, status)
    values (v_author, '想法被实现后点亮「已实现」徽章',
            '想法关联作品后，卡片与创作者主页都显示「✓ 已实现」高亮，形成对提想法者的正向激励。',
            'community', array['激励','徽章'], 'idea');
  end if;

  if not exists (select 1 from public.ideas where title = 'AI 辅助创作研究组') then
    insert into public.ideas (user_id, title, description, category, tags, status)
    values (v_author, 'AI 辅助创作研究组',
            '组建一个专门研究 AI 辅助创作的小组：工具链、提示词库、多模态交接工作流，沉淀成可复用的经验。',
            'ai', array['AI','研究'], 'idea');
  end if;

  if not exists (select 1 from public.ideas where title = '暗色模式下的作品截图适配') then
    insert into public.ideas (user_id, title, description, category, tags, status)
    values (v_author, '暗色模式下的作品截图适配',
            '自动截图对暗色站点会出现黑底糊图，建议截图前探测主题或提供手动上传封面兜底。',
            'website', array['截图','适配'], 'idea');
  end if;

  raise notice '想法种子数据已就绪';
end $$;
