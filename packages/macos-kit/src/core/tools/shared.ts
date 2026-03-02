import { randomUUID } from 'node:crypto'
import type { ContractResponse } from '../contracts.js'
import { buildFailure, buildSuccess } from '../contracts.js'
import type { ToolRuntimeContext } from '../server.js'
import { ExecutorError, type ScriptLanguage } from '../executor/osascript-executor.js'
import { substitutePlaceholders } from '../executor/placeholder-substitutor.js'
import { validateRawExecutionSafety } from '../executor/safety-policy.js'
import { resolveAxBinaryPath } from '../executor/ax-binary.js'

function isPermissionError(message?: string): boolean {
  if (!message) {
    return false
  }
  return /not authorized|errAEEventNotPermitted|errAEAccessDenied|-1743|-10004|assistive devices/i.test(
    message
  )
}

function mapExecutorErrorToResponse(error: unknown): ContractResponse<null> {
  const traceId = randomUUID()

  if (error instanceof ExecutorError) {
    if (error.name === 'UnsupportedPlatformError') {
      return buildFailure('UNSUPPORTED_PLATFORM', error.message, {
        retryable: false,
        trace_id: traceId,
        hint: '请在 macOS 环境执行 macos-kit-mcp',
        execution_time_seconds: error.executionTimeSeconds,
      })
    }

    if (error.name === 'ScriptFileAccessError') {
      return buildFailure('INVALID_INPUT', error.message, {
        retryable: false,
        trace_id: traceId,
        execution_time_seconds: error.executionTimeSeconds,
      })
    }

    if (error.isTimeout) {
      return buildFailure('EXECUTION_TIMEOUT', '脚本执行超时', {
        retryable: true,
        trace_id: traceId,
        execution_time_seconds: error.executionTimeSeconds,
      })
    }

    const stderr = error.stderr || error.message
    if (isPermissionError(stderr)) {
      return buildFailure('PERMISSION_DENIED', 'macOS 自动化权限不足', {
        retryable: false,
        trace_id: traceId,
        hint: '请检查 系统设置 > 隐私与安全性 > 自动化/辅助功能 权限',
        execution_time_seconds: error.executionTimeSeconds,
      })
    }

    return buildFailure('EXECUTION_FAILED', stderr || '脚本执行失败', {
      retryable: true,
      trace_id: traceId,
      execution_time_seconds: error.executionTimeSeconds,
    })
  }

  if (error instanceof Error) {
    return buildFailure('INTERNAL_ERROR', error.message, {
      retryable: false,
      trace_id: traceId,
    })
  }

  return buildFailure('INTERNAL_ERROR', '未知错误', {
    retryable: false,
    trace_id: traceId,
  })
}

function normalizeTimeoutSeconds(
  context: ToolRuntimeContext,
  timeoutSeconds?: number
): number {
  const candidate = timeoutSeconds ?? context.config.MACOS_KIT_DEFAULT_TIMEOUT_SECONDS
  return Math.min(candidate, context.config.MACOS_KIT_MAX_TIMEOUT_SECONDS)
}

function mergeSharedHandlers(options: {
  templateScript: string
  sharedHandlers: Array<{ content: string }>
}): string {
  const sections = options.sharedHandlers
    .map((handler) => handler.content.trim())
    .filter(Boolean)
  sections.push(options.templateScript)
  return sections.join('\n\n')
}

export async function executeTemplate(options: {
  context: ToolRuntimeContext
  templateId: string
  inputData?: Record<string, unknown>
  args?: string[]
  timeoutSeconds?: number
}): Promise<ContractResponse> {
  const { context, templateId, inputData, args, timeoutSeconds } = options
  const template = await context.knowledge.getTemplateById(templateId)

  if (!template) {
    return buildFailure('NOT_FOUND', `模板不存在: ${templateId}`, {
      retryable: false,
    })
  }

  const sharedHandlers = await context.knowledge.getSharedHandlers(template.language)
  const mergedScript = mergeSharedHandlers({
    templateScript: template.script,
    sharedHandlers,
  })

  const scriptContent = substitutePlaceholders({
    scriptContent: mergedScript,
    language: template.language,
    inputData,
    args,
  })

  const executionTimeout = normalizeTimeoutSeconds(context, timeoutSeconds)
  const traceId = randomUUID()

  try {
    const result = await context.queue.run(() =>
      context.executor.execute({
        scriptContent,
        language: template.language,
        timeoutSeconds: executionTimeout,
      })
    )

    return buildSuccess(
      {
        template_id: template.id,
        category: template.category,
        stdout: result.stdout,
        stderr: result.stderr,
      },
      {
        trace_id: traceId,
        execution_time_seconds: result.executionTimeSeconds,
      }
    )
  } catch (error) {
    context.logger.error('模板执行失败', {
      templateId,
      error: error instanceof Error ? error.message : String(error),
    })
    return mapExecutorErrorToResponse(error)
  }
}

