import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AppConfig } from './config.js'
import { registerAllTools } from './tools/index.js'

/**
 * 创建 MCP Server 实例
 *
 * @param config - 应用配置
 * @returns 配置好的 MCP Server
 */
export function createMcpServer(config: AppConfig): McpServer {
  const server = new McpServer({
    name: 'email',
    version: '0.1.0',
  })

  // 注册所有邮件操作工具
  registerAllTools(server, config)

  return server
}
