#!/usr/bin/env node
/**
 * stdio 传输入口
 *
 * 用于本地运行 MCP Server，通过标准输入/输出与客户端通信。
 * 适用于 Claude Desktop、VSCode MCP 插件等。
 *
 * 使用方式：
 * - 开发：pnpm dev:stdio
 * - 发布后：npx @mcp/image-gen
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from '../core/server.js'
import { loadConfigFromEnv } from '../core/config.js'

async function main() {
  // 加载配置
  const config = loadConfigFromEnv()

  // 创建 MCP Server
  const server = createMcpServer(config)

  // 创建 stdio 传输层并连接
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  console.error('MCP Server failed to start:', error)
  process.exit(1)
})
