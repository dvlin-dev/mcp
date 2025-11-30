# Email MCP 方案

## 一、项目概述

将 `email-mcp-service` 的核心邮箱操作能力抽离为 TypeScript 版本的 MCP Server，放置于 `packages/email`。

**保留功能**（核心邮箱操作）：

- IMAP 连接管理（支持 163/QQ/Gmail/Outlook/自定义）
- SMTP 发送管理
- 邮件读取、搜索、标记、删除、移动
- 发送、回复、转发邮件
- 附件处理
- 多账户支持

**移除功能**（自动化流程）：

- n8n 工作流集成
- AI 邮件过滤/监控
- 后台同步调度器
- 联系人分析
- 本地数据库缓存

## 二、技术架构

```
packages/email/
├── src/
│   ├── core/
│   │   ├── config.ts          # 配置 Schema（账户列表）
│   │   ├── server.ts          # MCP Server 工厂
│   │   ├── imap-client.ts     # IMAP 连接封装
│   │   ├── smtp-client.ts     # SMTP 连接封装
│   │   └── tools/
│   │       ├── index.ts
│   │       ├── list.ts        # list_emails, list_folders
│   │       ├── read.ts        # get_email_detail, get_attachments
│   │       ├── search.ts      # search_emails
│   │       ├── modify.ts      # mark_emails, flag_email, delete_emails, move_emails
│   │       └── send.ts        # send_email, reply_email, forward_email
│   ├── transports/
│   │   ├── stdio.ts           # 本地 CLI 入口
│   │   └── worker.ts          # Cloudflare Worker 入口
│   └── index.ts
├── package.json
├── tsconfig.json
├── wrangler.jsonc
└── .env.example
```

## 三、核心模块设计

### 3.1 配置模块 (config.ts)

使用 zod 定义账户配置：

```typescript
// 单个账户配置
AccountSchema = {
  id: string,           // 账户标识
  email: string,        // 邮箱地址
  password: string,     // 密码/授权码
  provider: 'gmail' | 'qq' | '163' | 'outlook' | 'custom',
  // 自定义服务器（provider='custom' 时使用）
  imap_server?: string,
  imap_port?: number,
  smtp_server?: string,
  smtp_port?: number,
}

// 应用配置
AppConfigSchema = {
  ACCOUNTS: AccountSchema[]  // 账户列表，通过 JSON 字符串环境变量传入
}
```

### 3.2 连接模块

**imap-client.ts** - 封装 IMAP 操作：

- 使用 `imapflow` 库（现代 Promise-based IMAP 客户端）
- 内置主流邮箱预设配置（163 需要 IMAP ID 命令解决"不安全登录"问题）
- 提供 `connect()`, `disconnect()`, `select()`, `fetch()`, `search()`, `store()`, `move()` 等方法

**smtp-client.ts** - 封装 SMTP 操作：

- 使用 `nodemailer` 库
- 支持 SSL/TLS 两种模式
- 提供 `sendMail()` 方法

### 3.3 MCP Tools（共 10 个）

| 工具名             | 描述           | 核心参数                                         |
| ------------------ | -------------- | ------------------------------------------------ |
| `list_accounts`    | 列出已配置账户 | -                                                |
| `list_emails`      | 列出邮件       | `account_id`, `folder`, `limit`, `unread_only`   |
| `list_folders`     | 列出文件夹     | `account_id`                                     |
| `get_email_detail` | 获取邮件详情   | `account_id`, `email_id`, `folder`               |
| `search_emails`    | 搜索邮件       | `account_id`, `query`, `search_in`, `date_from/to` |
| `mark_emails`      | 标记已读/未读  | `account_id`, `email_ids`, `mark_as`             |
| `flag_email`       | 标星/取消标星  | `account_id`, `email_id`, `set_flag`             |
| `delete_emails`    | 删除邮件       | `account_id`, `email_ids`, `permanent`           |
| `move_emails`      | 移动邮件       | `account_id`, `email_ids`, `target_folder`       |
| `send_email`       | 发送/回复/转发 | `account_id`, `to`, `subject`, `body`, `reply_to_id?` |

### 3.4 依赖选型

| 用途    | 库                            | 理由                              |
| ------- | ----------------------------- | --------------------------------- |
| IMAP    | `imapflow`                    | 现代 async/await API，支持 IMAP ID 扩展 |
| SMTP    | `nodemailer`                  | Node.js 生态标准，稳定成熟        |
| Schema  | `zod`                         | 与现有项目一致                    |
| MCP SDK | `@modelcontextprotocol/sdk`   | 官方 SDK                          |

## 四、账户配置方式

环境变量 `EMAIL_ACCOUNTS` 传入 JSON 数组：

```bash
EMAIL_ACCOUNTS='[
  {
    "id": "work",
    "email": "user@gmail.com",
    "password": "app-password",
    "provider": "gmail"
  },
  {
    "id": "personal",
    "email": "user@163.com",
    "password": "auth-code",
    "provider": "163"
  }
]'
```

## 五、与原项目差异

| 方面     | 原 Python 版              | 新 TS 版               |
| -------- | ------------------------- | ---------------------- |
| 连接管理 | 每次操作新建连接          | 同上（保持简单）       |
| 多账户   | 文件配置 + AccountManager | 环境变量 JSON          |
| 缓存/同步 | SQLite 本地缓存          | 无（直连 IMAP）        |
| 自动化   | n8n 集成                  | 无                     |
| 附件     | 可保存到本地              | 返回 Base64 或元信息   |

## 六、实施计划

1. **初始化项目** - 复制 image-gen 模板，配置 package.json
2. **实现连接模块** - imap-client.ts, smtp-client.ts
3. **实现 MCP Tools** - 按上述 10 个工具逐个实现
4. **配置与入口** - stdio.ts, worker.ts
5. **测试验证** - 本地 stdio 模式测试

## 七、风险与假设

1. **假设**：用户每次操作都可接受直连 IMAP 的延迟（无本地缓存）
2. **风险**：163 邮箱的 IMAP ID 机制在 `imapflow` 中需验证是否开箱支持
3. **限制**：附件转发需先下载再上传，大附件场景性能有限
