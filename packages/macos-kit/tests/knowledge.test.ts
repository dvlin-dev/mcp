import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { Logger } from '../src/core/logger.js'
import { loadKnowledgeFromPath } from '../src/core/knowledge/loader.js'
import { KnowledgeManager } from '../src/core/knowledge/manager.js'
import { searchTemplates } from '../src/core/knowledge/search.js'

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

async function writeTemplate(options: {
  root: string
  category: string
  fileName: string
  id: string
  title: string
  script: string
  language?: 'applescript' | 'javascript'
}) {
  const categoryDir = path.join(options.root, options.category)
  await fs.mkdir(categoryDir, { recursive: true })
  const content = `---\nid: ${options.id}\ntitle: ${options.title}\nkeywords: [k1, k2]\n---\n\n\`\`\`${options.language ?? 'applescript'}\n${options.script}\n\`\`\`\n`
  await fs.writeFile(path.join(categoryDir, options.fileName), content, 'utf8')
}

test('loadKnowledgeFromPath 能加载分类、模板与 shared handlers', async () => {
  const root = await makeTempDir('macos-kit-kb-')
  const logger = new Logger('error', 'knowledge-test')

  try {
    await fs.mkdir(path.join(root, '_shared_handlers'), { recursive: true })
    await fs.writeFile(
      path.join(root, '_shared_handlers', 'helper.applescript'),
      'on hello()\nreturn "ok"\nend hello',
      'utf8'
    )
    await fs.mkdir(path.join(root, 'system'), { recursive: true })
    await fs.writeFile(
      path.join(root, 'system', '_category_info.md'),
      '---\ndescription: system desc\n---\n',
      'utf8'
    )
    await writeTemplate({
      root,
      category: 'system',
      fileName: 'front-app.md',
      id: 'system_front',
      title: 'Front App',
      script: 'return "Finder"',
    })

    const loaded = await loadKnowledgeFromPath({
      rootPath: root,
      isLocal: false,
      logger,
    })

    assert.equal(loaded.categories.length, 1)
    assert.equal(loaded.categories[0].id, 'system')
    assert.equal(loaded.categories[0].description, 'system desc')
    assert.equal(loaded.templates.length, 1)
    assert.equal(loaded.templates[0].id, 'system_front')
    assert.equal(loaded.sharedHandlers.length, 1)
    assert.equal(loaded.sharedHandlers[0].name, 'helper')
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('loadKnowledgeFromPath 遇到单个模板解析失败时不会中断整体加载', async () => {
  const root = await makeTempDir('macos-kit-kb-')
  const logger = new Logger('error', 'knowledge-test')

  try {
    await fs.mkdir(path.join(root, 'system'), { recursive: true })
    await writeTemplate({
      root,
      category: 'system',
      fileName: 'valid.md',
      id: 'system_valid',
      title: 'valid',
      script: 'return "ok"',
    })
    await fs.writeFile(
      path.join(root, 'system', 'broken.md'),
      '---\nid: [broken\n---\n\n```applescript\nreturn "bad"\n```',
      'utf8'
    )

    const loaded = await loadKnowledgeFromPath({
      rootPath: root,
      isLocal: false,
      logger,
    })

    assert.equal(loaded.templates.length, 1)
    assert.equal(loaded.templates[0].id, 'system_valid')
    assert.equal(loaded.categories.length, 1)
    assert.equal(loaded.categories[0].count, 1)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('KnowledgeManager 支持本地覆盖与搜索', async () => {
  const embeddedRoot = await makeTempDir('macos-kit-embedded-')
  const localRoot = await makeTempDir('macos-kit-local-')
  const logger = new Logger('error', 'knowledge-manager-test')

  try {
    await writeTemplate({
      root: embeddedRoot,
      category: 'system',
      fileName: 'battery.md',
      id: 'system_battery',
      title: 'Battery Embedded',
      script: 'return "embedded"',
    })
    await writeTemplate({
      root: embeddedRoot,
      category: 'notes',
      fileName: 'search.md',
      id: 'notes_search',
      title: 'Search Notes',
      script: 'return "notes"',
    })

    await writeTemplate({
      root: localRoot,
      category: 'system',
      fileName: 'battery.md',
      id: 'system_battery',
      title: 'Battery Local',
      script: 'return "local"',
    })

    const manager = new KnowledgeManager({
      logger,
      embeddedRoot,
      localOverrideRoot: localRoot,
    })

    const loaded = await manager.load()
    assert.equal(loaded.templates.length, 2)

    const battery = await manager.getTemplateById('system_battery')
    assert.ok(battery)
    assert.equal(battery?.title, 'Battery Local')
    assert.equal(battery?.isLocal, true)

    const searched = await manager.search({ query: 'battery', limit: 5 })
    assert.equal(searched.length, 1)
    assert.equal(searched[0].id, 'system_battery')
  } finally {
    await fs.rm(embeddedRoot, { recursive: true, force: true })
    await fs.rm(localRoot, { recursive: true, force: true })
  }
})

test('searchTemplates 支持分类过滤与 limit', () => {
  const templates = [
    {
      id: 'system_a',
      title: 'System A',
      description: 'desc',
      category: 'system',
      language: 'applescript' as const,
      script: 'return "a"',
      keywords: ['system'],
      sourcePath: '/tmp/a',
    },
    {
      id: 'notes_b',
      title: 'Notes B',
      description: 'desc',
      category: 'notes',
      language: 'applescript' as const,
      script: 'return "b"',
      keywords: ['notes'],
      sourcePath: '/tmp/b',
    },
  ]

  const byCategory = searchTemplates({
    templates,
    category: 'notes',
    limit: 10,
  })
  assert.equal(byCategory.length, 1)
  assert.equal(byCategory[0].id, 'notes_b')

  const byQuery = searchTemplates({
    templates,
    query: 'system',
    limit: 1,
  })
  assert.equal(byQuery.length, 1)
  assert.equal(byQuery[0].id, 'system_a')
})

test('mail_get_email 模板会消费 account 参数并按账户筛选', async () => {
  const templatePath = path.join(
    process.cwd(),
    'knowledge-base',
    'mail',
    'mail_get_email.md'
  )
  const content = await fs.readFile(templatePath, 'utf8')
  assert.match(content, /set accountName to --MCP_INPUT:account/)
  assert.match(content, /exists account accountName/)
  assert.match(content, /mailbox mailboxName of targetAccount/)
})

test('messages_search_messages 模板会转义 SQL LIKE 输入并支持 chat_id 过滤', async () => {
  const templatePath = path.join(
    process.cwd(),
    'knowledge-base',
    'messages',
    'messages_search_messages.md'
  )
  const content = await fs.readFile(templatePath, 'utf8')
  assert.match(content, /on escapeSqlLikeValue\(inputText\)/)
  assert.match(content, /replaceText\(\"'\", \"''\", inputText\)/)
  assert.match(content, /set escapedChatFilter to my escapeSqlLikeValue\(chatFilter\)/)
  assert.match(content, /chat\.chat_identifier/)
})

test('finder search_files 模板会将 ~ 解析为主目录路径', async () => {
  const templatePath = path.join(
    process.cwd(),
    'knowledge-base',
    'finder',
    'search_files.md'
  )
  const content = await fs.readFile(templatePath, 'utf8')
  assert.match(content, /if locationPath is "~" then/)
  assert.ok(content.includes('locationPath starts with "~/" then'))
  assert.match(content, /POSIX path of \(path to home folder\)/)
})

test('messages_compose_message 在非自动发送分支会预填正文', async () => {
  const templatePath = path.join(
    process.cwd(),
    'knowledge-base',
    'messages',
    'messages_compose_message.md'
  )
  const content = await fs.readFile(templatePath, 'utf8')
  assert.match(content, /if messageBody is not "" then/)
  assert.match(content, /stringByAddingPercentEncodingWithAllowedCharacters/)
  assert.match(content, /smsURL & "&body=" & encodedBody/)
  assert.match(content, /Messages opened with draft/)
})
