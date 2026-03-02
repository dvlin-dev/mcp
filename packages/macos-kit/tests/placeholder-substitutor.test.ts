import assert from 'node:assert/strict'
import test from 'node:test'
import {
  substitutePlaceholders,
  valueToAppleScriptLiteral,
  valueToJavaScriptLiteral,
} from '../src/core/executor/placeholder-substitutor.js'

test('valueToAppleScriptLiteral 支持基础类型转换', () => {
  assert.equal(valueToAppleScriptLiteral('hello'), '"hello"')
  assert.equal(valueToAppleScriptLiteral(12), '12')
  assert.equal(valueToAppleScriptLiteral(true), 'true')
  assert.equal(valueToAppleScriptLiteral(['a', 1]), '{"a", 1}')
})

test('valueToJavaScriptLiteral 支持对象与缺省值转换', () => {
  assert.equal(valueToJavaScriptLiteral('hello'), '"hello"')
  assert.equal(valueToJavaScriptLiteral(12), '12')
  assert.equal(valueToJavaScriptLiteral(true), 'true')
  assert.equal(valueToJavaScriptLiteral(['a', 1]), '["a",1]')
  assert.equal(valueToJavaScriptLiteral({ key: 'value' }), '{"key":"value"}')
  assert.equal(valueToJavaScriptLiteral(undefined), 'null')
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

test('substitutePlaceholders 在 javascript 模板按 JS 字面量替换', () => {
  const source = [
    'const payload = --MCP_INPUT:payload',
    'const optionalValue = --MCP_INPUT:optional_value',
    'const firstArg = --MCP_ARG_1',
  ].join('\n')

  const output = substitutePlaceholders({
    scriptContent: source,
    language: 'javascript',
    inputData: { payload: { tags: ['a', 1] } },
    args: ['foo'],
  })

  assert.match(output, /const payload = {"tags":\["a",1\]}/)
  assert.match(output, /const optionalValue = null/)
  assert.match(output, /const firstArg = "foo"/)
})
