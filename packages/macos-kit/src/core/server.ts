import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AppConfig } from './config.js'
import { Logger } from './logger.js'
import { OsaScriptExecutor } from './executor/osascript-executor.js'
import { SerialTaskQueue } from './executor/queue.js'
import { prewarmAxBinary } from './executor/ax-binary.js'
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
  if (
    config.MACOS_KIT_ENABLE_RAW_SCRIPT &&
    config.MACOS_KIT_SAFE_MODE === 'off' &&
    config.MACOS_KIT_ALLOWED_SCRIPT_ROOTS.length === 0
  ) {
    logger.warn('当前运行在零配置宽松模式：raw/AX 默认开启且未限制脚本目录', {
      enableRawScript: config.MACOS_KIT_ENABLE_RAW_SCRIPT,
      enableAxQuery: config.MACOS_KIT_ENABLE_AX_QUERY,
      safeMode: config.MACOS_KIT_SAFE_MODE,
      allowedScriptRoots: config.MACOS_KIT_ALLOWED_SCRIPT_ROOTS,
    })
  }

  const __filename = fileURLToPath(import.meta.url)
  const moduleDir = path.dirname(__filename)
  const embeddedKbCandidates = [
    path.resolve(moduleDir, '../../knowledge-base'),
    path.resolve(moduleDir, '../../../knowledge-base'),
  ]
  const embeddedKbRoot =
    embeddedKbCandidates.find((candidate) => fs.existsSync(candidate)) ??
    embeddedKbCandidates[0]

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

  if (config.MACOS_KIT_ENABLE_AX_QUERY) {
    void prewarmAxBinary({ config, logger }).catch((error) => {
      logger.warn('AX 预热流程异常', {
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  registerAllTools(server, runtime)

  return server
}
