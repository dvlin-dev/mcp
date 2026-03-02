import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

interface ContractResponse {
  ok: boolean
  data: unknown
  error: { code: string; message: string } | null
}

function parseContractResponse(payload: unknown): ContractResponse {
  const text = String((payload as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? '')
  return JSON.parse(text) as ContractResponse
}

test('stdio 集成：工具列表与基础调用可用', async () => {
  const packageRoot = process.cwd()
  const tsxPath = path.join(packageRoot, 'node_modules/.bin/tsx')
  const serverPath = path.join(packageRoot, 'src/transports/stdio.ts')

  const transport = new StdioClientTransport({
    command: tsxPath,
    args: [serverPath],
    cwd: packageRoot,
    stderr: 'pipe',
    env: {
      ...process.env,
      MACOS_KIT_ENABLE_RAW_SCRIPT: 'false',
      MACOS_KIT_ENABLE_AX_QUERY: 'false',
    },
  })

  const client = new Client({
    name: 'macos-kit-stdio-test',
    version: '0.0.0',
  })

  await client.connect(transport)
  try {
    const tools = await client.listTools()
    assert.ok(tools.tools.some((tool) => tool.name === 'run_macos_template'))
    assert.ok(tools.tools.some((tool) => tool.name === 'messages_search_messages'))

    const listResult = await client.callTool({
      name: 'list_macos_automation_categories',
      arguments: {},
    })
    const listPayload = parseContractResponse(listResult)
    assert.equal(listPayload.ok, true)

    const searchResult = await client.callTool({
      name: 'search_macos_automation_tips',
      arguments: {
        query: 'battery',
        limit: 2,
      },
    })
    const searchPayload = parseContractResponse(searchResult)
    assert.equal(searchPayload.ok, true)

    const rawResult = await client.callTool({
      name: 'run_macos_script',
      arguments: {
        script_content: 'return "ok"',
      },
    })
    const rawPayload = parseContractResponse(rawResult)
    assert.equal(rawPayload.ok, false)
    assert.equal(rawPayload.error?.code, 'FEATURE_DISABLED')

    const notFoundResult = await client.callTool({
      name: 'run_macos_template',
      arguments: {
        template_id: 'template_not_exists',
      },
    })
    const notFoundPayload = parseContractResponse(notFoundResult)
    assert.equal(notFoundPayload.ok, false)
    assert.equal(notFoundPayload.error?.code, 'NOT_FOUND')
  } finally {
    await client.close()
  }
})
