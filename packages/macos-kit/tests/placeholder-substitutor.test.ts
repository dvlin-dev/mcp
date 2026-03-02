import assert from 'node:assert/strict'
import test from 'node:test'
import {
  substitutePlaceholders,
  valueToAppleScriptLiteral,
} from '../src/core/executor/placeholder-substitutor.js'

test('valueToAppleScriptLiteral 支持基础类型转换', () => {
  assert.equal(valueToAppleScriptLiteral('hello'), '"hello"')
  assert.equal(valueToAppleScriptLiteral(12), '12')
  assert.equal(valueToAppleScriptLiteral(true), 'true')
  assert.equal(valueToAppleScriptLiteral(['a', 1]), '{"a", 1}')
})

test('substitutePlaceholders 能替换命名与位置参数', () => {
  const source = [
    'set nameText to --MCP_INPUT:user_name',
    'set firstArg to --MCP_ARG_1',
    'set secondArg to "--MCP_ARG_2"',
  ].join('\n')

  const output = substitutePlaceholders({
    scriptContent: source,
    inputData: { user_name: 'Bowling' },
    args: ['foo', 'bar'],
  })

  assert.match(output, /set nameText to "Bowling"/)
  assert.match(output, /set firstArg to "foo"/)
  assert.match(output, /set secondArg to "bar"/)
})
