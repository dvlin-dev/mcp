# @mcp/email

Email MCP Server - 提供邮件操作能力的 MCP 服务。

## 功能特性

- **多账户支持**：Gmail、QQ 邮箱、163 邮箱、Outlook、自定义 IMAP/SMTP 服务器
- **邮件读取**：列出邮件、获取详情、下载附件
- **邮件搜索**：按关键词、发件人、日期等条件搜索
- **邮件操作**：标记已读/未读、标星、删除、移动
- **邮件发送**：发送新邮件、回复、转发

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置账户

复制环境变量示例文件并填入账户信息：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置 `EMAIL_ACCOUNTS`：

```bash
EMAIL_ACCOUNTS='[
  {
    "id": "work",
    "email": "user@gmail.com",
    "password": "your-app-password",
    "provider": "gmail"
  }
]'
```

### 3. 运行

```bash
# 开发模式
pnpm dev:stdio

# 构建
pnpm build
```

## 账户配置

### 支持的邮箱提供商

| Provider | 说明 | 密码类型 |
|----------|------|----------|
| `gmail` | Gmail | [应用专用密码](https://myaccount.google.com/apppasswords) |
| `qq` | QQ 邮箱 | 授权码 |
| `163` | 163 邮箱 | 授权码 |
| `outlook` | Outlook/Hotmail | 账户密码 |
| `custom` | 自定义服务器 | - |

### 配置格式

```typescript
interface Account {
  id: string           // 账户唯一标识
  email: string        // 邮箱地址
  password: string     // 密码或授权码
  provider: 'gmail' | 'qq' | '163' | 'outlook' | 'custom'
  // 以下为可选配置（有默认值）
  trash_folder?: string  // 垃圾箱文件夹名称
  // 以下仅 provider='custom' 时需要
  imap_server?: string
  imap_port?: number
  smtp_server?: string
  smtp_port?: number
  smtp_secure?: boolean  // true=SSL, false=STARTTLS
}
```

### 各提供商默认垃圾箱文件夹

| Provider | 默认 trash_folder |
|----------|------------------|
| `gmail` | `[Gmail]/Trash` |
| `qq` | `Deleted Messages` |
| `163` | `已删除` |
| `outlook` | `Deleted` |
| `custom` | `Trash` |

### 自定义服务器示例

```json
{
  "id": "company",
  "email": "user@company.com",
  "password": "password",
  "provider": "custom",
  "imap_server": "imap.company.com",
  "imap_port": 993,
  "smtp_server": "smtp.company.com",
  "smtp_port": 465,
  "smtp_secure": true
}
```

## MCP Tools

### 账户管理

| 工具 | 描述 |
|------|------|
| `list_accounts` | 列出已配置的邮箱账户 |
| `test_connection` | 测试 IMAP/SMTP 连接 |

### 邮件读取

| 工具 | 描述 | 主要参数 |
|------|------|----------|
| `list_emails` | 列出邮件 | `account_id`, `folder`, `limit`, `unread_only` |
| `list_folders` | 列出文件夹 | `account_id` |
| `get_email_detail` | 获取邮件详情 | `account_id`, `uid`, `folder` |
| `get_attachments` | 获取附件（Base64） | `account_id`, `uid`, `folder` |

### 邮件搜索

| 工具 | 描述 | 主要参数 |
|------|------|----------|
| `search_emails` | 搜索邮件 | `account_id`, `query`, `search_in`, `date_from`, `date_to` |

### 邮件操作

| 工具 | 描述 | 主要参数 |
|------|------|----------|
| `mark_emails` | 标记已读/未读 | `account_id`, `uids`, `mark_as` |
| `flag_email` | 标星/取消标星 | `account_id`, `uid`, `set_flag` |
| `delete_emails` | 删除邮件 | `account_id`, `uids`, `permanent` |
| `move_emails` | 移动邮件 | `account_id`, `uids`, `target_folder` |

### 邮件发送

| 工具 | 描述 | 主要参数 |
|------|------|----------|
| `send_email` | 发送新邮件 | `account_id`, `to`, `subject`, `body` |
| `reply_email` | 回复邮件 | `account_id`, `uid`, `body`, `reply_all` |
| `forward_email` | 转发邮件 | `account_id`, `uid`, `to`, `comment` |

## 客户端配置

### Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "email": {
      "command": "node",
      "args": ["/path/to/mcp/packages/email/dist/transports/stdio.js"],
      "env": {
        "EMAIL_ACCOUNTS": "[{\"id\":\"work\",\"email\":\"user@gmail.com\",\"password\":\"xxx\",\"provider\":\"gmail\"}]"
      }
    }
  }
}
```

### VSCode MCP 插件

在 `.vscode/mcp.json` 中配置：

```json
{
  "servers": {
    "email": {
      "command": "node",
      "args": ["${workspaceFolder}/packages/email/dist/transports/stdio.js"],
      "env": {
        "EMAIL_ACCOUNTS": "[...]"
      }
    }
  }
}
```

## 开发

```bash
# 类型检查
pnpm typecheck

# 构建
pnpm build

# 本地调试
pnpm dev:stdio
```

## 注意事项

1. **授权码**：QQ/163 邮箱需要在邮箱设置中开启 IMAP 服务并获取授权码
2. **应用密码**：Gmail 需要开启两步验证后生成应用专用密码
3. **163 邮箱**：自动处理 IMAP ID 扩展，解决"不安全登录"问题
4. **Worker 模式**：由于 IMAP/SMTP 需要 TCP 连接，Cloudflare Worker 环境下功能受限

## 许可证

MIT
