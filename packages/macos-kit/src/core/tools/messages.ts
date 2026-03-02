import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolRuntimeContext } from '../server.js'
import { registerTemplateTool } from './template-tool.js'

export function registerMessagesTools(
  server: McpServer,
  context: ToolRuntimeContext
) {
  registerTemplateTool(server, context, {
    name: 'messages_list_chats',
    title: 'Messages List Chats',
    description: '列出 Messages 会话',
    templateId: 'messages_messages_list_chats',
    inputSchema: {
      include_participant_details: z.boolean().optional(),
    },
    toInputData: (args) => ({
      include_participant_details:
        typeof args.include_participant_details === 'boolean'
          ? args.include_participant_details
          : false,
    }),
  })

  registerTemplateTool(server, context, {
    name: 'messages_get_messages',
    title: 'Messages Get Messages',
    description: '获取最近消息',
    templateId: 'messages_messages_get_messages',
    inputSchema: {
      limit: z.number().int().positive().optional(),
    },
    toInputData: (args) => ({ limit: typeof args.limit === 'number' ? args.limit : 100 }),
  })

  registerTemplateTool(server, context, {
    name: 'messages_search_messages',
    title: 'Messages Search Messages',
    description: '搜索消息内容',
    templateId: 'messages_messages_search_messages',
    inputSchema: {
      search_text: z.string().describe('搜索关键词'),
      sender: z.string().optional(),
      chat_id: z.string().optional(),
      limit: z.number().int().positive().optional(),
      days_back: z.number().int().positive().optional(),
    },
    toInputData: (args) => ({
      search_text: args.search_text,
      sender: typeof args.sender === 'string' ? args.sender : '',
      chat_id: typeof args.chat_id === 'string' ? args.chat_id : '',
      limit: typeof args.limit === 'number' ? args.limit : 50,
      days_back: typeof args.days_back === 'number' ? args.days_back : 30,
    }),
  })

  registerTemplateTool(server, context, {
    name: 'messages_compose_message',
    title: 'Messages Compose Message',
    description: '在 Messages 中预填或自动发送消息',
    templateId: 'messages_messages_compose_message',
    inputSchema: {
      recipient: z.string().describe('收件人手机号或邮箱'),
      body: z.string().optional(),
      auto: z.boolean().optional(),
    },
    toInputData: (args) => ({
      recipient: args.recipient,
      body: typeof args.body === 'string' ? args.body : '',
      auto: typeof args.auto === 'boolean' ? args.auto : false,
    }),
  })
}
