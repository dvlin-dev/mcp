import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { AppConfig } from '../src/core/config.js'
import {
  validateRawExecutionSafety,
  validateScriptPathInRoots,
} from '../src/core/executor/safety-policy.js'

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    MACOS_KIT_ENABLE_RAW_SCRIPT: true,
    MACOS_KIT_DEFAULT_TIMEOUT_SECONDS: 30,
    MACOS_KIT_MAX_TIMEOUT_SECONDS: 120,
    MACOS_KIT_ALLOWED_SCRIPT_ROOTS: [],
    MACOS_KIT_KB_PATH: undefined,
    MACOS_KIT_SAFE_MODE: 'strict',
    MACOS_KIT_LOG_LEVEL: 'info',
    MACOS_KIT_ENABLE_AX_QUERY: false,
    MACOS_KIT_AX_BINARY_PATH: 'ax',
    ...overrides,
  }
}

test('validateScriptPathInRoots 可以正确识别白名单路径', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'macos-kit-test-'))
  const nestedDir = path.join(tempRoot, 'scripts')
  await fs.mkdir(nestedDir)
  const filePath = path.join(nestedDir, 'a.scpt')
  await fs.writeFile(filePath, 'return "ok"', 'utf8')

  const allowed = await validateScriptPathInRoots(filePath, [tempRoot])
  assert.equal(allowed, true)

  await fs.rm(tempRoot, { recursive: true, force: true })
})

test('validateScriptPathInRoots 会忽略无效白名单路径', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'macos-kit-test-'))
  const scriptDir = path.join(tempRoot, 'scripts')
  await fs.mkdir(scriptDir)
  const filePath = path.join(scriptDir, 'b.scpt')
  await fs.writeFile(filePath, 'return \"ok\"', 'utf8')

  const allowed = await validateScriptPathInRoots(filePath, [
    '/path/not/exist',
    tempRoot,
  ])
  assert.equal(allowed, true)

  await fs.rm(tempRoot, { recursive: true, force: true })
})

test('validateRawExecutionSafety 在 strict 模式阻断高风险脚本', async () => {
  const config = makeConfig({ MACOS_KIT_ALLOWED_SCRIPT_ROOTS: ['/tmp'] })
  const result = await validateRawExecutionSafety({
    config,
    scriptContent: 'do shell script "rm -rf /"',
  })

  assert.ok(result)
  assert.equal(result?.ok, false)
  assert.equal(result?.error?.code, 'SAFETY_BLOCKED')
})

test('validateRawExecutionSafety 在 scriptPath 模式同样阻断高风险脚本', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'macos-kit-test-'))
  const scriptPath = path.join(tempRoot, 'danger.scpt')
  await fs.writeFile(scriptPath, 'do shell script "rm -rf /"', 'utf8')

  try {
    const config = makeConfig({ MACOS_KIT_ALLOWED_SCRIPT_ROOTS: [tempRoot] })
    const result = await validateRawExecutionSafety({
      config,
      scriptPath,
    })
    assert.ok(result)
    assert.equal(result?.ok, false)
    assert.equal(result?.error?.code, 'SAFETY_BLOCKED')
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})

test('validateRawExecutionSafety 在安全模式下阻断二进制脚本文件', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'macos-kit-test-'))
  const scriptPath = path.join(tempRoot, 'danger.scpt')
  await fs.writeFile(scriptPath, Buffer.from([0, 1, 2, 3, 4]))

  try {
    const config = makeConfig({ MACOS_KIT_ALLOWED_SCRIPT_ROOTS: [tempRoot] })
    const result = await validateRawExecutionSafety({
      config,
      scriptPath,
    })
    assert.ok(result)
    assert.equal(result?.ok, false)
    assert.equal(result?.error?.code, 'SAFETY_BLOCKED')
    assert.match(result?.error?.message ?? '', /二进制脚本文件/)
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})
