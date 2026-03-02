import fs from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import type { Logger } from '../logger.js'
import type {
  KnowledgeTemplate,
  KnowledgeCategory,
  SharedHandler,
  KnowledgeIndex,
} from './types.js'

type Frontmatter = {
  id?: string
  title?: string
  description?: string
  language?: 'applescript' | 'javascript'
  keywords?: string[]
  argumentsPrompt?: string
  notes?: string
}

const CODE_BLOCK_REGEX = /```(applescript|javascript)\s*\n([\s\S]*?)\n```/i

function normalizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parseTemplateFile(content: string): {
  frontmatter: Frontmatter
  script: string
  language: 'applescript' | 'javascript'
} | null {
  const parsed = matter(content)
  const match = parsed.content.match(CODE_BLOCK_REGEX)
  if (!match) {
    return null
  }

  return {
    frontmatter: parsed.data as Frontmatter,
    language: match[1].toLowerCase() as 'applescript' | 'javascript',
    script: match[2].trim(),
  }
}

export async function loadKnowledgeFromPath(options: {
  rootPath: string
  isLocal: boolean
  logger: Logger
}): Promise<KnowledgeIndex> {
  const { rootPath, isLocal, logger } = options
  const templates: KnowledgeTemplate[] = []
  const categories: KnowledgeCategory[] = []
  const sharedHandlers: SharedHandler[] = []

  let rootEntries: Dirent[]
  try {
    rootEntries = await fs.readdir(rootPath, { withFileTypes: true })
  } catch (error) {
    logger.warn('知识库目录读取失败', {
      rootPath,
      isLocal,
      error: error instanceof Error ? error.message : String(error),
    })
    return { templates, categories, sharedHandlers }
  }

  for (const entry of rootEntries) {
    if (!entry.isDirectory()) {
      continue
    }

    if (entry.name === '_shared_handlers') {
      const handlerRoot = path.join(rootPath, entry.name)
      const files = await fs.readdir(handlerRoot, { withFileTypes: true })
      for (const file of files) {
        if (!file.isFile()) {
          continue
        }
        const extension = path.extname(file.name)
        if (!['.applescript', '.js'].includes(extension)) {
          continue
        }

        const filePath = path.join(handlerRoot, file.name)
        const content = await fs.readFile(filePath, 'utf8')
        sharedHandlers.push({
          name: path.basename(file.name, extension),
          language: extension === '.js' ? 'javascript' : 'applescript',
          content,
          sourcePath: filePath,
          isLocal,
        })
      }
      continue
    }

    const categoryId = entry.name
    const categoryPath = path.join(rootPath, categoryId)
    const files = await fs.readdir(categoryPath, { withFileTypes: true })
    let categoryDescription = `${categoryId} 自动化脚本模板`

    for (const file of files) {
      if (!file.isFile()) {
        continue
      }

      const filePath = path.join(categoryPath, file.name)
      if (file.name === '_category_info.md') {
        const infoParsed = matter(await fs.readFile(filePath, 'utf8'))
        if (typeof infoParsed.data.description === 'string') {
          categoryDescription = infoParsed.data.description
        }
        continue
      }

      if (!file.name.endsWith('.md') || file.name.startsWith('_')) {
        continue
      }

      const parsed = parseTemplateFile(await fs.readFile(filePath, 'utf8'))
      if (!parsed) {
        continue
      }

      const baseName = normalizeId(path.basename(file.name, '.md'))
      const id = parsed.frontmatter.id ?? `${categoryId}_${baseName}`
      templates.push({
        id,
        title: parsed.frontmatter.title ?? id,
        description: parsed.frontmatter.description,
        category: categoryId,
        language: parsed.language,
        script: parsed.script,
        keywords: Array.isArray(parsed.frontmatter.keywords)
          ? parsed.frontmatter.keywords
          : [],
        argumentsPrompt: parsed.frontmatter.argumentsPrompt,
        notes: parsed.frontmatter.notes,
        sourcePath: filePath,
        isLocal,
      })
    }

    categories.push({
      id: categoryId,
      description: categoryDescription,
      count: templates.filter((template) => template.category === categoryId).length,
    })
  }

  return { templates, categories, sharedHandlers }
}
