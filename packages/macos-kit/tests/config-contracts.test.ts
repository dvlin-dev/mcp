import assert from 'node:assert/strict'
import test from 'node:test'
import { loadConfigFromEnv } from '../src/core/config.js'
import {
  buildFailure,
  buildSuccess,
  toToolResult,
} from '../src/core/contracts.js'

function withEnv(patch: Record<string, string | undefined>, fn: () => void) {
  const previous = { ...process.env }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  try {
    fn()
  } finally {
    process.env = previous
  }
}

test('loadConfigFromEnv 使用默认值并解析布尔与路径', () => {
  withEnv(
    {
      MACOS_KIT_ENABLE_RAW_SCRIPT: 'true',
      MACOS_KIT_ALLOWED_SCRIPT_ROOTS: '/tmp/a, /tmp/b',
      MACOS_KIT_DEFAULT_TIMEOUT_SECONDS: undefined,
      MACOS_KIT_MAX_TIMEOUT_SECONDS: undefined,
      MACOS_KIT_SAFE_MODE: undefined,
      MACOS_KIT_LOG_LEVEL: undefined,
      MACOS_KIT_ENABLE_AX_QUERY: 'yes',
      MACOS_KIT_AX_BINARY_PATH: undefined,
      MACOS_KIT_AX_AUTO_INSTALL: undefined,
      MACOS_KIT_AX_DOWNLOAD_URL: undefined,
      MACOS_KIT_AX_CACHE_DIR: undefined,
    },
    () => {
      const config = loadConfigFromEnv()
      assert.equal(config.MACOS_KIT_ENABLE_RAW_SCRIPT, true)
      assert.equal(config.MACOS_KIT_DEFAULT_TIMEOUT_SECONDS, 30)
      assert.equal(config.MACOS_KIT_MAX_TIMEOUT_SECONDS, 120)
      assert.deepEqual(config.MACOS_KIT_ALLOWED_SCRIPT_ROOTS, ['/tmp/a', '/tmp/b'])
      assert.equal(config.MACOS_KIT_SAFE_MODE, 'balanced')
      assert.equal(config.MACOS_KIT_LOG_LEVEL, 'info')
      assert.equal(config.MACOS_KIT_ENABLE_AX_QUERY, true)
      assert.equal(config.MACOS_KIT_AX_BINARY_PATH, 'ax')
      assert.equal(config.MACOS_KIT_AX_AUTO_INSTALL, true)
      assert.equal(config.MACOS_KIT_AX_DOWNLOAD_URL, undefined)
      assert.equal(config.MACOS_KIT_AX_CACHE_DIR, undefined)
    }
  )
})

test('loadConfigFromEnv 零配置默认宽松', () => {
  withEnv(
    {
      MACOS_KIT_ENABLE_RAW_SCRIPT: undefined,
      MACOS_KIT_ALLOWED_SCRIPT_ROOTS: undefined,
      MACOS_KIT_DEFAULT_TIMEOUT_SECONDS: undefined,
      MACOS_KIT_MAX_TIMEOUT_SECONDS: undefined,
      MACOS_KIT_SAFE_MODE: undefined,
      MACOS_KIT_LOG_LEVEL: undefined,
      MACOS_KIT_ENABLE_AX_QUERY: undefined,
      MACOS_KIT_AX_BINARY_PATH: undefined,
      MACOS_KIT_AX_AUTO_INSTALL: undefined,
      MACOS_KIT_AX_DOWNLOAD_URL: undefined,
      MACOS_KIT_AX_CACHE_DIR: undefined,
    },
    () => {
      const config = loadConfigFromEnv()
      assert.equal(config.MACOS_KIT_ENABLE_RAW_SCRIPT, true)
      assert.equal(config.MACOS_KIT_ENABLE_AX_QUERY, true)
      assert.equal(config.MACOS_KIT_SAFE_MODE, 'balanced')
      assert.deepEqual(config.MACOS_KIT_ALLOWED_SCRIPT_ROOTS, [])
      assert.equal(config.MACOS_KIT_AX_AUTO_INSTALL, true)
    }
  )
})

test('loadConfigFromEnv 在默认超时大于最大超时时抛错', () => {
  withEnv(
    {
      MACOS_KIT_DEFAULT_TIMEOUT_SECONDS: '200',
      MACOS_KIT_MAX_TIMEOUT_SECONDS: '120',
    },
    () => {
      assert.throws(
        () => loadConfigFromEnv(),
        /MACOS_KIT_DEFAULT_TIMEOUT_SECONDS 不能大于 MACOS_KIT_MAX_TIMEOUT_SECONDS/
      )
    }
  )
})

test('contracts: buildSuccess/buildFailure/toToolResult 正常工作', () => {
  const success = buildSuccess(
    { hello: 'world' },
    { trace_id: 'trace-success', execution_time_seconds: 0.12 }
  )
  assert.equal(success.ok, true)
  assert.equal(success.error, null)
  assert.equal(success.meta.trace_id, 'trace-success')

  const failure = buildFailure('INVALID_INPUT', 'bad input', {
    hint: 'fix it',
    retryable: true,
    trace_id: 'trace-failure',
  })
  assert.equal(failure.ok, false)
  assert.equal(failure.error?.code, 'INVALID_INPUT')
  assert.equal(failure.error?.retryable, true)
  assert.equal(failure.meta.trace_id, 'trace-failure')

  const toolResult = toToolResult(failure)
  assert.equal(toolResult.isError, true)
  const parsed = JSON.parse(toolResult.content[0].text)
  assert.equal(parsed.ok, false)
  assert.equal(parsed.error.code, 'INVALID_INPUT')
})
