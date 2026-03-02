import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolRuntimeContext } from '../server.js'
import { registerTemplateTool } from './template-tool.js'

export function registerNotificationTools(
  server: McpServer,
  context: ToolRuntimeContext
) {
  registerTemplateTool(server, context, {
    name: 'send_notification',
    title: 'Send Notification',
    description: '发送系统通知',
    templateId: 'notifications_send_notification',
    inputSchema: {
      title: z.string().describe('通知标题'),
      message: z.string().describe('通知内容'),
      sound: z.string().optional().describe('提示音名称'),
    },
    toInputData: (args) => ({
      title: args.title,
      message: args.message,
      sound: typeof args.sound === 'string' ? args.sound : '',
    }),
  })

  registerTemplateTool(server, context, {
    name: 'toggle_do_not_disturb',
    title: 'Toggle Do Not Disturb',
    description: '尝试切换专注模式（依赖系统版本）',
    templateId: 'notifications_toggle_do_not_disturb',
    inputSchema: {},
  })
}
