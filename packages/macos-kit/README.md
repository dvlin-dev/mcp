# @mcp/macos-kit

macOS 自动化 MCP Server（stdio-only）。

## 特性

- 统一执行内核（AppleScript/JXA）
- 模板知识库检索与模板执行
- 语义化工具集（system/finder/clipboard/mail/messages 等）
- 默认安全策略（原始脚本执行默认关闭）

## 运行

```bash
pnpm install
pnpm --filter @mcp/macos-kit build
pnpm --filter @mcp/macos-kit dev:stdio
```

## MCP 配置示例

```json
{
  "mcpServers": {
    "macos-kit": {
      "command": "node",
      "args": ["/path/to/packages/macos-kit/dist/transports/stdio.js"],
      "env": {
        "MACOS_KIT_ENABLE_RAW_SCRIPT": "false"
      }
    }
  }
}
```

## 关键环境变量

- `MACOS_KIT_ENABLE_RAW_SCRIPT`
- `MACOS_KIT_ALLOWED_SCRIPT_ROOTS`
- `MACOS_KIT_KB_PATH`
- `MACOS_KIT_ENABLE_AX_QUERY`
- `MACOS_KIT_AX_BINARY_PATH`
