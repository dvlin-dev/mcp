import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AppConfig } from '../config.js'
import { registerListTools } from './list.js'
import { registerReadTools } from './read.js'
import { registerSearchTools } from './search.js'
import { registerModifyTools } from './modify.js'
import { registerSendTools } from './send.js'

/**
 * 注册所有 MCP 工具
 */
export function registerAllTools(server: McpServer, config: AppConfig) {
  registerListTools(server, config)
  registerReadTools(server, config)
  registerSearchTools(server, config)
  registerModifyTools(server, config)
  registerSendTools(server, config)
}
