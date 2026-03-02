import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { OsaScriptExecutor, ExecutorError } from '../src/core/executor/osascript-executor.js'
import { Logger } from '../src/core/logger.js'

const executor = new OsaScriptExecutor(new Logger('error', 'executor-test'))

test('osascript-executor: 缺少脚本源时报错', async () => {
  await assert.rejects(
    () =>
      executor.execute({
        language: 'applescript',
        timeoutSeconds: 1,
      } as any),
    /缺少脚本内容或脚本路径/
  )
})

test('osascript-executor: 同时传 scriptContent/scriptPath 报错', async () => {
  await assert.rejects(
    () =>
      executor.execute({
        scriptContent: 'return "a"',
        scriptPath: '/tmp/xx.scpt',
        language: 'applescript',
        timeoutSeconds: 1,
      }),
    /scriptContent 与 scriptPath 不能同时传入/
  )
})

test('osascript-executor: 脚本文件不存在时返回 ScriptFileAccessError', async () => {
  await assert.rejects(
    async () => {
      await executor.execute({
        scriptPath: '/definitely/not-exist.scpt',
        language: 'applescript',
        timeoutSeconds: 1,
      })
    },
    (error: unknown) =>
      error instanceof ExecutorError && error.name === 'ScriptFileAccessError'
  )
})

test('osascript-executor: 在可用平台执行最小脚本', async () => {
  if (process.platform !== 'darwin') {
    await assert.rejects(
      () =>
        executor.execute({
          scriptContent: 'return "ok"',
          language: 'applescript',
          timeoutSeconds: 1,
        }),
      /仅支持在 macOS 执行/
    )
    return
  }

  const result = await executor.execute({
    scriptContent: 'return "ok"',
    language: 'applescript',
    timeoutSeconds: 2,
  })
  assert.equal(result.stdout, 'ok')
})

test('osascript-executor: 超时场景能识别 isTimeout', async () => {
  if (process.platform !== 'darwin') {
    return
  }

  await assert.rejects(
    async () => {
      await executor.execute({
        scriptContent: 'delay 2\nreturn "done"',
        language: 'applescript',
        timeoutSeconds: 1,
      })
    },
    (error: unknown) => error instanceof ExecutorError && error.isTimeout === true
  )
})

test('osascript-executor: scriptPath 模式支持参数透传', async () => {
  if (process.platform !== 'darwin') {
    return
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'macos-kit-osa-'))
  const scriptPath = path.join(tempRoot, 'args.scpt')
  await fs.writeFile(
    scriptPath,
    `on run argv\n  return item 1 of argv\nend run`,
    'utf8'
  )

  try {
    const result = await executor.execute({
      scriptPath,
      language: 'applescript',
      timeoutSeconds: 2,
      args: ['hello'],
    })
    assert.equal(result.stdout, 'hello')
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})
