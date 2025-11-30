import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AppConfig } from './config.js'
import { registerGenerateTools } from './tools/generate.js'

/**
 * 创建 MCP Server 实例
 *
 * @param config - 应用配置
 * @returns 配置好的 MCP Server
 */
export function createMcpServer(config: AppConfig): McpServer {
  const server = new McpServer({
    name: 'image-gen',
    version: '0.1.0',
  })

  // 注册图片生成工具
  registerGenerateTools(server, config)

  return server
}
