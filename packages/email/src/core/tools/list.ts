import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AppConfig } from '../config.js'
import { resolveAccount } from '../config.js'
import { ImapClient } from '../imap-client.js'

/**
 * 注册列表相关工具
 */
export function registerListTools(server: McpServer, config: AppConfig) {
  /**
   * 工具：列出已配置的邮箱账户
   */
  server.registerTool(
    'list_accounts',
    {
      title: 'List Email Accounts',
      description: 'List all configured email accounts with their IDs and email addresses',
      inputSchema: {},
    },
    async () => {
      const accounts = config.ACCOUNTS.map((acc) => ({
        id: acc.id,
        email: acc.email,
        provider: acc.provider,
      }))

      const text = accounts
        .map((acc) => `- **${acc.id}**: ${acc.email} (${acc.provider})`)
        .join('\n')

      return {
        content: [
          {
            type: 'text',
            text: `# Configured Email Accounts\n\n${text}\n\nTotal: ${accounts.length} account(s)`,
          },
        ],
      }
    }
  )

  /**
   * 工具：列出邮件
   */
  server.registerTool(
    'list_emails',
    {
      title: 'List Emails',
      description:
        'List emails from an account. Returns email summaries including UID, subject, sender, date, and read status.',
      inputSchema: {
        account_id: z
          .string()
          .describe('Account ID to list emails from'),
        folder: z
          .string()
          .optional()
          .describe('Folder to list emails from (default: INBOX)'),
        limit: z
          .number()
          .optional()
          .describe('Maximum number of emails to return (default: 20, max: 100)'),
        unread_only: z
          .boolean()
          .optional()
          .describe('Only return unread emails (default: false)'),
      },
    },
    async ({ account_id, folder, limit, unread_only }) => {
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
        const emails = await client.listEmails({
          folder: folder ?? 'INBOX',
          limit: Math.min(limit ?? 20, 100),
          unreadOnly: unread_only ?? false,
        })

        if (emails.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No emails found in ${folder ?? 'INBOX'}`,
              },
            ],
          }
        }

        const lines = emails.map((email) => {
          const status = email.seen ? '📭' : '📬'
          const flag = email.flagged ? '⭐' : ''
          const attach = email.hasAttachments ? '📎' : ''
          return `${status}${flag}${attach} **[${email.uid}]** ${email.subject}\n   From: ${email.from} | ${email.date}`
        })

        return {
          content: [
            {
              type: 'text',
              text: `# Emails in ${folder ?? 'INBOX'} (${account_id})\n\n${lines.join('\n\n')}\n\nShowing ${emails.length} email(s)`,
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to list emails: ${error instanceof Error ? error.message : error}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  /**
   * 工具：列出文件夹
   */
  server.registerTool(
    'list_folders',
    {
      title: 'List Folders',
      description:
        'List all email folders/labels in an account with message counts',
      inputSchema: {
        account_id: z
          .string()
          .describe('Account ID to list folders from'),
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
      const client = new ImapClient(resolved)

      try {
        const folders = await client.listFolders()

        if (folders.length === 0) {
          return {
            content: [{ type: 'text', text: 'No folders found' }],
          }
        }

        const lines = folders.map((f) => {
          const unread = f.unseen > 0 ? ` (${f.unseen} unread)` : ''
          return `- **${f.name}** - ${f.total} messages${unread}\n  Path: \`${f.path}\``
        })

        return {
          content: [
            {
              type: 'text',
              text: `# Folders in ${account_id}\n\n${lines.join('\n\n')}\n\nTotal: ${folders.length} folder(s)`,
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to list folders: ${error instanceof Error ? error.message : error}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
