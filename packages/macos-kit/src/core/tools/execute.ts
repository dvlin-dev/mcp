import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolRuntimeContext } from '../server.js'
import { buildFailure, toToolResult } from '../contracts.js'
import { executeRawScript, executeTemplate } from './shared.js'

export function registerExecuteTools(server: McpServer, context: ToolRuntimeContext) {
  server.registerTool(
    'run_macos_template',
    {
      title: 'Run macOS Template',
      description: '执行知识库模板脚本',
      inputSchema: {
        template_id: z.string().describe('模板 ID'),
        input_data: z
          .record(z.unknown())
          .optional()
          .describe('命名输入参数，对应 --MCP_INPUT:key'),
        arguments: z
          .array(z.string())
          .optional()
          .describe('位置参数，对应 --MCP_ARG_1 等'),
        timeout_seconds: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('执行超时（秒）'),
      },
    },
    async ({ template_id, input_data, arguments: args, timeout_seconds }) => {
      const response = await executeTemplate({
        context,
        templateId: template_id,
        inputData: input_data,
        args,
        timeoutSeconds: timeout_seconds,
      })
      return toToolResult(response)
    }
  )

  server.registerTool(
    'run_macos_script',
    {
      title: 'Run macOS Script',
      description: '直接执行 AppleScript/JXA（默认关闭）',
      inputSchema: {
        script_content: z.string().optional().describe('脚本内容'),
        script_path: z.string().optional().describe('脚本文件绝对路径'),
        language: z
          .enum(['applescript', 'javascript'])
          .optional()
          .describe('脚本语言，默认 applescript'),
        arguments: z.array(z.string()).optional().describe('脚本路径模式下的参数'),
        timeout_seconds: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('执行超时（秒）'),
      },
    },
    async ({
      script_content,
      script_path,
      language,
      arguments: args,
      timeout_seconds,
    }) => {
      if (!script_content && !script_path) {
        return toToolResult(
          buildFailure('INVALID_INPUT', 'script_content 与 script_path 至少传一个', {
            retryable: false,
          })
        )
      }

      if (script_content && script_path) {
        return toToolResult(
          buildFailure('INVALID_INPUT', 'script_content 与 script_path 不能同时传入', {
            retryable: false,
          })
        )
      }

      const response = await executeRawScript({
        context,
        scriptContent: script_content,
        scriptPath: script_path,
        language: language ?? 'applescript',
        args,
        timeoutSeconds: timeout_seconds,
      })
      return toToolResult(response)
    }
  )
}
