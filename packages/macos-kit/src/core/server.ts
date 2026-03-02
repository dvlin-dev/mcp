import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AppConfig } from './config.js'
import { Logger } from './logger.js'
import { OsaScriptExecutor } from './executor/osascript-executor.js'
import { SerialTaskQueue } from './executor/queue.js'
import { KnowledgeManager } from './knowledge/manager.js'
import { registerAllTools } from './tools/index.js'

export interface ToolRuntimeContext {
  config: AppConfig
  logger: Logger
  queue: SerialTaskQueue
  executor: OsaScriptExecutor
  knowledge: KnowledgeManager
}

export function createMcpServer(config: AppConfig): McpServer {
  const server = new McpServer({
    name: 'macos-kit',
    version: '0.1.0',
  })

  const logger = new Logger(config.MACOS_KIT_LOG_LEVEL, 'macos-kit')

  const __filename = fileURLToPath(import.meta.url)
  const packageRoot = path.resolve(path.dirname(__filename), '../..')
  const embeddedKbRoot = path.join(packageRoot, 'knowledge-base')

  const runtime: ToolRuntimeContext = {
    config,
    logger,
    queue: new SerialTaskQueue(),
    executor: new OsaScriptExecutor(logger),
    knowledge: new KnowledgeManager({
      logger,
      embeddedRoot: embeddedKbRoot,
      localOverrideRoot: config.MACOS_KIT_KB_PATH,
    }),
  }

  registerAllTools(server, runtime)

  return server
}
