import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { z } from 'zod'
import type { ToolRuntimeContext } from '../server.js'
import { executeTemplate } from './shared.js'
import { toToolResult } from '../contracts.js'

type InputSchema = Record<string, z.ZodTypeAny>

export interface TemplateToolDefinition {
  name: string
  title: string
  description: string
  templateId: string
  inputSchema: InputSchema
  toInputData?: (args: Record<string, unknown>) => Record<string, unknown>
  toArgs?: (args: Record<string, unknown>) => string[]
  timeoutFromArgs?: (args: Record<string, unknown>) => number | undefined
}

export function registerTemplateTool(
  server: McpServer,
  context: ToolRuntimeContext,
  definition: TemplateToolDefinition
) {
  server.registerTool(
    definition.name,
    {
      title: definition.title,
      description: definition.description,
      inputSchema: definition.inputSchema,
    },
    async (args) => {
      const input = args as Record<string, unknown>
      const response = await executeTemplate({
        context,
        templateId: definition.templateId,
        inputData: definition.toInputData?.(input),
        args: definition.toArgs?.(input),
        timeoutSeconds: definition.timeoutFromArgs?.(input),
      })
      return toToolResult(response)
    }
  )
}
