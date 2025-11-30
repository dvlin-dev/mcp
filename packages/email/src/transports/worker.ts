/**
 * Cloudflare Worker 传输入口
 *
 * 实现 MCP Streamable HTTP 传输协议
 *
 * 注意：由于 IMAP/SMTP 需要 TCP 连接，Worker 环境下功能受限。
 * 完整功能请使用 stdio 模式。
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { toReqRes, toFetchResponse } from 'fetch-to-node'
import { loadConfigFromCfEnv } from '../core/config.js'
import { registerAllTools } from '../core/tools/index.js'

/**
 * Cloudflare Workers 环境变量类型
 */
type Env = {
  EMAIL_ACCOUNTS: string
}

const app = new Hono<{ Bindings: Env }>()

// 启用 CORS
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'mcp-session-id'],
    exposeHeaders: ['mcp-session-id'],
  })
)

/**
 * MCP 端点 - 处理 Streamable HTTP 请求
 */
app.post('/mcp', async (c) => {
  try {
    // 加载配置并创建 Server
    const config = loadConfigFromCfEnv(c.env)

    const server = new McpServer({
      name: 'email',
      version: '0.1.0',
    })

    registerAllTools(server, config)

    // 将 Fetch API Request 转换为 Node.js 风格
    const { req, res } = toReqRes(c.req.raw)

    // 创建 Streamable HTTP 传输层
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
    })

    // 连接关闭时清理资源
    res.on('close', () => {
      transport.close()
      server.close()
    })

    // 连接 Server 和 Transport
    await server.connect(transport)

    // 处理请求
    const body = await c.req.json()
    await transport.handleRequest(req, res, body)

    // 转换回 Fetch API Response
    return toFetchResponse(res)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('MCP request error:', message)

    return c.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: `Internal error: ${message}`,
        },
        id: null,
      },
      500
    )
  }
})

/**
 * 处理 DELETE 请求 - 关闭会话
 */
app.delete('/mcp', async (c) => {
  return c.json({ status: 'ok' })
})

/**
 * 健康检查端点
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'mcp-email',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  })
})

/**
 * 根路径 - 服务信息
 */
app.get('/', (c) => {
  return c.json({
    name: 'MCP Email Server',
    version: '0.1.0',
    description: 'Email operations via IMAP/SMTP',
    transport: 'Streamable HTTP',
    note: 'IMAP/SMTP requires TCP connections. Full functionality available in stdio mode only.',
    endpoints: {
      mcp: {
        path: '/mcp',
        methods: ['POST', 'DELETE'],
        description: 'MCP Streamable HTTP endpoint',
      },
      health: {
        path: '/health',
        methods: ['GET'],
        description: 'Health check',
      },
    },
  })
})

export default app
