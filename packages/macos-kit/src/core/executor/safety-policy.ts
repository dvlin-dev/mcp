import fs from 'node:fs/promises'
import path from 'node:path'
import type { AppConfig } from '../config.js'
import { buildFailure, type ContractResponse } from '../contracts.js'

const HIGH_RISK_PATTERNS: RegExp[] = [
  /rm\s+-rf\s+\//i,
  /curl\s+[^\n|]*\|\s*(sh|bash)/i,
  /mkfs/i,
  /shutdown\s+-h/i,
  /reboot/i,
]

function isBinaryScript(buffer: Buffer): boolean {
  return buffer.includes(0)
}

function isSubPath(parentPath: string, targetPath: string): boolean {
  const relative = path.relative(parentPath, targetPath)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export async function validateScriptPathInRoots(
  scriptPath: string,
  roots: string[]
): Promise<boolean> {
  if (roots.length === 0) {
    return false
  }

  const resolvedScript = await fs.realpath(scriptPath)
  for (const root of roots) {
    try {
      const resolvedRoot = await fs.realpath(root)
      if (isSubPath(resolvedRoot, resolvedScript)) {
        return true
      }
    } catch {
      continue
    }
  }

  return false
}

export async function validateRawExecutionSafety(options: {
  config: AppConfig
  scriptContent?: string
  scriptPath?: string
}): Promise<ContractResponse<null> | null> {
  const { config, scriptContent, scriptPath } = options
  let contentForRiskScan = scriptContent

  if (!config.MACOS_KIT_ENABLE_RAW_SCRIPT) {
    return buildFailure('FEATURE_DISABLED', 'run_macos_script 未开启', {
      hint: '设置 MACOS_KIT_ENABLE_RAW_SCRIPT=true 后重试',
      retryable: false,
    })
  }

  if (scriptPath) {
    try {
      if (config.MACOS_KIT_ALLOWED_SCRIPT_ROOTS.length > 0) {
        const allowed = await validateScriptPathInRoots(
          scriptPath,
          config.MACOS_KIT_ALLOWED_SCRIPT_ROOTS
        )
        if (!allowed) {
          return buildFailure('SAFETY_BLOCKED', '脚本路径不在白名单目录内', {
            hint: '请配置 MACOS_KIT_ALLOWED_SCRIPT_ROOTS 并确保脚本位于该目录',
            retryable: false,
          })
        }
      }

      if (config.MACOS_KIT_SAFE_MODE !== 'off' && !contentForRiskScan) {
        const scriptBuffer = await fs.readFile(scriptPath)
        if (isBinaryScript(scriptBuffer)) {
          return buildFailure('SAFETY_BLOCKED', '安全模式不允许执行二进制脚本文件', {
            hint: '请改用可读文本脚本，或将 MACOS_KIT_SAFE_MODE 设置为 off',
            retryable: false,
          })
        }
        contentForRiskScan = scriptBuffer.toString('utf8')
      }
    } catch (error) {
      return buildFailure('INVALID_INPUT', '脚本路径不可读或不存在', {
        hint: error instanceof Error ? error.message : '请检查路径是否正确',
        retryable: false,
      })
    }
  }

  if (config.MACOS_KIT_SAFE_MODE !== 'off' && contentForRiskScan) {
    const hitPattern = HIGH_RISK_PATTERNS.find((pattern) =>
      pattern.test(contentForRiskScan)
    )
    if (hitPattern) {
      return buildFailure('SAFETY_BLOCKED', '脚本命中高风险策略阻断', {
        hint: `命中规则: ${hitPattern}`,
        retryable: false,
      })
    }
  }

  return null
}
