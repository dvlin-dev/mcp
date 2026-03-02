export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

export class Logger {
  constructor(
    private readonly level: LogLevel,
    private readonly scope: string
  ) {}

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[this.level]
  }

  private write(level: LogLevel, message: string, data?: unknown) {
    if (!this.shouldLog(level)) {
      return
    }
    const time = new Date().toISOString()
    const payload = data === undefined ? '' : ` ${JSON.stringify(data)}`
    console.error(`[${time}] [${this.scope}] [${level.toUpperCase()}] ${message}${payload}`)
  }

  debug(message: string, data?: unknown) {
    this.write('debug', message, data)
  }

  info(message: string, data?: unknown) {
    this.write('info', message, data)
  }

  warn(message: string, data?: unknown) {
    this.write('warn', message, data)
  }

  error(message: string, data?: unknown) {
    this.write('error', message, data)
  }
}
