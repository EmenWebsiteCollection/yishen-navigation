// src/services/agent.js
// 站点助手纯逻辑（免费版）：站内规则问答，不依赖大模型 API。
// 只导出纯函数与常量，Node 可直接运行 agent.test.js 测试。

export const AGENT_MAX_QUERY_LENGTH = 80;

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
      reply.text = '你好，我是站点助手。想找作品、看推荐，或者了解投稿和联系方式，都可以直接问我。';
      break;
    case AGENT_INTENTS.THANKS:
      reply.text = '不客气，随时找我。';
      break;
    case AGENT_INTENTS.CONTACT:
      reply.text = '可以通过「联系我们」页面向团队反馈问题或建议。';
      links.push({ label: '联系我们', to: '/contact' });
      break;
    case AGENT_INTENTS.SUBMIT:
      reply.text = '登录后点击右上角「投稿」即可提交作品，网站、小说、插画、游戏等类型都可以。';
      links.push({ label: '去投稿', to: '/create' });
      break;
    case AGENT_INTENTS.ACCOUNT:
      reply.text = '使用账号在右上角登录；登录后可以投稿并管理自己的作品。';
      links.push({ label: '个人中心', to: '/profile' });
      links.push({ label: '忘记密码', to: '/forgot-password' });
      break;
    case AGENT_INTENTS.EDIT:
      reply.text = '个人中心里可以编辑、删除和管理自己的作品；作品详情页也提供编辑入口。';
      links.push({ label: '个人中心', to: '/profile' });
      break;
    case AGENT_INTENTS.ABOUT:
      reply.text = '这是一个由用户共同维护的创作与网站导航平台，访客可浏览，登录后可投稿并管理作品。';
      links.push({ label: '关于我们', to: '/about' });
      break;
    case AGENT_INTENTS.RECOMMEND:
      reply.text = items.length
        ? `为你找到 ${items.length} 个作品：`
        : '暂时没有可推荐的作品，稍后再来看看，或换个类型试试。';
      break;
    case AGENT_INTENTS.SEARCH:
      reply.text = items.length
        ? `为你找到 ${items.length} 个相关作品：`
        : '没有找到相关作品。换个关键词试试，也可以去投稿。';
      break;
    default:
      reply.text = '我还不太理解这个问题。你可以试试：「推荐网站」「找小说」「怎么投稿」「联系我们」。';
      break;
  }

  return reply;
}
