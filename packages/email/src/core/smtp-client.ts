import nodemailer, { type Transporter } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import type { ResolvedAccount } from './config.js'

/**
 * 发送邮件选项
 */
export interface SendEmailOptions {
  /** 收件人列表 */
  to: string[]
  /** 主题 */
  subject: string
  /** 正文（纯文本或 HTML） */
  body: string
  /** 是否为 HTML 格式 */
  isHtml?: boolean
  /** 抄送列表 */
  cc?: string[]
  /** 密送列表 */
  bcc?: string[]
  /** 回复地址 */
  replyTo?: string
  /** 附件列表 */
  attachments?: AttachmentInput[]
  /** In-Reply-To 头（用于回复） */
  inReplyTo?: string
  /** References 头（用于回复链） */
  references?: string
}

/**
 * 附件输入
 */
export interface AttachmentInput {
  /** 文件名 */
  filename: string
  /** 内容（Base64 编码） */
  content: string
  /** MIME 类型（可选） */
  contentType?: string
}

/**
 * 发送结果
 */
export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * SMTP 客户端封装
 */
export class SmtpClient {
  private account: ResolvedAccount

  constructor(account: ResolvedAccount) {
    this.account = account
  }

  /**
   * 创建 SMTP 传输器
   */
  private createTransporter(): Transporter<SMTPTransport.SentMessageInfo> {
    const options: SMTPTransport.Options = {
      host: this.account.smtp_server,
      port: this.account.smtp_port,
      secure: this.account.smtp_secure,
      auth: {
        user: this.account.email,
        pass: this.account.password,
      },
    }

    return nodemailer.createTransport(options)
  }

  /**
   * 发送邮件
   */
  async sendEmail(options: SendEmailOptions): Promise<SendResult> {
    const transporter = this.createTransporter()

    try {
      // 构建邮件内容
      const mailOptions: nodemailer.SendMailOptions = {
        from: this.account.email,
        to: options.to.join(', '),
        subject: options.subject,
        replyTo: options.replyTo,
      }

      // 设置正文
      if (options.isHtml) {
        mailOptions.html = options.body
        // 同时提供纯文本版本
        mailOptions.text = this.stripHtml(options.body)
      } else {
        mailOptions.text = options.body
      }

      // 设置抄送和密送
      if (options.cc && options.cc.length > 0) {
        mailOptions.cc = options.cc.join(', ')
      }
      if (options.bcc && options.bcc.length > 0) {
        mailOptions.bcc = options.bcc.join(', ')
      }

      // 设置回复相关头
      if (options.inReplyTo) {
        mailOptions.inReplyTo = options.inReplyTo
      }
      if (options.references) {
        mailOptions.references = options.references
      }

      // 设置附件
      if (options.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments.map((att) => ({
          filename: att.filename,
          content: Buffer.from(att.content, 'base64'),
          contentType: att.contentType,
        }))
      }

      // 发送邮件
      const info = await transporter.sendMail(mailOptions)

      return {
        success: true,
        messageId: info.messageId,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    } finally {
      transporter.close()
    }
  }

  /**
   * 回复邮件
   */
  async replyEmail(options: {
    /** 原邮件信息 */
    original: {
      from: string
      to: string
      cc?: string
      subject: string
      messageId: string
      date: string
      body: string
    }
    /** 回复正文 */
    body: string
    /** 是否回复所有人 */
    replyAll?: boolean
    /** 是否为 HTML */
    isHtml?: boolean
  }): Promise<SendResult> {
    const { original, body, replyAll = false, isHtml = false } = options

    // 确定收件人
    const to = [this.extractEmailAddress(original.from)]
    const cc: string[] = []

    if (replyAll) {
      // 添加原收件人（排除自己）
      const originalTo = original.to.split(',').map((s) => s.trim())
      const originalCc = original.cc?.split(',').map((s) => s.trim()) ?? []

      for (const addr of [...originalTo, ...originalCc]) {
        const email = this.extractEmailAddress(addr)
        if (email && email !== this.account.email && !to.includes(email)) {
          cc.push(email)
        }
      }
    }

    // 构建主题
    let subject = original.subject
    if (!subject.toLowerCase().startsWith('re:')) {
      subject = `Re: ${subject}`
    }

    // 构建引用正文
    const quotedBody = this.formatQuotedReply(original, body, isHtml)

    return this.sendEmail({
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject,
      body: quotedBody,
      isHtml,
      inReplyTo: original.messageId,
      references: original.messageId,
    })
  }

  /**
   * 转发邮件
   */
  async forwardEmail(options: {
    /** 原邮件信息 */
    original: {
      from: string
      to: string
      cc?: string
      subject: string
      date: string
      body: string
    }
    /** 转发给 */
    to: string[]
    /** 附言 */
    comment?: string
    /** 附件（如果需要转发） */
    attachments?: AttachmentInput[]
  }): Promise<SendResult> {
    const { original, to, comment, attachments } = options

    // 构建主题
    let subject = original.subject
    if (!subject.toLowerCase().startsWith('fwd:')) {
      subject = `Fwd: ${subject}`
    }

    // 构建转发正文
    const forwardBody = this.formatForwardedMessage(original, comment)

    return this.sendEmail({
      to,
      subject,
      body: forwardBody,
      isHtml: false,
      attachments,
    })
  }

  /**
   * 测试 SMTP 连接
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    const transporter = this.createTransporter()

    try {
      await transporter.verify()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    } finally {
      transporter.close()
    }
  }

  // ============ 私有辅助方法 ============

  /**
   * 从地址字符串提取邮箱地址
   */
  private extractEmailAddress(address: string): string {
    const match = address.match(/<([^>]+)>/)
    if (match) return match[1]
    // 如果没有尖括号，假设整个字符串就是邮箱
    return address.trim()
  }

  /**
   * 去除 HTML 标签
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim()
  }

  /**
   * 格式化引用回复
   */
  private formatQuotedReply(
    original: { from: string; date: string; body: string },
    replyBody: string,
    isHtml: boolean
  ): string {
    const quotedLines = original.body
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')

    const header = `On ${original.date}, ${original.from} wrote:`

    if (isHtml) {
      return `${replyBody}<br><br><blockquote>${header}<br>${original.body.replace(/\n/g, '<br>')}</blockquote>`
    }

    return `${replyBody}\n\n${header}\n${quotedLines}`
  }

  /**
   * 格式化转发消息
   */
  private formatForwardedMessage(
    original: { from: string; to: string; cc?: string; date: string; subject: string; body: string },
    comment?: string
  ): string {
    const lines = [
      '---------- Forwarded message ----------',
      `From: ${original.from}`,
      `Date: ${original.date}`,
      `Subject: ${original.subject}`,
      `To: ${original.to}`,
    ]

    if (original.cc) {
      lines.push(`Cc: ${original.cc}`)
    }

    lines.push('', original.body)

    if (comment) {
      return `${comment}\n\n${lines.join('\n')}`
    }

    return lines.join('\n')
  }
}
