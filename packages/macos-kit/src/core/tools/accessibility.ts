import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolRuntimeContext } from '../server.js'
import { executeAxQuery } from './shared.js'
import { toToolResult } from '../contracts.js'

export function registerAccessibilityTools(
  server: McpServer,
  context: ToolRuntimeContext
) {
  server.registerTool(
    'accessibility_query',
    {
      title: 'Accessibility Query',
      description: '通过 AX 二进制执行 UI 元素查询或动作',
      inputSchema: {
        command: z.enum(['query', 'perform']).describe('查询或执行动作'),
        locator: z
          .record(z.unknown())
          .optional()
          .describe('目标元素定位信息'),
        return_all_matches: z.boolean().optional(),
        attributes_to_query: z.array(z.string()).optional(),
        required_action_name: z.string().optional(),
        action_to_perform: z.string().optional(),
        report_execution_time: z.boolean().optional(),
        limit: z.number().int().positive().optional(),
        max_elements: z.number().int().positive().optional(),
        debug_logging: z.boolean().optional(),
        output_format: z
          .enum(['smart', 'verbose', 'text_content'])
          .optional(),
        timeout_seconds: z.number().int().positive().optional(),
      },
    },
    async (args) => {
      const payload = args as Record<string, unknown>
      const timeoutSeconds =
        typeof payload.timeout_seconds === 'number'
          ? payload.timeout_seconds
          : undefined
      const response = await executeAxQuery({ context, payload, timeoutSeconds })
      return toToolResult(response)
    }
  )
}
