import type { Block } from '@frontend/notion-editor'
import { cloneBlock } from '@frontend/notion-editor'

/**
 * Deep clone and sanitize blocks before saving them as a template.
 * Strips project-specific identifiers such as image URLs and bookmark URLs.
 */
export function sanitizeBlocksForTemplate(blocks: Block[]): Block[] {
  return blocks.map(sanitizeBlock)
}

function sanitizeBlock(block: Block): Block {
  const cloned = cloneBlock(block)
  switch (cloned.type) {
    case 'image':
      cloned.src = ''
      cloned.caption = ''
      break
    case 'bookmark':
      cloned.url = ''
      cloned.title = ''
      cloned.desc = ''
      break
    case 'columns':
      cloned.columns = cloned.columns.map(col => col.map(sanitizeBlock))
      break
    case 'tabs':
      cloned.tabs = cloned.tabs.map(tab => ({
        ...tab,
        blocks: tab.blocks.map(sanitizeBlock),
      }))
      break
    default:
      break
  }
  return cloned
}

/** Supported template variables with descriptions. */
export const TEMPLATE_VARIABLES = [
  { key: 'interviewSubject', label: 'Interview Subject', example: 'Alpha Finance Migration' },
  { key: 'projectName', label: 'Project Name', example: 'Alpha Finance' },
  { key: 'projectId', label: 'Project ID', example: 'PRJ-ABC123' },
  { key: 'baId', label: 'BA ID', example: 'EIM-00105' },
  { key: 'applicationName', label: 'Application Name', example: 'Alpha Finance' },
  { key: 'migrationWave', label: 'Migration Wave', example: 'Wave 3' },
  { key: 'itso', label: 'ITSO', example: 'John Doe' },
  { key: 'technicalLead', label: 'Technical Lead', example: 'Jane Smith' },
  { key: 'businessOwner', label: 'Business Owner', example: 'Bob Brown' },
  { key: 'gbiChampion', label: 'GBI Champion', example: 'Charlie Green' },
  { key: 'gbiChampionDelegate', label: 'GBI Champion Delegate', example: 'Dana White' },
  { key: 'date', label: 'Current Date', example: new Date().toISOString().split('T')[0] },
  { key: 'userName', label: 'Current User', example: 'Jane Smith' },
] as const

export type TemplateVariableKey = typeof TEMPLATE_VARIABLES[number]['key']

/**
 * Build a context map from project data for variable resolution.
 */
export function buildTemplateContext(project: Record<string, unknown> | null, userName = ''): Record<string, string> {
  const ctx: Record<string, string> = {}
  if (!project) return ctx

  const engagement = (project.engagement as Record<string, unknown> | undefined) || {}
  const appOverview = (project.applicationOverview as Record<string, unknown> | undefined) || {}
  const govRoles = (project.governanceRoles as Record<string, unknown> | undefined) || {}

  ctx.interviewSubject = (engagement.interviewSubject as string) || ''
  ctx.projectName = (project.name as string) || ''
  ctx.projectId = (project.id as string) || ''
  ctx.baId = (appOverview.baId as string) || ''
  ctx.applicationName = (appOverview.applicationName as string) || ''
  ctx.migrationWave = (project.migrationWave as string) || (project.waveId as string) || ''
  ctx.itso = (project.itso as string) || ''
  ctx.technicalLead = ((govRoles.technicalLead as Record<string, unknown> | undefined)?.name as string) || ''
  ctx.businessOwner = ((govRoles.businessOwner as Record<string, unknown> | undefined)?.name as string) || ''
  ctx.gbiChampion = ((govRoles.gbiChampion as Record<string, unknown> | undefined)?.name as string) || ''
  ctx.gbiChampionDelegate = ((govRoles.gbiChampionDelegate as Record<string, unknown> | undefined)?.name as string) || ''
  ctx.date = new Date().toISOString().split('T')[0]
  ctx.userName = userName

  return ctx
}

/**
 * Resolve {{variableName}} placeholders inside block text fields.
 */
export function resolveTemplateVariables(
  blocks: Block[],
  context: Record<string, string>,
): Block[] {
  return blocks.map(b => resolveBlockVariables(b, context))
}

function resolveString(str: string | undefined, context: Record<string, string>): string | undefined {
  if (!str) return str
  return str.replace(/\{\{(\w+)\}\}/g, (_match, key) => context[key] ?? _match)
}

function resolveBlockVariables(block: Block, context: Record<string, string>): Block {
  const cloned = cloneBlock(block)

  if ('content' in cloned) {
    (cloned as any).content = resolveString((cloned as any).content, context)
  }
  if ('caption' in cloned) {
    (cloned as any).caption = resolveString((cloned as any).caption, context)
  }
  if ('title' in cloned) {
    (cloned as any).title = resolveString((cloned as any).title, context)
  }
  if ('desc' in cloned) {
    (cloned as any).desc = resolveString((cloned as any).desc, context)
  }
  if ('url' in cloned) {
    (cloned as any).url = resolveString((cloned as any).url, context)
  }

  switch (cloned.type) {
    case 'columns':
      cloned.columns = cloned.columns.map(col => col.map(b => resolveBlockVariables(b, context)))
      break
    case 'tabs':
      cloned.tabs = cloned.tabs.map(tab => ({
        ...tab,
        title: resolveString(tab.title, context) ?? tab.title,
        blocks: tab.blocks.map(b => resolveBlockVariables(b, context)),
      }))
      break
    case 'table':
      cloned.rows = cloned.rows.map(row => row.map(cell => resolveString(cell, context) ?? ''))
      break
  }

  return cloned
}

