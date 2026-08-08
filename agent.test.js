// agent.test.js — 依力逻辑测试
// 运行：node agent.test.js（仓库 package.json 为 ESM）
import {
  AGENT_MAX_QUERY_LENGTH,
  AGENT_INTENTS,
  YILI_PERSONA_PROMPT,
  normalizeAgentQuery,
  extractWorkType,
  classifyAgentIntent,
  formatAgentReply,
} from './src/services/agent.js';

let pass = 0;
let fail = 0;
function t(name, cond) {
  if (cond) {
    pass++;
    console.log('  ✓ ' + name);
  } else {
    fail++;
    console.log('  ✗ ' + name);
  }
}

console.log('== normalizeAgentQuery ==');
t('去首尾空格', normalizeAgentQuery('  你好  ') === '你好');
t('合并连续空格', normalizeAgentQuery('找  小说  推荐') === '找 小说 推荐');
t('空输入', normalizeAgentQuery('') === '');
t('null 输入', normalizeAgentQuery(null) === '');
t('超长截断', normalizeAgentQuery('x'.repeat(100)).length === AGENT_MAX_QUERY_LENGTH);

console.log('== extractWorkType ==');
t('识别小说', extractWorkType('找好看的小说') === 'novel');
t('识别插画', extractWorkType('推荐插画作品') === 'illustration');
t('识别游戏', extractWorkType('有什么游戏') === 'game');
t('识别网站', extractWorkType('推荐网站') === 'website');
t('无类型返回 null', extractWorkType('随便聊聊') === null);

console.log('== classifyAgentIntent ==');
t('推荐意图', classifyAgentIntent('推荐高分网站') === AGENT_INTENTS.RECOMMEND);
t('搜索意图', classifyAgentIntent('找小说') === AGENT_INTENTS.SEARCH);
t('投稿意图', classifyAgentIntent('怎么投稿') === AGENT_INTENTS.SUBMIT);
t('联系意图', classifyAgentIntent('联系我们') === AGENT_INTENTS.CONTACT);
t('关于意图', classifyAgentIntent('这个平台是做什么的') === AGENT_INTENTS.ABOUT);
t('问候意图', classifyAgentIntent('你好') === AGENT_INTENTS.GREETING);
t('感谢意图', classifyAgentIntent('谢谢') === AGENT_INTENTS.THANKS);
t('账号意图', classifyAgentIntent('怎么登录') === AGENT_INTENTS.ACCOUNT);
t('编辑意图', classifyAgentIntent('怎么修改作品') === AGENT_INTENTS.EDIT);
t('兜底意图', classifyAgentIntent('随便聊聊') === AGENT_INTENTS.FALLBACK);
t('空输入兜底', classifyAgentIntent('') === AGENT_INTENTS.FALLBACK);

console.log('== formatAgentReply ==');
const persona = YILI_PERSONA_PROMPT;
t('人设包含依力', persona.includes('依力'));
t('人设要求简短回复', persona.includes('2-3 句'));
const WORKS = [
  { id: 1, title: '示例网站', url: 'https://example.com', username: '作者A', like_count: 10, work_type: 'website' },
  { id: 2, title: '示例小说', username: '作者B', like_count: 5, work_type: 'novel' },
];
const rec = formatAgentReply(AGENT_INTENTS.RECOMMEND, '推荐网站', WORKS);
t('推荐带结果', rec.works.length === 2 && rec.text.includes('2 个作品'));
const empty = formatAgentReply(AGENT_INTENTS.SEARCH, '不存在的词', []);
t('无结果兜底', empty.works.length === 0 && empty.text.includes('没有找到'));
const contact = formatAgentReply(AGENT_INTENTS.CONTACT, '联系我们', []);
t('FAQ 带链接', contact.links.some((l) => l.to === '/contact'));
const fallback = formatAgentReply(AGENT_INTENTS.FALLBACK, '随便聊聊', []);
t('兜底提示', fallback.text.includes('推荐网站'));
t('非法入参不崩溃', typeof formatAgentReply('', '', null).text === 'string');

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
