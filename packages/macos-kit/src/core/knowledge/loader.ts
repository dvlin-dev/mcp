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

  async function readTextFileSafe(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf8')
    } catch (error) {
      logger.warn('知识库文件读取失败', {
        filePath,
        isLocal,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  for (const entry of rootEntries) {
    if (!entry.isDirectory()) {
      continue
    }

    if (entry.name === '_shared_handlers') {
      const handlerRoot = path.join(rootPath, entry.name)
      let files: Dirent[]
      try {
        files = await fs.readdir(handlerRoot, { withFileTypes: true })
      } catch (error) {
        logger.warn('shared handlers 目录读取失败', {
          handlerRoot,
          isLocal,
          error: error instanceof Error ? error.message : String(error),
        })
        continue
      }
      for (const file of files) {
        if (!file.isFile()) {
          continue
        }
        const extension = path.extname(file.name)
        if (!['.applescript', '.js'].includes(extension)) {
          continue
        }

        const filePath = path.join(handlerRoot, file.name)
        const content = await readTextFileSafe(filePath)
        if (content === null) {
          continue
        }
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
    let files: Dirent[]
    try {
      files = await fs.readdir(categoryPath, { withFileTypes: true })
    } catch (error) {
      logger.warn('分类目录读取失败', {
        categoryId,
        categoryPath,
        isLocal,
        error: error instanceof Error ? error.message : String(error),
      })
      continue
    }
    let categoryDescription = `${categoryId} 自动化脚本模板`

    for (const file of files) {
      if (!file.isFile()) {
        continue
      }

      const filePath = path.join(categoryPath, file.name)
      if (file.name === '_category_info.md') {
        try {
          const rawInfo = await readTextFileSafe(filePath)
          if (!rawInfo) {
            continue
          }
          const infoParsed = matter(rawInfo)
          if (typeof infoParsed.data.description === 'string') {
            categoryDescription = infoParsed.data.description
          }
        } catch (error) {
          logger.warn('分类信息解析失败', {
            categoryId,
            filePath,
            isLocal,
            error: error instanceof Error ? error.message : String(error),
          })
        }
        continue
      }

      if (!file.name.endsWith('.md') || file.name.startsWith('_')) {
        continue
      }

      const rawTemplate = await readTextFileSafe(filePath)
      if (!rawTemplate) {
        continue
      }

      let parsed: ReturnType<typeof parseTemplateFile>
      try {
        parsed = parseTemplateFile(rawTemplate)
      } catch (error) {
        logger.warn('模板解析失败，已跳过', {
          filePath,
          categoryId,
          isLocal,
          error: error instanceof Error ? error.message : String(error),
        })
        continue
      }

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
