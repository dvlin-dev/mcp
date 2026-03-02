import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import matter from 'gray-matter'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const EXPECTED_TOOLS = [
  'list_macos_automation_categories',
  'search_macos_automation_tips',
  'run_macos_template',
  'run_macos_script',
  'check_macos_permissions',
  'accessibility_query',
  'get_frontmost_app',
  'launch_app',
  'quit_app',
  'set_system_volume',
  'toggle_dark_mode',
  'get_battery_status',
  'get_clipboard',
  'set_clipboard',
  'clear_clipboard',
  'get_selected_files',
  'search_files',
  'quick_look_file',
  'send_notification',
  'toggle_do_not_disturb',
  'run_shortcut',
  'list_shortcuts',
  'calendar_add_event',
  'calendar_list_today',
  'iterm_run',
  'iterm_paste_clipboard',
  'create_pages_document',
  'notes_create',
  'notes_create_raw_html',
  'notes_list',
  'notes_get',
  'notes_search',
  'mail_create_email',
  'mail_list_emails',
  'mail_get_email',
  'messages_list_chats',
  'messages_get_messages',
  'messages_search_messages',
  'messages_compose_message',
]

test('工具清单完整性：listTools 返回预期 39 个工具', async () => {
  const packageRoot = process.cwd()
  const tsxPath = path.join(packageRoot, 'node_modules/.bin/tsx')
  const serverPath = path.join(packageRoot, 'src/transports/stdio.ts')
  const transport = new StdioClientTransport({
    command: tsxPath,
    args: [serverPath],
    cwd: packageRoot,
    stderr: 'pipe',
    env: {
      ...process.env,
      MACOS_KIT_ENABLE_RAW_SCRIPT: 'false',
      MACOS_KIT_ENABLE_AX_QUERY: 'false',
    },
  })
  const client = new Client({ name: 'macos-kit-tool-manifest', version: '0.0.0' })
  await client.connect(transport)
  try {
    const listed = await client.listTools()
    const names = listed.tools.map((tool) => tool.name).sort()
    assert.equal(names.length, EXPECTED_TOOLS.length)
    assert.deepEqual(names, [...EXPECTED_TOOLS].sort())
  } finally {
    await client.close()
  }
})

test('模板映射完整性：工具里的 templateId 均存在于 knowledge-base', async () => {
  const kbRoot = path.join(process.cwd(), 'knowledge-base')
  const templateIds = new Set<string>()

  for (const category of await fs.readdir(kbRoot)) {
    const categoryPath = path.join(kbRoot, category)
    const stat = await fs.stat(categoryPath)
    if (!stat.isDirectory() || category === '_shared_handlers') {
      continue
    }
    for (const file of await fs.readdir(categoryPath)) {
      if (!file.endsWith('.md') || file.startsWith('_')) {
        continue
      }
      const content = await fs.readFile(path.join(categoryPath, file), 'utf8')
      const parsed = matter(content)
      if (typeof parsed.data.id === 'string' && parsed.data.id.length > 0) {
        templateIds.add(parsed.data.id)
      }
    }
  }

  const toolFiles = [
    'src/core/tools/system.ts',
    'src/core/tools/clipboard.ts',
    'src/core/tools/finder.ts',
    'src/core/tools/notifications.ts',
    'src/core/tools/shortcuts.ts',
    'src/core/tools/calendar.ts',
    'src/core/tools/iterm.ts',
    'src/core/tools/pages.ts',
    'src/core/tools/notes.ts',
    'src/core/tools/mail.ts',
    'src/core/tools/messages.ts',
  ]

  const missing: string[] = []
  for (const file of toolFiles) {
    const source = await fs.readFile(path.join(process.cwd(), file), 'utf8')
    for (const match of source.matchAll(/templateId:\s*'([^']+)'/g)) {
      if (!templateIds.has(match[1])) {
        missing.push(match[1])
      }
    }
  }

  assert.deepEqual(missing, [])
})
