import path from 'node:path'
import type { Logger } from '../logger.js'
import { loadKnowledgeFromPath } from './loader.js'
import { searchTemplates } from './search.js'
import type { KnowledgeIndex, KnowledgeTemplate } from './types.js'

export class KnowledgeManager {
  private cache: KnowledgeIndex | null = null
  private loading: Promise<KnowledgeIndex> | null = null

  constructor(
    private readonly options: {
      logger: Logger
      embeddedRoot: string
      localOverrideRoot?: string
    }
  ) {}

  private mergeIndex(base: KnowledgeIndex, override: KnowledgeIndex): KnowledgeIndex {
    const templateMap = new Map<string, KnowledgeTemplate>()
    for (const item of base.templates) {
      templateMap.set(item.id, item)
    }
    for (const item of override.templates) {
      templateMap.set(item.id, item)
    }

    const sharedHandlerMap = new Map<string, KnowledgeIndex['sharedHandlers'][number]>()
    for (const handler of base.sharedHandlers) {
      sharedHandlerMap.set(`${handler.name}:${handler.language}`, handler)
    }
    for (const handler of override.sharedHandlers) {
      sharedHandlerMap.set(`${handler.name}:${handler.language}`, handler)
    }

    const categories = new Map<string, string>()
    for (const category of [...base.categories, ...override.categories]) {
      categories.set(category.id, category.description)
    }

    const mergedTemplates = Array.from(templateMap.values()).sort((a, b) =>
      a.id.localeCompare(b.id)
    )

    const mergedCategories = Array.from(categories.entries())
      .map(([id, description]) => ({
        id,
        description,
        count: mergedTemplates.filter((template) => template.category === id).length,
      }))
      .filter((category) => category.count > 0)
      .sort((a, b) => a.id.localeCompare(b.id))

    return {
      templates: mergedTemplates,
      categories: mergedCategories,
      sharedHandlers: Array.from(sharedHandlerMap.values()),
    }
  }

  async load(forceReload = false): Promise<KnowledgeIndex> {
    if (this.cache && !forceReload) {
      return this.cache
    }

    if (this.loading && !forceReload) {
      return this.loading
    }

    this.loading = (async () => {
      const embedded = await loadKnowledgeFromPath({
        rootPath: this.options.embeddedRoot,
        isLocal: false,
        logger: this.options.logger,
      })

      let merged = embedded

      if (this.options.localOverrideRoot) {
        const localRoot = this.options.localOverrideRoot.startsWith('~/')
          ? path.resolve(
              process.env.HOME ?? '',
              this.options.localOverrideRoot.slice(2)
            )
          : this.options.localOverrideRoot

        const local = await loadKnowledgeFromPath({
          rootPath: localRoot,
          isLocal: true,
          logger: this.options.logger,
        })
        merged = this.mergeIndex(embedded, local)
      }

      this.cache = merged
      return merged
    })()

    try {
      return await this.loading
    } finally {
      this.loading = null
    }
  }

  async listCategories() {
    const index = await this.load()
    return index.categories
  }

  async search(options: { query?: string; category?: string; limit?: number }) {
    const index = await this.load()
    return searchTemplates({
      templates: index.templates,
      query: options.query,
      category: options.category,
      limit: options.limit ?? 10,
    })
  }

  async getTemplateById(templateId: string): Promise<KnowledgeTemplate | null> {
    const index = await this.load()
    return index.templates.find((item) => item.id === templateId) ?? null
  }
}
