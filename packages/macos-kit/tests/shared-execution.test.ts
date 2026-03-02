import assert from 'node:assert/strict'
import test from 'node:test'
import type { AppConfig } from '../src/core/config.js'
import { ExecutorError } from '../src/core/executor/osascript-executor.js'
import { SerialTaskQueue } from '../src/core/executor/queue.js'
import { Logger } from '../src/core/logger.js'
import {
  executeAxQuery,
  executeRawScript,
  executeTemplate,
} from '../src/core/tools/shared.js'

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    MACOS_KIT_ENABLE_RAW_SCRIPT: false,
    MACOS_KIT_DEFAULT_TIMEOUT_SECONDS: 30,
    MACOS_KIT_MAX_TIMEOUT_SECONDS: 120,
    MACOS_KIT_ALLOWED_SCRIPT_ROOTS: [],
    MACOS_KIT_KB_PATH: undefined,
    MACOS_KIT_SAFE_MODE: 'strict',
    MACOS_KIT_LOG_LEVEL: 'info',
    MACOS_KIT_ENABLE_AX_QUERY: false,
    MACOS_KIT_AX_BINARY_PATH: 'ax',
    MACOS_KIT_AX_AUTO_INSTALL: true,
    MACOS_KIT_AX_DOWNLOAD_URL: undefined,
    MACOS_KIT_AX_CACHE_DIR: undefined,
    ...overrides,
  }
}

function makeContext(options: {
  config?: AppConfig
  template?: {
    id: string
    category: string
    language: 'applescript' | 'javascript'
    script: string
  } | null
  sharedHandlers?: Array<{
    name: string
    language: 'applescript' | 'javascript'
    content: string
  }>
  executeImpl?: (params: unknown) => Promise<{
    stdout: string
    stderr: string
    executionTimeSeconds: number
  }>
}) {
  return {
    config: options.config ?? makeConfig(),
    logger: new Logger('error', 'shared-test'),
    queue: new SerialTaskQueue(),
    knowledge: {
      getTemplateById: async (_id: string) => options.template ?? null,
      getSharedHandlers: async (_language?: 'applescript' | 'javascript') =>
        options.sharedHandlers ?? [],
    },
    executor: {
      execute:
        options.executeImpl ??
        (async () => ({
          stdout: 'ok',
          stderr: '',
          executionTimeSeconds: 0.01,
        })),
    },
  } as any
}

test('executeTemplate: 模板不存在返回 NOT_FOUND', async () => {
  const context = makeContext({ template: null })
  const result = await executeTemplate({
    context,
    templateId: 'not-found',
  })
  assert.equal(result.ok, false)
  assert.equal(result.error?.code, 'NOT_FOUND')
})

test('executeTemplate: 执行成功返回 stdout/stderr', async () => {
  const context = makeContext({
    template: {
      id: 't1',
      category: 'system',
      language: 'applescript',
      script: 'return "ok"',
    },
    executeImpl: async () => ({
      stdout: 'hello',
      stderr: '',
      executionTimeSeconds: 0.2,
    }),
  })

  const result = await executeTemplate({
    context,
    templateId: 't1',
  })
  assert.equal(result.ok, true)
  assert.equal((result.data as any).stdout, 'hello')
})

test('executeTemplate: 会注入同语言 shared handlers 再执行模板', async () => {
  let receivedScript = ''
  const context = makeContext({
    template: {
      id: 't-handler',
      category: 'system',
      language: 'applescript',
      script: 'return helperText()',
    },
    sharedHandlers: [
      {
        name: 'helper_text',
        language: 'applescript',
        content: 'on helperText()\n  return "ok"\nend helperText',
      },
    ],
    executeImpl: async (params: unknown) => {
      receivedScript = String((params as { scriptContent?: string }).scriptContent ?? '')
      return {
        stdout: 'hello-with-handler',
        stderr: '',
        executionTimeSeconds: 0.01,
      }
    },
  })

  const result = await executeTemplate({
    context,
    templateId: 't-handler',
  })
  assert.equal(result.ok, true)
  assert.match(receivedScript, /on helperText\(\)/)
  assert.match(receivedScript, /return helperText\(\)/)
})

test('executeTemplate: 权限错误映射为 PERMISSION_DENIED', async () => {
  const context = makeContext({
    template: {
      id: 't2',
      category: 'system',
      language: 'applescript',
      script: 'return "ok"',
    },
    executeImpl: async () => {
      const error = new ExecutorError('failed')
      error.stderr = 'Not authorized to send Apple events'
      error.executionTimeSeconds = 0.08
      throw error
    },
  })

  const result = await executeTemplate({
    context,
    templateId: 't2',
  })
  assert.equal(result.ok, false)
  assert.equal(result.error?.code, 'PERMISSION_DENIED')
})

test('executeRawScript: 未开启 raw 时返回 FEATURE_DISABLED', async () => {
  const context = makeContext({
    config: makeConfig({ MACOS_KIT_ENABLE_RAW_SCRIPT: false }),
  })
  const result = await executeRawScript({
    context,
    scriptContent: 'return "ok"',
    language: 'applescript',
  })
  assert.equal(result.ok, false)
  assert.equal(result.error?.code, 'FEATURE_DISABLED')
})

test('executeRawScript: 开启 raw 且执行成功', async () => {
  const context = makeContext({
    config: makeConfig({
      MACOS_KIT_ENABLE_RAW_SCRIPT: true,
      MACOS_KIT_SAFE_MODE: 'off',
    }),
    executeImpl: async () => ({
      stdout: 'raw-ok',
      stderr: '',
      executionTimeSeconds: 0.05,
    }),
  })
  const result = await executeRawScript({
    context,
    scriptContent: 'return "ok"',
    language: 'applescript',
  })
  assert.equal(result.ok, true)
  assert.equal((result.data as any).stdout, 'raw-ok')
})

test('executeAxQuery: 未开启时返回 FEATURE_DISABLED', async () => {
  const context = makeContext({
    config: makeConfig({ MACOS_KIT_ENABLE_AX_QUERY: false }),
  })
  const result = await executeAxQuery({
    context,
    payload: { command: 'query' },
  })
  assert.equal(result.ok, false)
  assert.equal(result.error?.code, 'FEATURE_DISABLED')
})

test('executeAxQuery: 开启但缺少依赖时返回 DEPENDENCY_MISSING', async () => {
  const context = makeContext({
    config: makeConfig({
      MACOS_KIT_ENABLE_AX_QUERY: true,
      MACOS_KIT_AX_BINARY_PATH: '/definitely/not/exist-ax-bin',
    }),
  })
  const result = await executeAxQuery({
    context,
    payload: { command: 'query' },
    timeoutSeconds: 1,
  })
  if (process.platform === 'darwin') {
    assert.equal(result.ok, false)
    assert.equal(result.error?.code, 'DEPENDENCY_MISSING')
  } else {
    assert.equal(result.ok, false)
    assert.equal(result.error?.code, 'UNSUPPORTED_PLATFORM')
  }
})
