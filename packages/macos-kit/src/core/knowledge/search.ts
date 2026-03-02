import Fuse from 'fuse.js'
import type { KnowledgeTemplate } from './types.js'

export function searchTemplates(options: {
  templates: KnowledgeTemplate[]
  query?: string
  category?: string
  limit: number
}): KnowledgeTemplate[] {
  const { templates, query, category, limit } = options

  let filtered = category
    ? templates.filter((template) => template.category === category)
    : templates

  if (!query) {
    return filtered.slice(0, limit)
  }

  const fuse = new Fuse(filtered, {
    threshold: 0.35,
    keys: [
      { name: 'id', weight: 0.35 },
      { name: 'title', weight: 0.3 },
      { name: 'description', weight: 0.2 },
      { name: 'keywords', weight: 0.1 },
      { name: 'script', weight: 0.05 },
    ],
  })

  filtered = fuse.search(query).map((result) => result.item)
  return filtered.slice(0, limit)
}
