import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AppConfig } from '../config.js'
import { resolveAccount } from '../config.js'
import { SmtpClient } from '../smtp-client.js'
import { ImapClient } from '../imap-client.js'

/**
 * 注册邮件发送相关工具
 */
export function registerSendTools(server: McpServer, config: AppConfig) {
  /**
   * 工具：发送邮件
   */
  server.registerTool(
    'send_email',
    {
      title: 'Send Email',
      description: 'Send a new email',
      inputSchema: {
        account_id: z.string().describe('Account ID to send from'),
        to: z
          .array(z.string())
          .min(1)
          .describe('List of recipient email addresses'),
        subject: z.string().describe('Email subject'),
        body: z.string().describe('Email body content'),
        is_html: z
          .boolean()
          .optional()
          .describe('Whether the body is HTML format (default: false)'),
        cc: z
          .array(z.string())
          .optional()
          .describe('List of CC recipients'),
        bcc: z
          .array(z.string())
          .optional()
          .describe('List of BCC recipients'),
        attachments: z
          .array(
            z.object({
              filename: z.string().describe('Attachment filename'),
              content: z.string().describe('Base64 encoded content'),
              contentType: z
                .string()
                .optional()
                .describe('MIME type'),
            })
          )
          .optional()
          .describe('List of attachments'),
      },
    },
    async ({ account_id, to, subject, body, is_html, cc, bcc, attachments }) => {
      const account = config.ACCOUNTS.find((a) => a.id === account_id)
      if (!account) {
        return {
          content: [{ type: 'text', text: `Account "${account_id}" not found` }],
          isError: true,
        }
      }

      const resolved = resolveAccount(account)
      const client = new SmtpClient(resolved)

      try {
        const result = await client.sendEmail({
          to,
          subject,
          body,
          isHtml: is_html ?? false,
          cc,
          bcc,
          attachments,
        })

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to send email: ${result.error}`,
              },
            ],
            isError: true,
          }
        }

        const recipientCount =
          to.length + (cc?.length ?? 0) + (bcc?.length ?? 0)

        return {
          content: [
            {
              type: 'text',
              text: `Email sent successfully!\n\n**To:** ${to.join(', ')}\n**Subject:** ${subject}\n**Message-ID:** ${result.messageId}\n\nSent to ${recipientCount} recipient(s)`,
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to send email: ${error instanceof Error ? error.message : error}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  /**
   * 工具：回复邮件
   */
  server.registerTool(
    'reply_email',
    {
      title: 'Reply to Email',
      description:
        'Reply to an email. Automatically handles threading and quoting.',
      inputSchema: {
        account_id: z.string().describe('Account ID'),
        uid: z.number().describe('UID of the email to reply to'),
        body: z.string().describe('Reply body content'),
        reply_all: z
          .boolean()
          .optional()
          .describe('Reply to all recipients (default: false)'),
        is_html: z
          .boolean()
          .optional()
          .describe('Whether the body is HTML format (default: false)'),
        folder: z
          .string()
          .optional()
          .describe('Folder containing the original email (default: INBOX)'),
      },
    },
    async ({ account_id, uid, body, reply_all, is_html, folder }) => {
      const account = config.ACCOUNTS.find((a) => a.id === account_id)
      if (!account) {
        return {
          content: [{ type: 'text', text: `Account "${account_id}" not found` }],
          isError: true,
        }
      }

      const resolved = resolveAccount(account)

      // 首先获取原邮件信息
      const imapClient = new ImapClient(resolved)
      const original = await imapClient.getEmailDetail({
        uid,
        folder: folder ?? 'INBOX',
      })

      if (!original) {
        return {
          content: [
            {
              type: 'text',
              text: `Original email with UID ${uid} not found`,
            },
          ],
          isError: true,
        }
      }

      // 发送回复
      const smtpClient = new SmtpClient(resolved)

      try {
        const result = await smtpClient.replyEmail({
          original: {
            from: original.from,
            to: original.to,
            cc: original.cc,
            subject: original.subject,
            messageId: original.messageId,
            date: original.date,
            body: original.textBody,
          },
          body,
          replyAll: reply_all ?? false,
          isHtml: is_html ?? false,
        })

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to send reply: ${result.error}`,
              },
            ],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `Reply sent successfully!\n\n**To:** ${original.from}\n**Subject:** Re: ${original.subject}\n**Message-ID:** ${result.messageId}`,
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to reply: ${error instanceof Error ? error.message : error}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  /**
   * 工具：转发邮件
   */
  server.registerTool(
    'forward_email',
    {
      title: 'Forward Email',
      description: 'Forward an email to other recipients',
      inputSchema: {
        account_id: z.string().describe('Account ID'),
        uid: z.number().describe('UID of the email to forward'),
        to: z
          .array(z.string())
          .min(1)
          .describe('List of recipient email addresses'),
        comment: z
          .string()
          .optional()
          .describe('Optional comment to add before the forwarded content'),
        folder: z
          .string()
          .optional()
          .describe('Folder containing the original email (default: INBOX)'),
        include_attachments: z
          .boolean()
          .optional()
          .describe('Include attachments from original email (default: false)'),
      },
    },
    async ({
      account_id,
      uid,
      to,
      comment,
      folder,
      include_attachments,
    }) => {
      const account = config.ACCOUNTS.find((a) => a.id === account_id)
      if (!account) {
        return {
          content: [{ type: 'text', text: `Account "${account_id}" not found` }],
          isError: true,
        }
      }

      const resolved = resolveAccount(account)

      // 获取原邮件
      const imapClient = new ImapClient(resolved)
      const original = await imapClient.getEmailDetail({
        uid,
        folder: folder ?? 'INBOX',
        includeAttachmentContent: include_attachments ?? false,
      })

      if (!original) {
        return {
          content: [
            {
              type: 'text',
              text: `Original email with UID ${uid} not found`,
            },
          ],
          isError: true,
        }
      }

      // 准备附件（如果需要）
      let attachments: Array<{
        filename: string
        content: string
        contentType?: string
      }> | undefined

      if (include_attachments && original.attachments.length > 0) {
        // 需要重新获取带内容的附件
        const attachmentsWithContent = await imapClient.getAttachments({
          uid,
          folder: folder ?? 'INBOX',
        })
        attachments = attachmentsWithContent
          .filter((a) => a.content)
          .map((a) => ({
            filename: a.filename,
            content: a.content!,
            contentType: a.contentType,
          }))
      }

      // 发送转发
      const smtpClient = new SmtpClient(resolved)

      try {
        const result = await smtpClient.forwardEmail({
          original: {
            from: original.from,
            to: original.to,
            cc: original.cc,
            subject: original.subject,
            date: original.date,
            body: original.textBody,
          },
          to,
          comment,
          attachments,
        })

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to forward email: ${result.error}`,
              },
            ],
            isError: true,
          }
        }

        const attachmentNote =
          attachments && attachments.length > 0
            ? `\n**Attachments:** ${attachments.length} file(s)`
            : ''

        return {
          content: [
            {
              type: 'text',
              text: `Email forwarded successfully!\n\n**To:** ${to.join(', ')}\n**Subject:** Fwd: ${original.subject}\n**Message-ID:** ${result.messageId}${attachmentNote}`,
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to forward: ${error instanceof Error ? error.message : error}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  /**
   * 工具：测试连接
   */
  server.registerTool(
    'test_connection',
    {
      title: 'Test Connection',
      description: 'Test IMAP and SMTP connections for an account',
      inputSchema: {
        account_id: z.string().describe('Account ID to test'),
      },
    },
    async ({ account_id }) => {
      const account = config.ACCOUNTS.find((a) => a.id === account_id)
      if (!account) {
        return {
          content: [{ type: 'text', text: `Account "${account_id}" not found` }],
          isError: true,
        }
      }

      const resolved = resolveAccount(account)

      // 测试 IMAP
      const imapClient = new ImapClient(resolved)
      const imapResult = await imapClient.testConnection()

      // 测试 SMTP
      const smtpClient = new SmtpClient(resolved)
      const smtpResult = await smtpClient.testConnection()

      const lines = [
        `# Connection Test: ${account_id}`,
        '',
        '## IMAP',
        `- **Server:** ${resolved.imap_server}:${resolved.imap_port}`,
        `- **Status:** ${imapResult.success ? '✅ Connected' : '❌ Failed'}`,
      ]

      if (imapResult.success && imapResult.inbox) {
        lines.push(
          `- **Inbox:** ${imapResult.inbox.total} messages (${imapResult.inbox.unseen} unread)`
        )
      } else if (imapResult.error) {
        lines.push(`- **Error:** ${imapResult.error}`)
      }

      lines.push(
        '',
        '## SMTP',
        `- **Server:** ${resolved.smtp_server}:${resolved.smtp_port}`,
        `- **Status:** ${smtpResult.success ? '✅ Connected' : '❌ Failed'}`
      )

      if (smtpResult.error) {
        lines.push(`- **Error:** ${smtpResult.error}`)
      }

      const allSuccess = imapResult.success && smtpResult.success

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        isError: !allSuccess,
      }
    }
  )
}
