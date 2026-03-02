import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolRuntimeContext } from '../server.js'
import { registerTemplateTool } from './template-tool.js'

export function registerNotesTools(server: McpServer, context: ToolRuntimeContext) {
  registerTemplateTool(server, context, {
    name: 'notes_create',
    title: 'Notes Create',
    description: '创建普通文本笔记',
    templateId: 'notes_notes_create',
    inputSchema: {
      title: z.string().describe('笔记标题'),
      content: z.string().describe('笔记内容'),
    },
    toInputData: (args) => ({ title: args.title, content: args.content }),
  })

  registerTemplateTool(server, context, {
    name: 'notes_create_raw_html',
    title: 'Notes Create Raw HTML',
    description: '创建 HTML 内容笔记',
    templateId: 'notes_notes_create_raw_html',
    inputSchema: {
      title: z.string().describe('笔记标题'),
      html: z.string().describe('HTML 内容'),
    },
    toInputData: (args) => ({ title: args.title, html: args.html }),
  })

  registerTemplateTool(server, context, {
    name: 'notes_list',
    title: 'Notes List',
    description: '列出笔记标题',
    templateId: 'notes_notes_list',
    inputSchema: {
      folder: z.string().optional().describe('文件夹名称'),
    },
    toInputData: (args) => ({
      folder: typeof args.folder === 'string' ? args.folder : '',
    }),
  })

  registerTemplateTool(server, context, {
    name: 'notes_get',
    title: 'Notes Get',
    description: '按标题获取笔记内容',
    templateId: 'notes_notes_get',
    inputSchema: {
      title: z.string().describe('笔记标题'),
      folder: z.string().optional().describe('可选文件夹'),
    },
    toInputData: (args) => ({
      title: args.title,
      folder: typeof args.folder === 'string' ? args.folder : '',
    }),
  })

  registerTemplateTool(server, context, {
    name: 'notes_search',
    title: 'Notes Search',
    description: '搜索笔记',
    templateId: 'notes_notes_search',
    inputSchema: {
      query: z.string().describe('搜索关键词'),
      folder: z.string().optional().describe('可选文件夹'),
      limit: z.number().int().positive().optional().describe('结果数量'),
      include_body: z.boolean().optional().describe('是否包含正文'),
    },
    toInputData: (args) => ({
      query: args.query,
      folder: typeof args.folder === 'string' ? args.folder : '',
      limit: typeof args.limit === 'number' ? args.limit : 10,
      include_body: typeof args.include_body === 'boolean' ? args.include_body : true,
    }),
  })
}
