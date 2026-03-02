# @moryflow/macos-kit

macOS 自动化 MCP Server（stdio-only）。

## 特性

- 统一执行内核（AppleScript/JXA）
- 模板知识库检索与模板执行
- 语义化工具集（system/finder/clipboard/mail/messages 等）
- 零配置宽松模式（默认可直接调用 raw 与 AX 能力）

## 运行

```bash
pnpm install
pnpm --filter @moryflow/macos-kit build
pnpm --filter @moryflow/macos-kit dev:stdio
```

## MCP 配置示例

```json
{
  "mcpServers": {
    "macos-kit": {
      "command": "node",
      "args": ["/path/to/packages/macos-kit/dist/transports/stdio.js"],
      "env": {
        "MACOS_KIT_ENABLE_RAW_SCRIPT": "true",
        "MACOS_KIT_ENABLE_AX_QUERY": "true",
        "MACOS_KIT_SAFE_MODE": "balanced"
      }
    }
  }
}
```

## 零配置默认行为

- 默认开启 `run_macos_script`（`MACOS_KIT_ENABLE_RAW_SCRIPT=true`）
- 默认开启 `accessibility_query`（`MACOS_KIT_ENABLE_AX_QUERY=true`）
- 默认启用中等风险扫描（`MACOS_KIT_SAFE_MODE=balanced`）
- 默认不限制 `script_path` 目录（`MACOS_KIT_ALLOWED_SCRIPT_ROOTS=[]`）

`MACOS_KIT_SAFE_MODE` 分级：

- `strict`：阻断关键危险命令 + `curl | sh`，并阻断二进制脚本文件
- `balanced`：仅阻断关键危险命令（默认）
- `off`：关闭风险扫描

如需收紧权限，建议显式设置：

```bash
MACOS_KIT_ENABLE_RAW_SCRIPT=true
MACOS_KIT_ENABLE_AX_QUERY=true
MACOS_KIT_SAFE_MODE=strict
MACOS_KIT_ALLOWED_SCRIPT_ROOTS=/Users/you/scripts
```

## 关键环境变量

- `MACOS_KIT_ENABLE_RAW_SCRIPT`（默认 `true`）
- `MACOS_KIT_ALLOWED_SCRIPT_ROOTS`（默认空；仅配置后才启用路径白名单）
- `MACOS_KIT_KB_PATH`
- `MACOS_KIT_ENABLE_AX_QUERY`（默认 `true`）
- `MACOS_KIT_AX_BINARY_PATH`（默认 `ax`）
- `MACOS_KIT_SAFE_MODE`（`strict | balanced | off`，默认 `balanced`）
