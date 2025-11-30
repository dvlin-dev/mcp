import 'dotenv/config'
import { z } from 'zod'

/**
 * 邮箱提供商预设配置
 */
export const EMAIL_PROVIDERS = {
  gmail: {
    imap_server: 'imap.gmail.com',
    imap_port: 993,
    smtp_server: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_secure: false, // 使用 STARTTLS
    trash_folder: '[Gmail]/Trash',
  },
  qq: {
    imap_server: 'imap.qq.com',
    imap_port: 993,
    smtp_server: 'smtp.qq.com',
    smtp_port: 465,
    smtp_secure: true,
    trash_folder: 'Deleted Messages',
  },
  '163': {
    imap_server: 'imap.163.com',
    imap_port: 993,
    smtp_server: 'smtp.163.com',
    smtp_port: 465,
    smtp_secure: true,
    trash_folder: '已删除',
    // 163 邮箱需要发送 IMAP ID 命令
    requiresImapId: true,
  },
  outlook: {
    imap_server: 'outlook.office365.com',
    imap_port: 993,
    smtp_server: 'smtp.office365.com',
    smtp_port: 587,
    smtp_secure: false,
    trash_folder: 'Deleted',
  },
} as const

export type ProviderName = keyof typeof EMAIL_PROVIDERS | 'custom'

/**
 * 单个邮箱账户配置 Schema
 */
export const AccountSchema = z.object({
  /** 账户唯一标识 */
  id: z.string().min(1),
  /** 邮箱地址 */
  email: z.string().email(),
  /** 密码或授权码 */
  password: z.string().min(1),
  /** 邮箱提供商 */
  provider: z.enum(['gmail', 'qq', '163', 'outlook', 'custom']),
  /** 自定义 IMAP 服务器地址 */
  imap_server: z.string().optional(),
  /** 自定义 IMAP 端口 */
  imap_port: z.number().optional(),
  /** 自定义 SMTP 服务器地址 */
  smtp_server: z.string().optional(),
  /** 自定义 SMTP 端口 */
  smtp_port: z.number().optional(),
  /** SMTP 是否使用 SSL（true=SSL, false=STARTTLS） */
  smtp_secure: z.boolean().optional(),
  /** 垃圾箱文件夹名称（不同邮箱提供商名称不同） */
  trash_folder: z.string().optional(),
})

export type Account = z.infer<typeof AccountSchema>

/**
 * 解析后的账户配置（包含服务器信息）
 */
export interface ResolvedAccount extends Account {
  imap_server: string
  imap_port: number
  smtp_server: string
  smtp_port: number
  smtp_secure: boolean
  trash_folder: string
  requiresImapId?: boolean
}

/**
 * 应用配置 Schema
 */
export const AppConfigSchema = z.object({
  /** 邮箱账户列表 */
  ACCOUNTS: z.array(AccountSchema).min(1),
})

export type AppConfig = z.infer<typeof AppConfigSchema>

/**
 * 解析账户配置，填充提供商预设
 */
export function resolveAccount(account: Account): ResolvedAccount {
  if (account.provider === 'custom') {
    // 自定义提供商必须提供服务器配置
    if (!account.imap_server || !account.smtp_server) {
      throw new Error(
        `Account "${account.id}" uses custom provider but missing server configuration`
      )
    }
    return {
      ...account,
      imap_server: account.imap_server,
      imap_port: account.imap_port ?? 993,
      smtp_server: account.smtp_server,
      smtp_port: account.smtp_port ?? 465,
      smtp_secure: account.smtp_secure ?? true,
      trash_folder: account.trash_folder ?? 'Trash',
    }
  }

  // 使用预设配置
  const preset = EMAIL_PROVIDERS[account.provider]
  return {
    ...account,
    imap_server: account.imap_server ?? preset.imap_server,
    imap_port: account.imap_port ?? preset.imap_port,
    smtp_server: account.smtp_server ?? preset.smtp_server,
    smtp_port: account.smtp_port ?? preset.smtp_port,
    smtp_secure: account.smtp_secure ?? preset.smtp_secure,
    trash_folder: account.trash_folder ?? preset.trash_folder,
    requiresImapId: 'requiresImapId' in preset ? preset.requiresImapId : false,
  }
}

/**
 * 解析 JSON 字符串为账户数组
 */
function parseAccountsJson(json: string): Account[] {
  try {
    const parsed = JSON.parse(json)
    return z.array(AccountSchema).parse(parsed)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ')
      throw new Error(`Invalid account configuration: ${messages}`)
    }
    throw new Error(`Failed to parse EMAIL_ACCOUNTS JSON: ${error}`)
  }
}

/**
 * 从 process.env 加载配置（用于本地 stdio 模式）
 */
export function loadConfigFromEnv(): AppConfig {
  const accountsJson = process.env.EMAIL_ACCOUNTS

  if (!accountsJson) {
    throw new Error(
      'EMAIL_ACCOUNTS environment variable is required. See .env.example for format.'
    )
  }

  const accounts = parseAccountsJson(accountsJson)

  return { ACCOUNTS: accounts }
}

/**
 * 从 Cloudflare env 加载配置（用于 Worker 模式）
 */
export function loadConfigFromCfEnv(env: Record<string, unknown>): AppConfig {
  const accountsJson = env.EMAIL_ACCOUNTS

  if (typeof accountsJson !== 'string') {
    throw new Error('EMAIL_ACCOUNTS binding is required in wrangler.jsonc')
  }

  const accounts = parseAccountsJson(accountsJson)

  return { ACCOUNTS: accounts }
}