export async function executeRawScript(options: {
  context: ToolRuntimeContext
  scriptContent?: string
  scriptPath?: string
  language: ScriptLanguage
  args?: string[]
  timeoutSeconds?: number
}): Promise<ContractResponse> {
  const {
    context,
    scriptContent,
    scriptPath,
    language,
    args,
    timeoutSeconds,
  } = options

  const safetyResult = await validateRawExecutionSafety({
    config: context.config,
    scriptContent,
    scriptPath,
  })
  if (safetyResult) {
    return safetyResult
  }

  const traceId = randomUUID()
  const executionTimeout = normalizeTimeoutSeconds(context, timeoutSeconds)

  try {
    const result = await context.queue.run(() =>
      context.executor.execute({
        scriptContent,
        scriptPath,
        language,
        timeoutSeconds: executionTimeout,
        args,
      })
    )

    return buildSuccess(
      {
        mode: scriptContent ? 'content' : 'path',
        language,
        stdout: result.stdout,
        stderr: result.stderr,
      },
      {
        trace_id: traceId,
        execution_time_seconds: result.executionTimeSeconds,
      }
    )
  } catch (error) {
    context.logger.error('原始脚本执行失败', {
      language,
      hasContent: Boolean(scriptContent),
      scriptPath,
      error: error instanceof Error ? error.message : String(error),
    })
    return mapExecutorErrorToResponse(error)
  }
}

export async function executeAxQuery(options: {
  context: ToolRuntimeContext
  payload: Record<string, unknown>
  timeoutSeconds?: number
}): Promise<ContractResponse> {
  const { context, payload, timeoutSeconds } = options

  if (!context.config.MACOS_KIT_ENABLE_AX_QUERY) {
    return buildFailure('FEATURE_DISABLED', 'accessibility_query 未开启', {
      hint: '设置 MACOS_KIT_ENABLE_AX_QUERY=true 后重试',
      retryable: false,
    })
  }

  if (process.platform !== 'darwin') {
    return buildFailure('UNSUPPORTED_PLATFORM', 'accessibility_query 仅支持 macOS', {
      retryable: false,
    })
  }

  const timeout = normalizeTimeoutSeconds(context, timeoutSeconds)
  const traceId = randomUUID()
  const start = Date.now()

  try {
    const axBinaryPath = await resolveAxBinaryPath({
      config: context.config,
      logger: context.logger,
    })
    if (!axBinaryPath) {
      return buildFailure('DEPENDENCY_MISSING', '未找到 AX 可执行文件', {
        hint:
          '请安装 ax，或配置 MACOS_KIT_AX_DOWNLOAD_URL 并保持 MACOS_KIT_AX_AUTO_INSTALL=true',
        retryable: false,
      })
    }

    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execFileAsync = promisify(execFile)

    const { stdout, stderr } = await execFileAsync(axBinaryPath, [JSON.stringify(payload)], {
      timeout: timeout * 1000,
    })

    return buildSuccess(
      {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      },
      {
        trace_id: traceId,
        execution_time_seconds: Number(((Date.now() - start) / 1000).toFixed(3)),
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/ENOENT/.test(message)) {
      return buildFailure('DEPENDENCY_MISSING', '未找到 AX 可执行文件', {
        hint:
          '请安装 ax，或配置 MACOS_KIT_AX_DOWNLOAD_URL 并保持 MACOS_KIT_AX_AUTO_INSTALL=true',
        retryable: false,
      })
    }

    return buildFailure('EXECUTION_FAILED', message, {
      retryable: true,
      execution_time_seconds: Number(((Date.now() - start) / 1000).toFixed(3)),
    })
  }
}
