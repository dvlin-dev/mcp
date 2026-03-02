import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolRuntimeContext } from '../server.js'
import { registerTemplateTool } from './template-tool.js'

export function registerShortcutsTools(
  server: McpServer,
  context: ToolRuntimeContext
) {
  registerTemplateTool(server, context, {
    name: 'run_shortcut',
    title: 'Run Shortcut',
    description: '运行快捷指令',
    templateId: 'shortcuts_run_shortcut',
    inputSchema: {
      name: z.string().describe('快捷指令名称'),
      input: z.string().optional().describe('可选输入文本'),
    },
    toInputData: (args) => ({
      name: args.name,
      input: typeof args.input === 'string' ? args.input : '',
    }),
  })

  registerTemplateTool(server, context, {
    name: 'list_shortcuts',
    title: 'List Shortcuts',
    description: '列出快捷指令',
    templateId: 'shortcuts_list_shortcuts',
    inputSchema: {
      limit: z.number().int().positive().optional().describe('数量限制'),
    },
    toInputData: (args) => ({
      limit: typeof args.limit === 'number' ? args.limit : 50,
    }),
  })
}
