import { ImapFlow, type FetchMessageObject } from 'imapflow'
import { simpleParser, type ParsedMail, type Attachment } from 'mailparser'
import type { ResolvedAccount } from './config.js'

/**
 * 邮件摘要信息
 */
export interface EmailSummary {
  /** 邮件 UID */
  uid: number
  /** 发件人 */
  from: string
  /** 收件人 */
  to: string
  /** 主题 */
  subject: string
  /** 日期 */
  date: string
  /** 是否已读 */
  seen: boolean
  /** 是否标星 */
  flagged: boolean
  /** 是否有附件 */
  hasAttachments: boolean
  /** 正文预览（前 200 字符） */
  preview: string
}

/**
 * 邮件详情
 */
export interface EmailDetail extends EmailSummary {
  /** 抄送 */
  cc: string
  /** 密送 */
  bcc: string
  /** Message-ID */
  messageId: string
  /** 纯文本正文 */
  textBody: string
  /** HTML 正文 */
  htmlBody: string
  /** 附件列表 */
  attachments: AttachmentInfo[]
}

/**
 * 附件信息
 */
export interface AttachmentInfo {
  /** 文件名 */
  filename: string
  /** MIME 类型 */
  contentType: string
  /** 文件大小（字节） */
  size: number
  /** Base64 编码内容（仅在请求时返回） */
  content?: string
}

/**
 * 文件夹信息
 */
export interface FolderInfo {
  /** 文件夹路径 */
  path: string
  /** 显示名称 */
  name: string
  /** 邮件总数 */
  total: number
  /** 未读数 */
  unseen: number
}

/**
 * 搜索条件
 */
export interface SearchCriteria {
  /** 搜索关键词 */
  query?: string
  /** 搜索范围 */
  searchIn?: 'all' | 'subject' | 'from' | 'to' | 'body'
  /** 起始日期 */
  dateFrom?: string
  /** 结束日期 */
  dateTo?: string
  /** 仅未读 */
  unreadOnly?: boolean
  /** 仅标星 */
  flaggedOnly?: boolean
}

/**
 * IMAP 客户端封装
 */
export class ImapClient {
  private account: ResolvedAccount

  constructor(account: ResolvedAccount) {
    this.account = account
  }

  /**
   * 创建 IMAP 连接
   */
  private createClient(): ImapFlow {
    const clientOptions: ConstructorParameters<typeof ImapFlow>[0] = {
      host: this.account.imap_server,
      port: this.account.imap_port,
      secure: true,
      auth: {
        user: this.account.email,
        pass: this.account.password,
      },
      logger: false,
      // 连接超时配置
      connectionTimeout: 30000, // 30 秒连接超时
      greetingTimeout: 15000, // 15 秒等待服务器问候
      socketTimeout: 60000, // 60 秒 socket 超时
    }

    // 163 邮箱需要发送 IMAP ID 命令
    if (this.account.requiresImapId) {
      clientOptions.clientInfo = {
        name: 'Mozilla Thunderbird',
        version: '91.0',
        vendor: 'Mozilla',
        'support-url': 'https://support.mozilla.org/',
      }
    }

    return new ImapFlow(clientOptions)
  }

  /**
   * 执行 IMAP 操作（自动管理连接）
   */
  private async withConnection<T>(
    operation: (client: ImapFlow) => Promise<T>
  ): Promise<T> {
    const client = this.createClient()
    try {
      await client.connect()
      return await operation(client)
    } finally {
      await client.logout().catch(() => {})
    }
  }

  /**
   * 列出所有文件夹
   */
  async listFolders(): Promise<FolderInfo[]> {
    return this.withConnection(async (client) => {
      const folders: FolderInfo[] = []
      const mailboxes = await client.list()

      for (const mailbox of mailboxes) {
        // 跳过不可选择的文件夹
        if (mailbox.flags.has('\\Noselect')) continue

        let total = 0
        let unseen = 0

        try {
          const status = await client.status(mailbox.path, {
            messages: true,
            unseen: true,
          })
          total = status.messages ?? 0
          unseen = status.unseen ?? 0
        } catch {
          // 某些文件夹可能无法获取状态
        }

        folders.push({
          path: mailbox.path,
          name: mailbox.name,
          total,
          unseen,
        })
      }

      return folders
    })
  }

