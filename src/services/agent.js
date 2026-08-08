// src/services/agent.js
// 依力纯逻辑（免费版）：站内规则问答，不依赖大模型 API。
// 只导出纯函数与常量，Node 可直接运行 agent.test.js 测试。

export const AGENT_MAX_QUERY_LENGTH = 80;

// 依力口语人设（来自内部测试包：AI 调用接口文档 §四）
export const YILI_PERSONA_PROMPT = `你是「依力」，依神网站汇总的看板郎助手。
性格：活泼、口语化、有点俏皮；自称"依力"；偶尔用 emoji 但不过度。
任务：陪用户闲聊，并引导使用站内功能（首页/发现页/想法集中营/搜索）。
推荐内容时给具体入口；不知道的事就大方承认，不要编造。
回复保持简短（2-3 句以内）。`;

export const AGENT_INTENTS = {
  RECOMMEND: 'recommend',
  SEARCH: 'search',
  SUBMIT: 'submit',
  ACCOUNT: 'account',
  EDIT: 'edit',
  CONTACT: 'contact',
  ABOUT: 'about',
  GREETING: 'greeting',
  THANKS: 'thanks',
  FALLBACK: 'fallback',
};

export const WORK_TYPE_KEYWORDS = [
  { type: 'website', keywords: ['网站', '站点', '网页', '导航'] },
  { type: 'novel', keywords: ['小说', '长篇', '短篇', '轻小说'] },
  { type: 'illustration', keywords: ['插画', '原画', '绘画', '画作', '壁纸'] },
  { type: 'game', keywords: ['游戏', '小游戏', '独立游戏'] },
  { type: 'music', keywords: ['音乐', '歌曲', '音频'] },
  { type: 'video', keywords: ['视频', '影片', '影视', '番剧'] },
  { type: 'photo', keywords: ['摄影', '照片', '图片'] },
  { type: 'other', keywords: ['工具', '应用'] },
];

export function normalizeAgentQuery(q) {
  return String(q || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, AGENT_MAX_QUERY_LENGTH);
}

export function extractWorkType(q) {
  const query = normalizeAgentQuery(q).toLowerCase();
  if (!query) return null;
  for (const group of WORK_TYPE_KEYWORDS) {
    if (group.keywords.some((keyword) => query.includes(keyword.toLowerCase()))) {
      return group.type;
    }
  }
  return null;
}

export function classifyAgentIntent(q) {
  const query = normalizeAgentQuery(q).toLowerCase();
  if (!query) return AGENT_INTENTS.FALLBACK;

  if (/^(你好|您好|嗨|hello|hi)$/i.test(query)) return AGENT_INTENTS.GREETING;
  if (/谢谢|感谢|辛苦/.test(query)) return AGENT_INTENTS.THANKS;
  if (/联系|反馈|建议|合作|邮箱|微信|qq|投诉|意见|找你们|找我们/.test(query)) return AGENT_INTENTS.CONTACT;
  if (/投稿|提交|上传|发布|添加|收录|创建作品|提交作品|发布作品|怎么加/.test(query)) return AGENT_INTENTS.SUBMIT;
  if (/登录|注册|账号|密码|退出|登出|忘记密码/.test(query)) return AGENT_INTENTS.ACCOUNT;
  if (/修改|编辑|删除|撤销|取消|私密|公开|管理/.test(query)) return AGENT_INTENTS.EDIT;
  if (/关于|是什么|介绍|这个平台|这个网站|了解你们|你们是|平台是/.test(query)) return AGENT_INTENTS.ABOUT;
  if (/推荐|高分|热门|排行|精选|有什么好|帮我找|有啥|看看|找点/.test(query)) return AGENT_INTENTS.RECOMMEND;
  if (/找|搜索|查|有没有|哪个|在哪里|想找|我想/.test(query)) return AGENT_INTENTS.SEARCH;
  return AGENT_INTENTS.FALLBACK;
}

function normalizeResultItem(item) {
  if (!item || item.id == null) return null;
  return {
    id: item.id,
    title: item.title || '未命名作品',
    url: item.url || null,
    username: item.username || '用户',
    like_count: item.like_count || 0,
    work_type: item.work_type || 'website',
  };
}

export function formatAgentReply(intent, query, works = []) {
  const items = (Array.isArray(works) ? works : []).map(normalizeResultItem).filter(Boolean);
  const links = [];
  const reply = { works: items, links };

  switch (intent) {
    case AGENT_INTENTS.GREETING:
      reply.text = '你好呀，我是依力～想看点什么都可以直接问我，找作品、要推荐、问投稿都行！';
      break;
    case AGENT_INTENTS.THANKS:
      reply.text = '嘿嘿，不用谢，随时来找我玩～';
      break;
    case AGENT_INTENTS.CONTACT:
      reply.text = '有想反馈的都可以去「联系我们」页面找团队，建议和问题都欢迎～';
      links.push({ label: '联系我们', to: '/contact' });
      break;
    case AGENT_INTENTS.SUBMIT:
      reply.text = '登录后点右上角「投稿」就能把作品放上来啦，网站、小说、插画、游戏都能投～';
      links.push({ label: '去投稿', to: '/create' });
      break;
    case AGENT_INTENTS.ACCOUNT:
      reply.text = '右上角登录一下就好，登录后就能投稿和打理自己的作品啦。';
      links.push({ label: '个人中心', to: '/profile' });
      links.push({ label: '忘记密码', to: '/forgot-password' });
      break;
    case AGENT_INTENTS.EDIT:
      reply.text = '去个人中心就能编辑、删除和管理自己的作品，详情页里也有编辑入口哦。';
      links.push({ label: '个人中心', to: '/profile' });
      break;
    case AGENT_INTENTS.ABOUT:
      reply.text = '这里是大家共同维护的创作与网站导航平台，游客能逛，登录后还能投稿和管理作品～';
      links.push({ label: '关于我们', to: '/about' });
      break;
    case AGENT_INTENTS.RECOMMEND:
      reply.text = items.length
        ? `给你挑了 ${items.length} 个作品，点卡片就能看～`
        : '唔，暂时没找到合适的作品，换个类型试试，或者过会儿再来看看？';
      break;
    case AGENT_INTENTS.SEARCH:
      reply.text = items.length
        ? `找到 ${items.length} 个相关作品，看看有没有想要的～`
        : '没有找到相关作品呢，换个关键词试试，或者把你的宝藏作品投上来？';
      break;
    default:
      reply.text = '唔，这个我还没学会呢。可以试试问我「推荐网站」「找小说」「怎么投稿」或「联系我们」～';
      break;
  }

  return reply;
}
