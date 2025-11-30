import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AppConfig } from '../config.js'
import { resolveAccount } from '../config.js'
import { ImapClient } from '../imap-client.js'

/**
 * 注册邮件修改相关工具
 */
export function registerModifyTools(server: McpServer, config: AppConfig) {
  /**
   * 工具：标记邮件已读/未读
   */
  server.registerTool(
    'mark_emails',
    {
      title: 'Mark Emails',
      description: 'Mark one or more emails as read or unread',
      inputSchema: {
        account_id: z.string().describe('Account ID'),
        uids: z
          .array(z.number())
          .min(1)
          .describe('List of email UIDs to mark'),
        mark_as: z
          .enum(['read', 'unread'])
          .describe('Mark as read or unread'),
        folder: z
          .string()
          .optional()
          .describe('Folder containing the emails (default: INBOX)'),
      },
    },
    async ({ account_id, uids, mark_as, folder }) => {
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
        const result = await client.markEmails({
          uids,
          folder: folder ?? 'INBOX',
          markAs: mark_as,
        })

        return {
          content: [
            {
              type: 'text',
              text: `Successfully marked ${result.count} email(s) as ${mark_as}`,
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to mark emails: ${error instanceof Error ? error.message : error}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  /**
   * 工具：标星/取消标星
   */
  server.registerTool(
    'flag_email',
    {
      title: 'Flag Email',
      description: 'Flag (star) or unflag an email',
      inputSchema: {
        account_id: z.string().describe('Account ID'),
        uid: z.number().describe('Email UID'),
        set_flag: z
          .boolean()
          .describe('true to add flag/star, false to remove'),
        folder: z
          .string()
          .optional()
          .describe('Folder containing the email (default: INBOX)'),
      },
    },
    async ({ account_id, uid, set_flag, folder }) => {
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
        await client.flagEmail({
          uid,
          folder: folder ?? 'INBOX',
          setFlag: set_flag,
        })

        const action = set_flag ? 'flagged' : 'unflagged'
        return {
          content: [
            {
              type: 'text',
              text: `Successfully ${action} email UID ${uid}`,
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to flag email: ${error instanceof Error ? error.message : error}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  /**
   * 工具：删除邮件
   */
  server.registerTool(
    'delete_emails',
    {
      title: 'Delete Emails',
      description:
        'Delete one or more emails. By default moves to Trash, use permanent=true to permanently delete.',
      inputSchema: {
        account_id: z.string().describe('Account ID'),
        uids: z
          .array(z.number())
          .min(1)
          .describe('List of email UIDs to delete'),
        folder: z
          .string()
          .optional()
          .describe('Folder containing the emails (default: INBOX)'),
        permanent: z
          .boolean()
          .optional()
          .describe('Permanently delete instead of moving to Trash (default: false)'),
      },
    },
    async ({ account_id, uids, folder, permanent }) => {
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
        const result = await client.deleteEmails({
          uids,
          folder: folder ?? 'INBOX',
          permanent: permanent ?? false,
        })

        const action = permanent ? 'permanently deleted' : 'moved to Trash'
        return {
          content: [
            {
              type: 'text',
              text: `Successfully ${action} ${result.count} email(s)`,
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to delete emails: ${error instanceof Error ? error.message : error}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  /**
   * 工具：移动邮件
   */
  server.registerTool(
    'move_emails',
    {
      title: 'Move Emails',
      description: 'Move one or more emails to a different folder',
      inputSchema: {
        account_id: z.string().describe('Account ID'),
        uids: z
          .array(z.number())
          .min(1)
          .describe('List of email UIDs to move'),
        target_folder: z.string().describe('Destination folder path'),
        source_folder: z
          .string()
          .optional()
          .describe('Source folder (default: INBOX)'),
      },
    },
    async ({ account_id, uids, target_folder, source_folder }) => {
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
        const result = await client.moveEmails({
          uids,
          sourceFolder: source_folder ?? 'INBOX',
          targetFolder: target_folder,
        })

        return {
          content: [
            {
              type: 'text',
              text: `Successfully moved ${result.count} email(s) to ${target_folder}`,
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to move emails: ${error instanceof Error ? error.message : error}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
