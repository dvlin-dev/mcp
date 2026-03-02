import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolRuntimeContext } from '../server.js'
import { registerTemplateTool } from './template-tool.js'

export function registerCalendarTools(server: McpServer, context: ToolRuntimeContext) {
  registerTemplateTool(server, context, {
    name: 'calendar_add_event',
    title: 'Calendar Add Event',
    description: '创建日历事件',
    templateId: 'calendar_calendar_add_event',
    inputSchema: {
      title: z.string().describe('事件标题'),
      start_date: z.string().describe('开始时间（AppleScript 可识别格式）'),
      end_date: z.string().describe('结束时间（AppleScript 可识别格式）'),
      calendar: z.string().optional().describe('日历名称'),
    },
    toInputData: (args) => ({
      title: args.title,
      start_date: args.start_date,
      end_date: args.end_date,
      calendar: typeof args.calendar === 'string' ? args.calendar : 'Calendar',
    }),
  })

  registerTemplateTool(server, context, {
    name: 'calendar_list_today',
    title: 'Calendar List Today',
    description: '列出今天的日历事件',
    templateId: 'calendar_calendar_list_today',
    inputSchema: {
      calendar: z.string().optional().describe('日历名称'),
    },
    toInputData: (args) => ({
      calendar: typeof args.calendar === 'string' ? args.calendar : 'Calendar',
    }),
  })
}