  /**
   * 列出邮件
   */
  async listEmails(options: {
    folder?: string
    limit?: number
    unreadOnly?: boolean
  }): Promise<EmailSummary[]> {
    const { folder = 'INBOX', limit = 20, unreadOnly = false } = options

    return this.withConnection(async (client) => {
      const lock = await client.getMailboxLock(folder)
      try {
        const emails: EmailSummary[] = []

        // 构建搜索条件
        const searchCriteria: Record<string, boolean> = { all: true }
        if (unreadOnly) {
          delete searchCriteria.all
          searchCriteria.unseen = true
        }

        // 搜索邮件 UID
        const searchResult = await client.search(searchCriteria, { uid: true })
        // search 返回 false 或 number[]
        if (!searchResult || searchResult.length === 0) return []

        // 按 UID 降序排列，取最新的
        const sortedUids = [...searchResult].sort((a: number, b: number) => b - a).slice(0, limit)

        // 获取邮件信息
        for await (const msg of client.fetch(sortedUids, {
          uid: true,
          envelope: true,
          flags: true,
          bodyStructure: true,
          source: { start: 0, maxLength: 1000 }, // 获取部分源码用于预览
        })) {
          const email = this.parseEmailSummary(msg)
          emails.push(email)
        }

        return emails
      } finally {
        lock.release()
      }
    })
  }

  /**
   * 获取邮件详情
   */
  async getEmailDetail(options: {
    uid: number
    folder?: string
    includeAttachmentContent?: boolean
  }): Promise<EmailDetail | null> {
    const {
      uid,
      folder = 'INBOX',
      includeAttachmentContent = false,
    } = options

    return this.withConnection(async (client) => {
      const lock = await client.getMailboxLock(folder)
      try {
        // 获取完整邮件源码
        const message = await client.fetchOne(uid.toString(), {
          uid: true,
          envelope: true,
          flags: true,
          bodyStructure: true,
          source: true,
        })

        if (!message || !message.source) return null

        // 解析邮件
        const parsed = await simpleParser(message.source)
        return this.parseEmailDetail(message, parsed, includeAttachmentContent)
      } finally {
        lock.release()
      }
    })
  }

  /**
   * 搜索邮件
   */
  async searchEmails(
    criteria: SearchCriteria,
    options: { folder?: string; limit?: number }
  ): Promise<EmailSummary[]> {
    const { folder = 'INBOX', limit = 50 } = options

    return this.withConnection(async (client) => {
      const lock = await client.getMailboxLock(folder)
      try {
        // 构建搜索查询
        const searchQuery = this.buildSearchQuery(criteria)

        // 搜索邮件
        const searchResult = await client.search(searchQuery, { uid: true })
        // search 返回 false 或 number[]
        if (!searchResult || searchResult.length === 0) return []

        // 按 UID 降序，取最新的
        const sortedUids = [...searchResult].sort((a: number, b: number) => b - a).slice(0, limit)

        const emails: EmailSummary[] = []
        for await (const msg of client.fetch(sortedUids, {
          uid: true,
          envelope: true,
          flags: true,
          bodyStructure: true,
          source: { start: 0, maxLength: 1000 },
        })) {
          emails.push(this.parseEmailSummary(msg))
        }

        return emails
      } finally {
        lock.release()
      }
    })
  }

  /**
   * 标记邮件已读/未读
   */
  async markEmails(options: {
    uids: number[]
    folder?: string
    markAs: 'read' | 'unread'
  }): Promise<{ success: boolean; count: number }> {
    const { uids, folder = 'INBOX', markAs } = options

    return this.withConnection(async (client) => {
      const lock = await client.getMailboxLock(folder)
      try {
        const flag = '\\Seen'
        if (markAs === 'read') {
          await client.messageFlagsAdd(uids, [flag], { uid: true })
        } else {
          await client.messageFlagsRemove(uids, [flag], { uid: true })
        }
        return { success: true, count: uids.length }
      } finally {
        lock.release()
      }
    })
  }

