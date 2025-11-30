import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AppConfig } from '../config.js'
import { resolveAccount } from '../config.js'
import { ImapClient } from '../imap-client.js'

/**
 * 注册搜索相关工具
 */
export function registerSearchTools(server: McpServer, config: AppConfig) {
  /**
   * 工具：搜索邮件
   */
  server.registerTool(
    'search_emails',
    {
      title: 'Search Emails',
      description:
        'Search emails with various criteria including keywords, sender, date range, etc.',
      inputSchema: {
        account_id: z.string().describe('Account ID to search in'),
        query: z
          .string()
          .optional()
          .describe('Search keyword'),
        search_in: z
          .enum(['all', 'subject', 'from', 'to', 'body'])
          .optional()
          .describe('Where to search: all (default), subject, from, to, or body'),
        folder: z
          .string()
          .optional()
          .describe('Folder to search in (default: INBOX)'),
        date_from: z
          .string()
          .optional()
          .describe('Search emails after this date (YYYY-MM-DD)'),
        date_to: z
          .string()
          .optional()
          .describe('Search emails before this date (YYYY-MM-DD)'),
        unread_only: z
          .boolean()
          .optional()
          .describe('Only return unread emails'),
        flagged_only: z
          .boolean()
          .optional()
          .describe('Only return flagged/starred emails'),
        limit: z
          .number()
          .optional()
          .describe('Maximum number of results (default: 50, max: 100)'),
      },
    },
    async ({
      account_id,
      query,
      search_in,
      folder,
      date_from,
      date_to,
      unread_only,
      flagged_only,
      limit,
    }) => {
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
        const emails = await client.searchEmails(
          {
            query,
            searchIn: search_in,
            dateFrom: date_from,
            dateTo: date_to,
            unreadOnly: unread_only,
            flaggedOnly: flagged_only,
          },
          {
            folder: folder ?? 'INBOX',
            limit: Math.min(limit ?? 50, 100),
          }
        )

        if (emails.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No emails found matching the search criteria',
              },
            ],
          }
        }

        // 构建搜索条件描述
        const criteriaDesc: string[] = []
        if (query) criteriaDesc.push(`keyword: "${query}"`)
        if (search_in && search_in !== 'all') criteriaDesc.push(`in: ${search_in}`)
        if (date_from) criteriaDesc.push(`from: ${date_from}`)
        if (date_to) criteriaDesc.push(`to: ${date_to}`)
        if (unread_only) criteriaDesc.push('unread only')
        if (flagged_only) criteriaDesc.push('flagged only')

        const lines = emails.map((email) => {
          const status = email.seen ? '📭' : '📬'
          const flag = email.flagged ? '⭐' : ''
          const attach = email.hasAttachments ? '📎' : ''
          return `${status}${flag}${attach} **[${email.uid}]** ${email.subject}\n   From: ${email.from} | ${email.date}`
        })

        const searchDesc =
          criteriaDesc.length > 0
            ? `Search: ${criteriaDesc.join(', ')}`
            : 'All emails'

        return {
          content: [
            {
              type: 'text',
              text: `# Search Results (${account_id})\n\n${searchDesc}\n\n${lines.join('\n\n')}\n\nFound ${emails.length} email(s)`,
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to search emails: ${error instanceof Error ? error.message : error}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
