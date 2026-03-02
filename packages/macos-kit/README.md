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
pnpm --filter ./packages/macos-kit --fail-if-no-match build
pnpm --filter ./packages/macos-kit --fail-if-no-match dev:stdio
```

也可以在仓库根目录使用脚本别名：

```bash
pnpm macos-kit:build
pnpm macos-kit:dev
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

## AX 自动安装策略

- 不使用 `postinstall`，避免影响 MCP 安装超时窗口
- MCP 启动后会预热检查 AX：存在则直接复用，不存在则按配置尝试自动下载
- 调用 `accessibility_query` 前会再次兜底检查，确保首次调用尽量可用

自动下载相关配置：

```bash
# 是否开启自动安装（默认 true）
MACOS_KIT_AX_AUTO_INSTALL=true
# 下载地址模板（可使用 {platform} 与 {arch} 占位符）
MACOS_KIT_AX_DOWNLOAD_URL=https://example.com/ax/{platform}/{arch}/ax
# 可选：自定义缓存目录（默认 ~/.cache/moryflow/macos-kit/bin）
MACOS_KIT_AX_CACHE_DIR=~/.cache/moryflow/macos-kit/bin
```

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
- `MACOS_KIT_AX_AUTO_INSTALL`（默认 `true`）
- `MACOS_KIT_AX_DOWNLOAD_URL`（可选，配置后启用自动下载）
- `MACOS_KIT_AX_CACHE_DIR`（可选）
- `MACOS_KIT_SAFE_MODE`（`strict | balanced | off`，默认 `balanced`）
