import 'dotenv/config'
import { z } from 'zod'
import type { LogLevel } from './logger.js'

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return ['1', 'true', 'yes', 'on'].includes(normalized)
  }
  return false
}

const CsvPathsSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (!value) {
      return [] as string[]
    }
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  })

export const AppConfigSchema = z.object({
  MACOS_KIT_ENABLE_RAW_SCRIPT: z
    .any()
    .optional()
    .transform((value) => parseBoolean(value))
    .default(true),
  MACOS_KIT_DEFAULT_TIMEOUT_SECONDS: z.coerce.number().int().min(1).default(30),
  MACOS_KIT_MAX_TIMEOUT_SECONDS: z.coerce.number().int().min(1).default(120),
  MACOS_KIT_ALLOWED_SCRIPT_ROOTS: CsvPathsSchema,
  MACOS_KIT_KB_PATH: z.string().optional(),
  MACOS_KIT_SAFE_MODE: z.enum(['strict', 'balanced', 'off']).default('balanced'),
  MACOS_KIT_LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),
  MACOS_KIT_ENABLE_AX_QUERY: z
    .any()
    .optional()
    .transform((value) => parseBoolean(value))
    .default(true),
  MACOS_KIT_AX_BINARY_PATH: z.string().default('ax'),
})

export type AppConfig = z.infer<typeof AppConfigSchema> & {
  MACOS_KIT_LOG_LEVEL: LogLevel
}

export function loadConfigFromEnv(): AppConfig {
  const parsed = AppConfigSchema.safeParse(process.env)
  if (!parsed.success) {
    const formatted = parsed.error.format()
    console.error('Config validation failed:', JSON.stringify(formatted, null, 2))
    throw new Error('Invalid macos-kit configuration')
  }

  if (
    parsed.data.MACOS_KIT_DEFAULT_TIMEOUT_SECONDS >
    parsed.data.MACOS_KIT_MAX_TIMEOUT_SECONDS
  ) {
    throw new Error(
      'MACOS_KIT_DEFAULT_TIMEOUT_SECONDS 不能大于 MACOS_KIT_MAX_TIMEOUT_SECONDS'
    )
  }

  return parsed.data as AppConfig
}
