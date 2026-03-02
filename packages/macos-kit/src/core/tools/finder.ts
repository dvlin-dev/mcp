import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolRuntimeContext } from '../server.js'
import { registerTemplateTool } from './template-tool.js'

export function registerFinderTools(server: McpServer, context: ToolRuntimeContext) {
  registerTemplateTool(server, context, {
    name: 'get_selected_files',
    title: 'Get Selected Files',
    description: '获取 Finder 当前选中的文件路径',
    templateId: 'finder_get_selected_files',
    inputSchema: {},
  })

  registerTemplateTool(server, context, {
    name: 'search_files',
    title: 'Search Files',
    description: '按文件名搜索文件',
    templateId: 'finder_search_files',
    inputSchema: {
      query: z.string().describe('搜索关键词'),
      location: z.string().optional().describe('搜索目录（默认 ~）'),
    },
    toInputData: (args) => ({
      query: args.query,
      location: typeof args.location === 'string' ? args.location : '~',
    }),
  })

  registerTemplateTool(server, context, {
    name: 'quick_look_file',
    title: 'Quick Look File',
    description: '使用 Quick Look 预览文件',
    templateId: 'finder_quick_look_file',
    inputSchema: {
      path: z.string().describe('文件绝对路径'),
    },
    toInputData: (args) => ({ path: args.path }),
  })
}
