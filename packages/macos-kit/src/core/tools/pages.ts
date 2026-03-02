import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolRuntimeContext } from '../server.js'
import { registerTemplateTool } from './template-tool.js'

export function registerPagesTools(server: McpServer, context: ToolRuntimeContext) {
  registerTemplateTool(server, context, {
    name: 'create_pages_document',
    title: 'Create Pages Document',
    description: '创建 Pages 文档',
    templateId: 'pages_create_pages_document',
    inputSchema: {
      content: z.string().describe('文档文本内容'),
    },
    toInputData: (args) => ({ content: args.content }),
  })
}
