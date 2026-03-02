import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolRuntimeContext } from '../server.js'
import { registerTemplateTool } from './template-tool.js'

export function registerSystemTools(server: McpServer, context: ToolRuntimeContext) {
  registerTemplateTool(server, context, {
    name: 'get_frontmost_app',
    title: 'Get Frontmost App',
    description: '获取当前前台应用名称',
    templateId: 'system_get_frontmost_app',
    inputSchema: {},
  })

  registerTemplateTool(server, context, {
    name: 'launch_app',
    title: 'Launch App',
    description: '启动指定应用',
    templateId: 'system_launch_app',
    inputSchema: {
      name: z.string().describe('应用名称'),
    },
    toInputData: (args) => ({ name: args.name }),
  })

  registerTemplateTool(server, context, {
    name: 'quit_app',
    title: 'Quit App',
    description: '退出指定应用',
    templateId: 'system_quit_app',
    inputSchema: {
      name: z.string().describe('应用名称'),
      force: z.boolean().optional().describe('是否强制退出'),
    },
    toInputData: (args) => ({
      name: args.name,
      force: typeof args.force === 'boolean' ? args.force : false,
    }),
  })

  registerTemplateTool(server, context, {
    name: 'set_system_volume',
    title: 'Set System Volume',
    description: '设置系统音量（0-100）',
    templateId: 'system_set_system_volume',
    inputSchema: {
      level: z.number().min(0).max(100).describe('音量等级'),
    },
    toInputData: (args) => ({ level: args.level }),
  })

  registerTemplateTool(server, context, {
    name: 'toggle_dark_mode',
    title: 'Toggle Dark Mode',
    description: '切换深色模式',
    templateId: 'system_toggle_dark_mode',
    inputSchema: {},
  })

  registerTemplateTool(server, context, {
    name: 'get_battery_status',
    title: 'Get Battery Status',
    description: '获取电池状态信息',
    templateId: 'system_get_battery_status',
    inputSchema: {},
  })
}
