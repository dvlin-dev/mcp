import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AppConfig } from '../config.js'
import { resolveAccount } from '../config.js'
import { ImapClient } from '../imap-client.js'

/**
 * 注册邮件读取相关工具
 */
export function registerReadTools(server: McpServer, config: AppConfig) {
  /**
   * 工具：获取邮件详情
   */
  server.registerTool(
    'get_email_detail',
    {
      title: 'Get Email Detail',
      description:
        'Get full details of an email including body content, headers, and attachment info',
      inputSchema: {
        account_id: z.string().describe('Account ID'),
        uid: z.number().describe('Email UID'),
        folder: z
          .string()
          .optional()
          .describe('Folder containing the email (default: INBOX)'),
      },
    },
    async ({ account_id, uid, folder }) => {
      const account = config.ACCOUNTS.find((a) => a.id === account_id)
      if (!account) {
        return {
          content: [{ type: 'text', text: `Account "${account_id}" not found` }],
          isError: true,
        }
      }

      const resolved = resolveAccount(account)
      const client = new ImapClient(resolved)

      try {
        const email = await client.getEmailDetail({
          uid,
          folder: folder ?? 'INBOX',
          includeAttachmentContent: false,
        })

        if (!email) {
          return {
            content: [
              {
                type: 'text',
                text: `Email with UID ${uid} not found in ${folder ?? 'INBOX'}`,
              },
            ],
            isError: true,
          }
        }

        // 构建输出
        const lines = [
          `# ${email.subject}`,
          '',
          `**From:** ${email.from}`,
          `**To:** ${email.to}`,
        ]

        if (email.cc) lines.push(`**Cc:** ${email.cc}`)
        lines.push(
          `**Date:** ${email.date}`,
          `**Message-ID:** ${email.messageId}`,
          `**Status:** ${email.seen ? 'Read' : 'Unread'}${email.flagged ? ' ⭐' : ''}`
        )

        if (email.attachments.length > 0) {
          lines.push(
            '',
            '**Attachments:**',
            ...email.attachments.map(
              (a) => `- ${a.filename} (${formatSize(a.size)}, ${a.contentType})`
            )
          )
        }

        lines.push('', '---', '', email.textBody || '(No text content)')

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to get email: ${error instanceof Error ? error.message : error}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  /**
   * 工具：获取附件
   */
  server.registerTool(
    'get_attachments',
    {
      title: 'Get Email Attachments',
      description:
        'Download attachments from an email. Returns attachment content as base64.',
      inputSchema: {
        account_id: z.string().describe('Account ID'),
        uid: z.number().describe('Email UID'),
        folder: z
          .string()
          .optional()
          .describe('Folder containing the email (default: INBOX)'),
      },
    },
    async ({ account_id, uid, folder }) => {
      const account = config.ACCOUNTS.find((a) => a.id === account_id)
      if (!account) {
        return {
          content: [{ type: 'text', text: `Account "${account_id}" not found` }],
          isError: true,
        }
      }

      const resolved = resolveAccount(account)
      const client = new ImapClient(resolved)

      try {
        const attachments = await client.getAttachments({
          uid,
          folder: folder ?? 'INBOX',
        })

        if (attachments.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No attachments found in email UID ${uid}`,
              },
            ],
          }
        }

        // 返回附件信息和内容
        const result = attachments.map((att) => ({
          filename: att.filename,
          contentType: att.contentType,
          size: att.size,
          sizeFormatted: formatSize(att.size),
          content: att.content, // base64
        }))

        return {
          content: [
            {
              type: 'text',
              text: `# Attachments from Email UID ${uid}\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to get attachments: ${error instanceof Error ? error.message : error}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}
