import fs from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AppConfig } from '../config.js'
import type { Logger } from '../logger.js'

const AX_DOWNLOAD_TIMEOUT_MS = 15000

let downloadingPromise: Promise<string | null> | null = null

function isPathLike(value: string): boolean {
  return value.includes('/') || value.startsWith('.') || value.startsWith('~')
}

function expandHome(value: string): string {
  if (value === '~') {
    return os.homedir()
  }
  if (value.startsWith('~/')) {
    return path.join(os.homedir(), value.slice(2))
  }
  return value
}

async function isExecutableFile(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

async function commandExistsInPath(command: string): Promise<boolean> {
  const pathEnv = process.env.PATH
  if (!pathEnv) {
    return false
  }
  const paths = pathEnv.split(path.delimiter).filter(Boolean)
  for (const binDir of paths) {
    const fullPath = path.join(binDir, command)
    if (await isExecutableFile(fullPath)) {
      return true
    }
  }
  return false
}

function buildAxDownloadUrl(template: string): string {
  return template
    .replaceAll('{platform}', process.platform)
    .replaceAll('{arch}', process.arch)
}

function resolveAxCacheDir(config: AppConfig): string {
  if (config.MACOS_KIT_AX_CACHE_DIR) {
    return expandHome(config.MACOS_KIT_AX_CACHE_DIR)
  }
  return path.join(os.homedir(), '.cache', 'moryflow', 'macos-kit', 'bin')
}

async function downloadAxBinary(options: {
  config: AppConfig
  logger: Logger
}): Promise<string | null> {
  const { config, logger } = options
  if (!config.MACOS_KIT_AX_AUTO_INSTALL) {
    return null
  }
  if (!config.MACOS_KIT_AX_DOWNLOAD_URL) {
    return null
  }
  const downloadUrlTemplate = config.MACOS_KIT_AX_DOWNLOAD_URL
  if (process.platform !== 'darwin') {
    return null
  }

  const cacheDir = resolveAxCacheDir(config)
  const targetPath = path.join(cacheDir, `ax-${process.platform}-${process.arch}`)
  if (await isExecutableFile(targetPath)) {
    return targetPath
  }

  if (!downloadingPromise) {
    downloadingPromise = (async () => {
      const downloadUrl = buildAxDownloadUrl(downloadUrlTemplate)
      logger.info('开始自动下载 AX 可执行文件', {
        downloadUrl,
        targetPath,
      })
      await fs.mkdir(cacheDir, { recursive: true })

      const controller = new AbortController()
      const timeoutHandle = setTimeout(() => controller.abort(), AX_DOWNLOAD_TIMEOUT_MS)
      try {
        const response = await fetch(downloadUrl, {
          signal: controller.signal,
          headers: {
            'user-agent': 'moryflow-macos-kit/0.1.0',
          },
        })
        if (!response.ok) {
          throw new Error(`下载失败：${response.status} ${response.statusText}`)
        }
        const buffer = Buffer.from(await response.arrayBuffer())
        const tempPath = `${targetPath}.download`
        await fs.writeFile(tempPath, buffer)
        await fs.chmod(tempPath, 0o755)
        await fs.rename(tempPath, targetPath)
        logger.info('AX 自动下载完成', { targetPath })
        return targetPath
      } catch (error) {
        logger.warn('AX 自动下载失败', {
          error: error instanceof Error ? error.message : String(error),
        })
        return null
      } finally {
        clearTimeout(timeoutHandle)
        downloadingPromise = null
      }
    })()
  }

  return downloadingPromise
}

export async function resolveAxBinaryPath(options: {
  config: AppConfig
  logger: Logger
}): Promise<string | null> {
  const { config, logger } = options
  const configured = config.MACOS_KIT_AX_BINARY_PATH.trim()

  if (configured) {
    if (isPathLike(configured)) {
      const expanded = expandHome(configured)
      if (await isExecutableFile(expanded)) {
        return expanded
      }
    } else if (await commandExistsInPath(configured)) {
      return configured
    }
  }

  return downloadAxBinary({ config, logger })
}

export async function prewarmAxBinary(options: {
  config: AppConfig
  logger: Logger
}): Promise<void> {
  const { config, logger } = options
  if (!config.MACOS_KIT_ENABLE_AX_QUERY) {
    return
  }
  const resolved = await resolveAxBinaryPath({ config, logger })
  if (!resolved) {
    logger.warn('AX 预热未命中可执行文件', {
      configuredPath: config.MACOS_KIT_AX_BINARY_PATH,
      autoInstall: config.MACOS_KIT_AX_AUTO_INSTALL,
      hasDownloadUrl: Boolean(config.MACOS_KIT_AX_DOWNLOAD_URL),
    })
  }
}