  /**
   * 标星/取消标星
   */
  async flagEmail(options: {
    uid: number
    folder?: string
    setFlag: boolean
  }): Promise<{ success: boolean }> {
    const { uid, folder = 'INBOX', setFlag } = options

    return this.withConnection(async (client) => {
      const lock = await client.getMailboxLock(folder)
      try {
        const flag = '\\Flagged'
        if (setFlag) {
          await client.messageFlagsAdd([uid], [flag], { uid: true })
        } else {
          await client.messageFlagsRemove([uid], [flag], { uid: true })
        }
        return { success: true }
      } finally {
        lock.release()
      }
    })
  }

  /**
   * 删除邮件
   */
  async deleteEmails(options: {
    uids: number[]
    folder?: string
    permanent?: boolean
  }): Promise<{ success: boolean; count: number }> {
    const { uids, folder = 'INBOX', permanent = false } = options

    return this.withConnection(async (client) => {
      const lock = await client.getMailboxLock(folder)
      try {
        if (permanent) {
          // 永久删除：添加 \Deleted 标记并清除
          await client.messageFlagsAdd(uids, ['\\Deleted'], { uid: true })
          await client.messageDelete(uids, { uid: true })
        } else {
          // 移动到垃圾箱（使用账户配置的垃圾箱文件夹名称）
          await client.messageMove(uids, this.account.trash_folder, { uid: true })
        }
        return { success: true, count: uids.length }
      } finally {
        lock.release()
      }
    })
  }

  /**
   * 移动邮件到指定文件夹
   */
  async moveEmails(options: {
    uids: number[]
    sourceFolder?: string
    targetFolder: string
  }): Promise<{ success: boolean; count: number }> {
    const { uids, sourceFolder = 'INBOX', targetFolder } = options

    return this.withConnection(async (client) => {
      const lock = await client.getMailboxLock(sourceFolder)
      try {
        await client.messageMove(uids, targetFolder, { uid: true })
        return { success: true, count: uids.length }
      } finally {
        lock.release()
      }
    })
  }

