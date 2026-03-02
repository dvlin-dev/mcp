import type { ScriptLanguage } from '../executor/osascript-executor.js'

export interface KnowledgeTemplate {
  id: string
  title: string
  description?: string
  category: string
  language: ScriptLanguage
  script: string
  keywords: string[]
  argumentsPrompt?: string
  notes?: string
  sourcePath: string
  isLocal?: boolean
}

export interface KnowledgeCategory {
  id: string
  description: string
  count: number
}

export interface SharedHandler {
  name: string
  language: ScriptLanguage
  content: string
  sourcePath: string
  isLocal?: boolean
}

export interface KnowledgeIndex {
  templates: KnowledgeTemplate[]
  categories: KnowledgeCategory[]
  sharedHandlers: SharedHandler[]
}
