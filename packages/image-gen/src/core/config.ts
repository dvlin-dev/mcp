import 'dotenv/config'
import { z } from 'zod'

/**
 * 配置 Schema 定义
 */
export const AppConfigSchema = z.object({
  // OpenRouter API Key（必须）
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),

  // 默认使用的模型
  DEFAULT_MODEL: z
    .string()
    .optional()
    .default('google/gemini-2.0-flash-exp:free'),
})

export type AppConfig = z.infer<typeof AppConfigSchema>

/**
 * 从 process.env 加载配置（用于本地 stdio 模式）
 */
export function loadConfigFromEnv(): AppConfig {
  const result = AppConfigSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.format()
    console.error('Configuration error:', JSON.stringify(errors, null, 2))
    throw new Error('Invalid configuration. Check your environment variables.')
  }

  return result.data
}

/**
 * 从 Cloudflare env 加载配置（用于 Worker 模式）
 */
export function loadConfigFromCfEnv(env: Record<string, unknown>): AppConfig {
  const result = AppConfigSchema.safeParse(env)

  if (!result.success) {
    const errors = result.error.format()
    console.error('Configuration error:', JSON.stringify(errors, null, 2))
    throw new Error('Invalid configuration. Check your Cloudflare bindings.')
  }

  return result.data
}