  /**
   * 获取附件内容
   */
  async getAttachments(options: {
    uid: number
    folder?: string
  }): Promise<AttachmentInfo[]> {
    const { uid, folder = 'INBOX' } = options

    return this.withConnection(async (client) => {
      const lock = await client.getMailboxLock(folder)
      try {
        const message = await client.fetchOne(uid.toString(), {
          uid: true,
          source: true,
        })

        if (!message || !message.source) return []

        const parsed = await simpleParser(message.source)
        return this.extractAttachments(parsed.attachments, true)
      } finally {
        lock.release()
      }
    })
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{
    success: boolean
    error?: string
    inbox?: { total: number; unseen: number }
  }> {
    try {
      return await this.withConnection(async (client) => {
        const status = await client.status('INBOX', {
          messages: true,
          unseen: true,
        })
        return {
          success: true,
          inbox: {
            total: status.messages ?? 0,
            unseen: status.unseen ?? 0,
          },
        }
      })
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // ============ 私有辅助方法 ============

  /**
   * 构建搜索查询
   */
  private buildSearchQuery(criteria: SearchCriteria): Record<string, unknown> {
    const query: Record<string, unknown> = {}

    // 关键词搜索
    if (criteria.query) {
      const searchIn = criteria.searchIn ?? 'all'
      switch (searchIn) {
        case 'subject':
          query.subject = criteria.query
          break
        case 'from':
          query.from = criteria.query
          break
        case 'to':
          query.to = criteria.query
          break
        case 'body':
          query.body = criteria.query
          break
        default:
          // 搜索所有字段：使用 OR 组合
          query.or = [
            { subject: criteria.query },
            { from: criteria.query },
            { to: criteria.query },
            { body: criteria.query },
          ]
      }
    }

    // 日期范围
    if (criteria.dateFrom) {
      query.since = new Date(criteria.dateFrom)
    }
    if (criteria.dateTo) {
      query.before = new Date(criteria.dateTo)
    }

    // 状态过滤
    if (criteria.unreadOnly) {
      query.unseen = true
    }
    if (criteria.flaggedOnly) {
      query.flagged = true
    }

    // 如果没有任何条件，返回 all
    if (Object.keys(query).length === 0) {
      query.all = true
    }

    return query
  }

  /**
   * 解析邮件摘要
   */
  private parseEmailSummary(msg: FetchMessageObject): EmailSummary {
    const envelope = msg.envelope
    const flags = msg.flags ?? new Set()

    // 提取预览文本
    let preview = ''
    if (msg.source) {
      const sourceStr = msg.source.toString()
      // 简单提取纯文本部分
      const textMatch = sourceStr.match(/\r\n\r\n([\s\S]*?)(?:\r\n--|\r\n\r\n)/);
      if (textMatch) {
        preview = textMatch[1]
          .replace(/=\r\n/g, '')
          .replace(/=([0-9A-F]{2})/gi, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
          )
          .slice(0, 200)
      }
    }

    return {
      uid: msg.uid,
      from: envelope ? this.formatAddress(envelope.from) : '',
      to: envelope ? this.formatAddress(envelope.to) : '',
      subject: envelope?.subject ?? '(无主题)',
      date: envelope?.date?.toISOString() ?? '',
      seen: flags.has('\\Seen'),
      flagged: flags.has('\\Flagged'),
      hasAttachments: this.hasAttachments(msg.bodyStructure),
      preview: preview.trim(),
    }
  }

  /**
   * 解析邮件详情
   */
  private parseEmailDetail(
    msg: FetchMessageObject,
    parsed: ParsedMail,
    includeAttachmentContent: boolean
  ): EmailDetail {
    const envelope = msg.envelope
    const flags = msg.flags ?? new Set()

    return {
      uid: msg.uid,
      from: envelope ? this.formatAddress(envelope.from) : '',
      to: envelope ? this.formatAddress(envelope.to) : '',
      cc: envelope ? this.formatAddress(envelope.cc) : '',
      bcc: envelope ? this.formatAddress(envelope.bcc) : '',
      subject: envelope?.subject ?? '(无主题)',
      date: envelope?.date?.toISOString() ?? '',
      messageId: envelope?.messageId ?? '',
      seen: flags.has('\\Seen'),
      flagged: flags.has('\\Flagged'),
      hasAttachments: (parsed.attachments?.length ?? 0) > 0,
      preview: (parsed.text ?? '').slice(0, 200),
      textBody: parsed.text ?? '',
      htmlBody: parsed.html || '',
      attachments: this.extractAttachments(
        parsed.attachments,
        includeAttachmentContent
      ),
    }
  }

  /**
   * 格式化地址列表
   */
  private formatAddress(
    addresses: Array<{ name?: string; address?: string }> | undefined
  ): string {
    if (!addresses || addresses.length === 0) return ''
    return addresses
      .map((addr) => {
        if (addr.name && addr.address) {
          return `${addr.name} <${addr.address}>`
        }
        return addr.address ?? addr.name ?? ''
      })
      .filter(Boolean)
      .join(', ')
  }

  /**
   * 检查是否有附件
   */
  private hasAttachments(
    bodyStructure: FetchMessageObject['bodyStructure']
  ): boolean {
    if (!bodyStructure) return false

    const check = (
      part: NonNullable<FetchMessageObject['bodyStructure']>
    ): boolean => {
      if (part.disposition === 'attachment') return true
      if (part.childNodes) {
        return part.childNodes.some(check)
      }
      return false
    }

    return check(bodyStructure)
  }

  /**
   * 提取附件信息
   */
  private extractAttachments(
    attachments: Attachment[] | undefined,
    includeContent: boolean
  ): AttachmentInfo[] {
    if (!attachments) return []

    return attachments.map((att) => {
      const info: AttachmentInfo = {
        filename: att.filename ?? 'attachment',
        contentType: att.contentType ?? 'application/octet-stream',
        size: att.size ?? 0,
      }

      if (includeContent && att.content) {
        info.content = att.content.toString('base64')
      }

      return info
    })
  }
}
