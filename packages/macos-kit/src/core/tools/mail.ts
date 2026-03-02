import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolRuntimeContext } from '../server.js'
import { registerTemplateTool } from './template-tool.js'

export function registerMailTools(server: McpServer, context: ToolRuntimeContext) {
  registerTemplateTool(server, context, {
    name: 'mail_create_email',
    title: 'Mail Create Email',
    description: '创建 Mail 草稿邮件',
    templateId: 'mail_mail_create_email',
    inputSchema: {
      recipient: z.string().describe('收件人邮箱'),
      subject: z.string().describe('主题'),
      body: z.string().describe('正文'),
    },
    toInputData: (args) => ({
      recipient: args.recipient,
      subject: args.subject,
      body: args.body,
    }),
  })

  registerTemplateTool(server, context, {
    name: 'mail_list_emails',
    title: 'Mail List Emails',
    description: '列出 Mail 邮件摘要',
    templateId: 'mail_mail_list_emails',
    inputSchema: {
      mailbox: z.string().optional().describe('邮箱目录，默认 INBOX'),
      count: z.number().int().positive().optional().describe('返回数量'),
      unread_only: z.boolean().optional().describe('仅未读'),
    },
    toInputData: (args) => ({
      mailbox: typeof args.mailbox === 'string' ? args.mailbox : 'INBOX',
      count: typeof args.count === 'number' ? args.count : 20,
      unread_only: typeof args.unread_only === 'boolean' ? args.unread_only : false,
    }),
  })

  registerTemplateTool(server, context, {
    name: 'mail_get_email',
    title: 'Mail Get Email',
    description: '按条件获取单封邮件',
    templateId: 'mail_mail_get_email',
    inputSchema: {
      subject: z.string().optional(),
      sender: z.string().optional(),
      mailbox: z.string().optional(),
      account: z.string().optional(),
      unread_only: z.boolean().optional(),
      include_body: z.boolean().optional(),
    },
    toInputData: (args) => ({
      subject: typeof args.subject === 'string' ? args.subject : '',
      sender: typeof args.sender === 'string' ? args.sender : '',
      mailbox: typeof args.mailbox === 'string' ? args.mailbox : 'INBOX',
      account: typeof args.account === 'string' ? args.account : '',
      unread_only: typeof args.unread_only === 'boolean' ? args.unread_only : false,
      include_body: typeof args.include_body === 'boolean' ? args.include_body : true,
    }),
  })
}
