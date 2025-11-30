/**
 * Email MCP Server
 *
 * 提供邮件操作能力的 MCP Server，支持：
 * - 多账户管理（Gmail、QQ、163、Outlook、自定义）
 * - 邮件读取、搜索、标记、删除、移动
 * - 发送、回复、转发邮件
 * - 附件处理
 */

// 配置
export {
  loadConfigFromEnv,
  loadConfigFromCfEnv,
  resolveAccount,
  type AppConfig,
  type Account,
  type ResolvedAccount,
  type ProviderName,
  EMAIL_PROVIDERS,
} from './core/config.js'

// Server
export { createMcpServer } from './core/server.js'

// 客户端（可单独使用）
export { ImapClient, type EmailSummary, type EmailDetail, type FolderInfo, type AttachmentInfo, type SearchCriteria } from './core/imap-client.js'
export { SmtpClient, type SendEmailOptions, type SendResult, type AttachmentInput } from './core/smtp-client.js'
