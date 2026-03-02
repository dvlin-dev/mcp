import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolRuntimeContext } from '../server.js'
import { buildSuccess, toToolResult } from '../contracts.js'

export function registerDiscoveryTools(server: McpServer, context: ToolRuntimeContext) {
  server.registerTool(
    'list_macos_automation_categories',
    {
      title: 'List macOS Automation Categories',
      description: '列出知识库中的 macOS 自动化分类',
      inputSchema: {},
    },
    async () => {
      const categories = await context.knowledge.listCategories()
      const response = buildSuccess({ categories })
      return toToolResult(response)
    }
  )

  server.registerTool(
    'search_macos_automation_tips',
    {
      title: 'Search macOS Automation Tips',
      description: '在知识库中按关键词、分类搜索模板',
      inputSchema: {
        query: z.string().optional().describe('搜索关键词'),
        category: z.string().optional().describe('按分类过滤'),
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe('返回结果数量，默认 10'),
      },
    },
    async ({ query, category, limit }) => {
      const templates = await context.knowledge.search({
        query,
        category,
        limit: limit ?? 10,
      })

      const response = buildSuccess({
        total: templates.length,
        templates: templates.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          description: item.description,
          language: item.language,
          keywords: item.keywords,
          argumentsPrompt: item.argumentsPrompt,
        })),
      })

      return toToolResult(response)
    }
  )
}