/**
 * Scan blocks for exact matches against context values and return a ranked list.
 * Longest matches come first to avoid partial overlaps.
 */
export function findVariableMatches(
  blocks: Block[],
  context: Record<string, string>,
): Array<{ key: string; label: string; value: string }> {
  const allText = collectBlockText(blocks)
  const matches: Array<{ key: string; label: string; value: string }> = []

  for (const v of TEMPLATE_VARIABLES) {
    const value = context[v.key]
    if (value && allText.includes(value)) {
      matches.push({ key: v.key, label: v.label, value })
    }
  }

  // Longest value first to avoid partial replacements
  return matches.sort((a, b) => b.value.length - a.value.length)
}

function collectBlockText(blocks: Block[]): string {
  const texts: string[] = []
  for (const block of blocks) {
    if ('content' in block && typeof (block as any).content === 'string') {
      texts.push((block as any).content)
    }
    if ('caption' in block && typeof (block as any).caption === 'string') {
      texts.push((block as any).caption)
    }
    if ('title' in block && typeof (block as any).title === 'string') {
      texts.push((block as any).title)
    }
    if ('desc' in block && typeof (block as any).desc === 'string') {
      texts.push((block as any).desc)
    }
    if (block.type === 'tabs') {
      for (const tab of block.tabs) {
        texts.push(tab.title)
        texts.push(...collectBlockText(tab.blocks))
      }
    }
    if (block.type === 'columns') {
      for (const col of block.columns) {
        texts.push(...collectBlockText(col))
      }
    }
    if (block.type === 'table') {
      for (const row of block.rows) {
        texts.push(...row)
      }
    }
  }
  return texts.join('\n')
}

/**
 * Replace exact occurrences of a value with {{key}} across all block text fields.
 */
export function applyVariableReplacement(blocks: Block[], key: string, value: string): Block[] {
  return blocks.map(b => replaceInBlock(b, key, value))
}

function replaceInBlock(block: Block, key: string, value: string): Block {
  const cloned = cloneBlock(block)
  const placeholder = `{{${key}}}`

  const repl = (str: string | undefined) => {
    if (!str) return str
    return str.split(value).join(placeholder)
  }

  if ('content' in cloned) {
    (cloned as any).content = repl((cloned as any).content)
  }
  if ('caption' in cloned) {
    (cloned as any).caption = repl((cloned as any).caption)
  }
  if ('title' in cloned) {
    (cloned as any).title = repl((cloned as any).title)
  }
  if ('desc' in cloned) {
    (cloned as any).desc = repl((cloned as any).desc)
  }

  switch (cloned.type) {
    case 'columns':
      cloned.columns = cloned.columns.map(col => col.map(b => replaceInBlock(b, key, value)))
      break
    case 'tabs':
      cloned.tabs = cloned.tabs.map(tab => ({
        ...tab,
        title: repl(tab.title) ?? tab.title,
        blocks: tab.blocks.map(b => replaceInBlock(b, key, value)),
      }))
      break
    case 'table':
      cloned.rows = cloned.rows.map(row => row.map(cell => repl(cell) ?? cell))
      break
  }

  return cloned
}

/**
 * Revert {{key}} placeholders back to their original value across all block text fields.
 */
export function revertVariableReplacement(blocks: Block[], key: string, value: string): Block[] {
  return blocks.map(b => revertInBlock(b, key, value))
}

function revertInBlock(block: Block, key: string, value: string): Block {
  const cloned = cloneBlock(block)
  const placeholder = `{{${key}}}`

  const repl = (str: string | undefined) => {
    if (!str) return str
    return str.split(placeholder).join(value)
  }

  if ('content' in cloned) {
    (cloned as any).content = repl((cloned as any).content)
  }
  if ('caption' in cloned) {
    (cloned as any).caption = repl((cloned as any).caption)
  }
  if ('title' in cloned) {
    (cloned as any).title = repl((cloned as any).title)
  }
  if ('desc' in cloned) {
    (cloned as any).desc = repl((cloned as any).desc)
  }

  switch (cloned.type) {
    case 'columns':
      cloned.columns = cloned.columns.map(col => col.map(b => revertInBlock(b, key, value)))
      break
    case 'tabs':
      cloned.tabs = cloned.tabs.map(tab => ({
        ...tab,
        title: repl(tab.title) ?? tab.title,
        blocks: tab.blocks.map(b => revertInBlock(b, key, value)),
      }))
      break
    case 'table':
      cloned.rows = cloned.rows.map(row => row.map(cell => repl(cell) ?? cell))
      break
  }

  return cloned
}
