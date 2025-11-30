# MCP Server 构建指南

本仓库是一个 MCP Server monorepo，用于管理多个独立的 MCP 服务。

> 完整代码参考：[packages/image-gen](packages/image-gen)

---

## 一、项目结构

```
mcp/
├── packages/
│   ├── image-gen/          # 示例：图片生成 MCP
│   └── {name}/             # 其他 MCP 服务
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### 单个 MCP Server 结构

```
packages/{name}/
├── src/
│   ├── core/
│   │   ├── config.ts       # 配置加载
│   │   ├── server.ts       # Server 工厂
│   │   └── tools/          # 工具实现
│   ├── transports/
│   │   ├── stdio.ts        # 本地入口
│   │   └── worker.ts       # Cloudflare Worker 入口
│   └── index.ts
├── package.json
├── tsconfig.json
└── wrangler.jsonc
```

---

## 二、核心模块

### 2.1 配置模块 (config.ts)

使用 zod 定义配置 Schema，从环境变量加载。

**导出：**
- `AppConfigSchema` - 配置 Schema
- `AppConfig` - 配置类型
- `loadConfigFromEnv()` - stdio 模式加载
- `loadConfigFromCfEnv(env)` - worker 模式加载

### 2.2 Server 工厂 (server.ts)

创建 MCP Server 实例并注册工具。

**流程：**
1. `new McpServer({ name, version })`
2. 调用各 `registerXxxTools(server, config)`
3. 返回 server

### 2.3 工具模块 (tools/*.ts)

**注册格式：**
```typescript
server.registerTool(
  'tool_name',
  {
    title: '...',
    description: '...',
    inputSchema: { param: z.string() }
  },
  async (params) => ({
    content: [{ type: 'text', text: '...' }]
  })
)
```

### 2.4 传输层 (transports/)

**stdio.ts：**
```
loadConfigFromEnv() → createMcpServer() → StdioServerTransport
```

**worker.ts：**
```
Hono + StreamableHTTPServerTransport
```

---

## 三、开发流程

### 3.1 创建新 MCP

```bash
# 复制 image-gen 作为模板
cp -r packages/image-gen packages/{name}

# 修改 package.json 中的 name 等字段
# 实现自己的 tools
```

### 3.2 开发调试

```bash
cd packages/{name}
cp .env.example .env   # 配置环境变量
pnpm dev:stdio         # 开发模式
pnpm build             # 构建
```

### 3.3 客户端配置

```json
{
  "mcpServers": {
    "your-mcp": {
      "command": "node",
      "args": ["/path/to/packages/{name}/dist/transports/stdio.js"],
      "env": { "YOUR_API_KEY": "xxx" }
    }
  }
}
```

---

## 四、技术栈

| 类别 | 选择 |
|------|------|
| 包管理 | pnpm workspace |
| MCP SDK | @modelcontextprotocol/sdk |
| Schema | zod |
| HTTP | hono |
| 部署 | Cloudflare Workers |

---

## 五、注意事项

1. **独立性**：每个 MCP Server 可独立运行和部署
2. **配置隔离**：各服务有独立的 .env 和 wrangler.jsonc
3. **敏感信息**：本地用 .env，Cloudflare 用 `wrangler secret`
