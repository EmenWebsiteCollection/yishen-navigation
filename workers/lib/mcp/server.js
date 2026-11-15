// 伊神导航 MCP server——核心层。
//
// 这里只定义「有哪些工具、每个工具做什么」，不含任何传输方式。
// 本地 stdio（src/stdio.js）和线上 HTTP（src/http.js）共用同一个 factory。

import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import * as yishen from './yishen.js';

export const SERVER_INFO = {
  name: 'yishen-nav',
  version: '0.1.0',
};

/** 统一的成功返回：把结构化数据序列化成文本给模型看 */
const ok = (payload) => ({
  content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
});

/** 统一的失败返回：不抛异常，让模型知道发生了什么并自己决定下一步 */
const fail = (err) => ({
  content: [{ type: 'text', text: `调用失败：${err && err.message ? err.message : String(err)}` }],
  isError: true,
});

async function run(fn) {
  try {
    return ok(await fn());
  } catch (err) {
    return fail(err);
  }
}

/** 新建一个已注册全部工具的 server 实例（MCP 规范要求每个请求一个实例） */
export function createServer() {
  const server = new McpServer(SERVER_INFO, { capabilities: { tools: {} } });

  server.registerTool(
    'list_partitions',
    {
      title: '列出作品分区',
      description:
        '列出伊神导航站的所有作品分区（如科技、网站、小说等）。' +
        '当用户想知道站点有哪些分类、或不确定该翻哪一类时先调用它，' +
        '拿到 work_type 后再用 list_works 按分区浏览。',
      inputSchema: z.object({}),
    },
    async () => run(() => yishen.listPartitions()),
  );

  server.registerTool(
    'list_works',
    {
      title: '浏览作品列表',
      description:
        '分页浏览伊神导航站的作品。可按分区筛选（work_type 取自 list_partitions），' +
        '排序支持 new（最新发布）、hot（点赞最多）、mixed（点赞与浏览量加权综合推荐）。' +
        '用户想「看看某类作品」「翻下一页」时用。',
      inputSchema: z.object({
        page: z.number().int().min(1).optional().describe('页码，从 1 开始，默认 1'),
        page_size: z.number().int().min(1).max(50).optional().describe('每页条数，1-50，默认 10'),
        work_type: z.string().optional().describe('分区标识，如 tech、website、novel；不填为全部分区'),
        sort: z.enum(['new', 'hot', 'mixed']).optional().describe('排序方式，默认 new'),
      }),
    },
    async ({ page, page_size, work_type, sort }) =>
      run(() => yishen.listWorks({ page, page_size, work_type, sort })),
  );

  server.registerTool(
    'get_recent_works',
    {
      title: '最近的新作品',
      description:
        '获取伊神导航站最近若干天内发布的新作品（默认 14 天）。' +
        '用户问「最近有什么新东西」「这周有人发作品吗」时用。',
      inputSchema: z.object({
        days: z.number().int().min(1).max(90).optional().describe('回溯天数，1-90，默认 14'),
        limit: z.number().int().min(1).max(30).optional().describe('返回条数，1-30，默认 8'),
      }),
    },
    async ({ days, limit }) => run(() => yishen.recentWorks({ days, limit })),
  );

  server.registerTool(
    'get_top_works',
    {
      title: '点赞榜',
      description:
        '获取伊神导航站点赞数最高的作品榜单。' +
        '用户问「最火的」「最受欢迎的」「高分作品」时用。',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(30).optional().describe('返回条数，1-30，默认 8'),
      }),
    },
    async ({ limit }) => run(() => yishen.topWorks({ limit })),
  );

  server.registerTool(
    'search_works',
    {
      title: '搜索作品',
      description:
        '在伊神导航站按关键词搜索作品，匹配标题、简介、标签、风格、工具和作者名。' +
        '用户想找特定主题的作品（如「AI」「桌宠」「法语」）时优先用它；' +
        '搜完再用返回的 url 把作品详情页给用户。',
      inputSchema: z.object({
        keyword: z.string().min(1).describe('搜索关键词，支持中文'),
        limit: z.number().int().min(1).max(30).optional().describe('返回条数，1-30，默认 10'),
      }),
    },
    async ({ keyword, limit }) => run(() => yishen.searchWorks({ keyword, limit })),
  );

  return server;
}

/** MCP 规范：每个请求一个全新实例（2026-07-28 起协议无状态） */
export const serverFactory = () => createServer();
