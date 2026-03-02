import { execFile, type ExecFileException } from 'node:child_process'
import fs from 'node:fs/promises'
import { promisify } from 'node:util'
import type { Logger } from '../logger.js'

const execFileAsync = promisify(execFile)

export type ScriptLanguage = 'applescript' | 'javascript'

export interface ExecuteScriptParams {
  scriptContent?: string
  scriptPath?: string
  language: ScriptLanguage
  timeoutSeconds: number
  args?: string[]
  outputFormat?: 'auto' | 'human_readable' | 'structured_error' | 'structured_output_and_error' | 'direct'
}

export interface ExecuteScriptResult {
  stdout: string
  stderr: string
  executionTimeSeconds: number
}

export class ExecutorError extends Error {
  stdout?: string
  stderr?: string
  exitCode?: number | string | null
  signal?: string | null
  isTimeout?: boolean
  executionTimeSeconds = 0
}

function applyOutputFormat(
  args: string[],
  language: ScriptLanguage,
  mode: ExecuteScriptParams['outputFormat']
) {
  const resolved = mode === 'auto' || !mode
    ? language === 'javascript'
      ? 'direct'
      : 'human_readable'
    : mode

  switch (resolved) {
    case 'human_readable':
      args.push('-s', 'h')
      break
    case 'structured_error':
      args.push('-s', 's')
      break
    case 'structured_output_and_error':
      args.push('-s', 's', '-s', 's')
      break
    case 'direct':
      break
  }
}

export class OsaScriptExecutor {
  constructor(private readonly logger: Logger) {}

  async execute(params: ExecuteScriptParams): Promise<ExecuteScriptResult> {
    if (process.platform !== 'darwin') {
      const error = new ExecutorError('AppleScript/JXA 仅支持在 macOS 执行')
      error.name = 'UnsupportedPlatformError'
      throw error
    }

    if (!params.scriptContent && !params.scriptPath) {
      const error = new ExecutorError('缺少脚本内容或脚本路径')
      error.name = 'InvalidScriptSourceError'
      throw error
    }

    if (params.scriptContent && params.scriptPath) {
      const error = new ExecutorError('scriptContent 与 scriptPath 不能同时传入')
      error.name = 'InvalidScriptSourceError'
      throw error
    }

    const commandArgs: string[] = []
    if (params.language === 'javascript') {
      commandArgs.push('-l', 'JavaScript')
    }

    applyOutputFormat(commandArgs, params.language, params.outputFormat ?? 'auto')

    if (params.scriptContent) {
      commandArgs.push('-e', params.scriptContent)
    }

    if (params.scriptPath) {
      try {
        await fs.access(params.scriptPath, fs.constants.R_OK)
      } catch {
        const error = new ExecutorError(`脚本文件不可读: ${params.scriptPath}`)
        error.name = 'ScriptFileAccessError'
        throw error
      }
      commandArgs.push(params.scriptPath)
      if (params.args?.length) {
        commandArgs.push(...params.args)
      }
    }

    this.logger.debug('执行 osascript', {
      language: params.language,
      timeoutSeconds: params.timeoutSeconds,
      hasContent: Boolean(params.scriptContent),
      scriptPath: params.scriptPath,
      argsCount: params.args?.length ?? 0,
    })

    const start = Date.now()
    try {
      const { stdout, stderr } = await execFileAsync('osascript', commandArgs, {
        timeout: params.timeoutSeconds * 1000,
        windowsHide: true,
      })
      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        executionTimeSeconds: Number(((Date.now() - start) / 1000).toFixed(3)),
      }
    } catch (error) {
      const nodeError = error as ExecFileException
      const wrapped = new ExecutorError(nodeError.message)
      wrapped.name = nodeError.name
      wrapped.stdout = nodeError.stdout?.toString().trim()
      wrapped.stderr = nodeError.stderr?.toString().trim()
      wrapped.exitCode = nodeError.code
      wrapped.signal = nodeError.signal
      wrapped.isTimeout = Boolean(nodeError.killed)
      wrapped.executionTimeSeconds = Number(((Date.now() - start) / 1000).toFixed(3))
      throw wrapped
    }
  }
}
