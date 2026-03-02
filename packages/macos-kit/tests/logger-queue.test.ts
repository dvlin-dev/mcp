import assert from 'node:assert/strict'
import test from 'node:test'
import { Logger } from '../src/core/logger.js'
import { SerialTaskQueue } from '../src/core/executor/queue.js'

test('Logger 根据级别输出并包含 scope', () => {
  const logs: string[] = []
  const original = console.error
  console.error = (...args: unknown[]) => {
    logs.push(args.map((item) => String(item)).join(' '))
  }

  try {
    const logger = new Logger('warn', 'test-scope')
    logger.debug('debug msg')
    logger.info('info msg')
    logger.warn('warn msg')
    logger.error('error msg', { code: 1 })
  } finally {
    console.error = original
  }

  assert.equal(logs.length, 2)
  assert.match(logs[0], /\[test-scope\] \[WARN\] warn msg/)
  assert.match(logs[1], /\[test-scope\] \[ERROR\] error msg/)
  assert.match(logs[1], /"code":1/)
})

test('SerialTaskQueue 串行执行任务', async () => {
  const queue = new SerialTaskQueue()
  const timeline: string[] = []

  const first = queue.run(async () => {
    timeline.push('first-start')
    await new Promise((resolve) => setTimeout(resolve, 30))
    timeline.push('first-end')
    return 'first'
  })

  const second = queue.run(async () => {
    timeline.push('second-start')
    timeline.push('second-end')
    return 'second'
  })

  const [a, b] = await Promise.all([first, second])
  assert.equal(a, 'first')
  assert.equal(b, 'second')
  assert.deepEqual(timeline, [
    'first-start',
    'first-end',
    'second-start',
    'second-end',
  ])
})
