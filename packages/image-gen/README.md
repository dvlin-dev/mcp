# @mcp/image-gen

基于 OpenRouter API 的 AI 图片生成 MCP Server。

通过 MCP 协议为 Claude Desktop、VSCode 等客户端提供 AI 图片生成能力。

## 特性

- 支持多种图片生成模型（Gemini 等）
- 通过 OpenRouter 统一接入，无需管理多个 API Key
- 支持 stdio 本地模式和 Cloudflare Workers 云端部署
- 返回 base64 图片，可直接在对话中展示

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 构建

```bash
pnpm build
```

### 3. 配置客户端

参考下方「客户端配置」章节。

## 客户端配置

### Claude Desktop

编辑配置文件：

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**推荐方式（使用打包后的文件）：**

```json
{
  "mcpServers": {
    "image-gen": {
      "command": "node",
      "args": ["/path/to/mcp/packages/image-gen/dist/transports/stdio.js"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-xxx"
      }
    }
  }
}
```

> 将 `/path/to/mcp` 替换为你的实际项目路径

### Cursor

编辑 `~/.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "image-gen": {
      "command": "node",
      "args": ["/path/to/mcp/packages/image-gen/dist/transports/stdio.js"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-xxx"
      }
    }
  }
}
```

### VSCode

在 `.vscode/mcp.json` 或用户设置中添加：

```json
{
  "mcpServers": {
    "image-gen": {
      "command": "node",
      "args": ["${workspaceFolder}/packages/image-gen/dist/transports/stdio.js"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-xxx"
      }
    }
  }
}
```

## 工具列表

### generate_image

根据文本描述生成图片。

**参数：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `prompt` | string | 是 | 图片描述 |
| `model` | string | 否 | 模型 ID，默认使用 `DEFAULT_MODEL` |

**示例对话：**

```
用户: 帮我生成一张赛博朋克风格的城市夜景图片

Claude: 我来为你生成这张图片。
[调用 generate_image，prompt: "A cyberpunk city at night..."]

生成成功！这是一张赛博朋克风格的城市夜景...
[显示图片]
```

### list_image_models

列出可用的图片生成模型。

**参数：** 无

**返回：** 模型列表及说明

## 环境变量

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `OPENROUTER_API_KEY` | 是 | - | OpenRouter API Key |
| `DEFAULT_MODEL` | 否 | `google/gemini-2.0-flash-exp:free` | 默认模型 |

> 获取 API Key: https://openrouter.ai/keys

## 项目结构

```
src/
├── index.ts                 # 包入口
├── core/
│   ├── config.ts           # 配置加载
│   ├── server.ts           # MCP Server 工厂
│   └── tools/
│       ├── index.ts        # 工具导出
│       └── generate.ts     # 图片生成实现
└── transports/
    ├── stdio.ts            # 本地 stdio 入口
    └── worker.ts           # Cloudflare Worker 入口
```

## 开发

```bash
# 类型检查
pnpm typecheck

# 构建
pnpm build

# 开发模式（直接运行 TS）
pnpm dev:stdio

# Cloudflare 本地调试
pnpm dev:worker

# 部署到 Cloudflare
pnpm deploy
```

## 支持的模型

| 模型 ID | 说明 |
|---------|------|
| `google/gemini-2.0-flash-exp:free` | Gemini 2.0 Flash 免费版 |
| `google/gemini-2.0-flash-exp` | Gemini 2.0 Flash |

> 更多模型请查看 [OpenRouter Models](https://openrouter.ai/models)

## 常见问题

### Q: 图片生成失败？

1. 检查 `OPENROUTER_API_KEY` 是否正确
2. 确认账户有足够的额度
3. 尝试使用免费模型 `google/gemini-2.0-flash-exp:free`

### Q: 如何使用其他模型？

在调用 `generate_image` 时指定 `model` 参数：

```
生成图片，使用 google/gemini-2.0-flash-exp 模型
```

### Q: 修改代码后如何更新？

重新构建即可：

```bash
pnpm build
```

客户端会在下次启动时自动加载新版本。

## License

MIT
