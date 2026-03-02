#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from '../core/server.js'
import { loadConfigFromEnv } from '../core/config.js'

async function main() {
  const config = loadConfigFromEnv()
  const server = createMcpServer(config)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  console.error('macos-kit 启动失败:', error)
  process.exit(1)
})
