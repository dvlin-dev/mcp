export interface PlaceholderSubstituteOptions {
  scriptContent: string
  language?: 'applescript' | 'javascript'
  inputData?: Record<string, unknown>
  args?: string[]
}

function camelToSnake(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)
}

function escapeAppleScriptString(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')}"`
}

export function valueToAppleScriptLiteral(value: unknown): string {
  if (typeof value === 'string') {
    return escapeAppleScriptString(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return `{${value.map((item) => valueToAppleScriptLiteral(item)).join(', ')}}`
  }

  if (value && typeof value === 'object') {
    const record = Object.entries(value)
      .map(([key, item]) => `${key}:${valueToAppleScriptLiteral(item)}`)
      .join(', ')
    return `{${record}}`
  }

  return 'missing value'
}

export function valueToJavaScriptLiteral(value: unknown): string {
  if (value === undefined || value === null) {
    return 'null'
  }

  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  const serialized = JSON.stringify(value)
  return serialized ?? 'null'
}

function valueToLiteral(
  value: unknown,
  language: 'applescript' | 'javascript'
): string {
  if (language === 'javascript') {
    return valueToJavaScriptLiteral(value)
  }
  return valueToAppleScriptLiteral(value)
}

export function substitutePlaceholders({
  scriptContent,
  language = 'applescript',
  inputData,
  args,
}: PlaceholderSubstituteOptions): string {
  let output = scriptContent

  output = output.replace(/(["'])--MCP_INPUT:(\w+)\1/g, (_match, _q, key) => {
    const mappedKey = camelToSnake(String(key))
    const value = inputData?.[mappedKey]
    return valueToLiteral(value, language)
  })

  output = output.replace(/(["'])--MCP_ARG_(\d+)\1/g, (_match, _q, indexText) => {
    const index = Number(indexText) - 1
    const value = args && index >= 0 ? args[index] : undefined
    return valueToLiteral(value, language)
  })

  output = output.replace(/--MCP_INPUT:(\w+)/g, (_match, key) => {
    const mappedKey = camelToSnake(String(key))
    const value = inputData?.[mappedKey]
    return valueToLiteral(value, language)
  })

  output = output.replace(/--MCP_ARG_(\d+)/g, (_match, indexText) => {
    const index = Number(indexText) - 1
    const value = args && index >= 0 ? args[index] : undefined
    return valueToLiteral(value, language)
  })

  output = output.replace(/\$\{inputData\.(\w+)\}/g, (_match, key) => {
    const mappedKey = camelToSnake(String(key))
    const value = inputData?.[mappedKey]
    return valueToLiteral(value, language)
  })

  output = output.replace(/\$\{arguments\[(\d+)\]\}/g, (_match, indexText) => {
    const index = Number(indexText)
    const value = args?.[index]
    return valueToLiteral(value, language)
  })

  return output
}
