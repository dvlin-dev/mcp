import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { buildSuccess, toToolResult } from '../contracts.js'

const execFileAsync = promisify(execFile)
const CHECK_TIMEOUT_MS = 5000

export function registerPermissionTools(server: McpServer) {
  server.registerTool(
    'check_macos_permissions',
    {
      title: 'Check macOS Permissions',
      description: '检查当前环境是否具备 macOS 自动化执行前置条件',
      inputSchema: {},
    },
    async () => {
      const checks: Array<{ name: string; ok: boolean; details: string }> = []

      if (process.platform !== 'darwin') {
        checks.push({
          name: 'platform',
          ok: false,
          details: '当前不是 macOS，AppleScript/JXA 不可用',
        })
      } else {
        checks.push({
          name: 'platform',
          ok: true,
          details: 'macOS 平台校验通过',
        })
      }

      try {
        await execFileAsync('osascript', ['-e', 'return "ok"'], {
          timeout: CHECK_TIMEOUT_MS,
        })
        checks.push({
          name: 'osascript',
          ok: true,
          details: 'osascript 可用',
        })
      } catch (error) {
        checks.push({
          name: 'osascript',
          ok: false,
          details: error instanceof Error ? error.message : String(error),
        })
      }

      try {
        await execFileAsync('osascript', [
          '-e',
          'tell application "System Events" to get name of first process whose frontmost is true',
        ], {
          timeout: CHECK_TIMEOUT_MS,
        })
        checks.push({
          name: 'automation_probe',
          ok: true,
          details: 'System Events 自动化访问正常',
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        checks.push({
          name: 'automation_probe',
          ok: false,
          details: `${message}。请检查 系统设置 > 隐私与安全性 > 自动化/辅助功能`,
        })
      }

      const allPass = checks.every((item) => item.ok)
      const response = buildSuccess({
        all_pass: allPass,
        checks,
      })
      return toToolResult(response)
    }
  )
}
