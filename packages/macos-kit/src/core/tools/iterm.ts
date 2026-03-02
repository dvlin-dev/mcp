import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolRuntimeContext } from '../server.js'
import { registerTemplateTool } from './template-tool.js'

export function registerItermTools(server: McpServer, context: ToolRuntimeContext) {
  registerTemplateTool(server, context, {
    name: 'iterm_run',
    title: 'iTerm Run',
    description: '在 iTerm 中执行命令',
    templateId: 'iterm_iterm_run',
    inputSchema: {
      command: z.string().describe('要执行的命令'),
      new_window: z.boolean().optional().describe('是否新开窗口'),
    },
    toInputData: (args) => ({
      command: args.command,
      new_window: typeof args.new_window === 'boolean' ? args.new_window : false,
    }),
  })

  registerTemplateTool(server, context, {
    name: 'iterm_paste_clipboard',
    title: 'iTerm Paste Clipboard',
    description: '将剪贴板粘贴到 iTerm 当前会话',
    templateId: 'iterm_iterm_paste_clipboard',
    inputSchema: {},
  })
}
