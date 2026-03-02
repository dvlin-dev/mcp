import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolRuntimeContext } from '../server.js'
import { registerTemplateTool } from './template-tool.js'

export function registerClipboardTools(
  server: McpServer,
  context: ToolRuntimeContext
) {
  registerTemplateTool(server, context, {
    name: 'get_clipboard',
    title: 'Get Clipboard',
    description: '读取剪贴板内容',
    templateId: 'clipboard_get_clipboard',
    inputSchema: {},
  })

  registerTemplateTool(server, context, {
    name: 'set_clipboard',
    title: 'Set Clipboard',
    description: '写入剪贴板内容',
    templateId: 'clipboard_set_clipboard',
    inputSchema: {
      content: z.string().describe('写入内容'),
    },
    toInputData: (args) => ({ content: args.content }),
  })

  registerTemplateTool(server, context, {
    name: 'clear_clipboard',
    title: 'Clear Clipboard',
    description: '清空剪贴板',
    templateId: 'clipboard_clear_clipboard',
    inputSchema: {},
  })
}
