import type { NoteTemplate } from '@/types'

const predefined: NoteTemplate[] = [
  {
    id: 'tpl-engagement-default',
    name: 'Engagement Interview Default',
    description: 'Standard structure for engagement interview notes.',
    labels: ['engagement'],
    scope: 'global',
    blocks: [
      { id: 'b1', type: 'h1', content: '{{interviewSubject}}' },
      { id: 'b2', type: 'h2', content: 'Attendees' },
      { id: 'b3', type: 'bullet', content: '' },
      { id: 'b4', type: 'h2', content: 'Key Discussion Points' },
      { id: 'b5', type: 'bullet', content: '' },
      { id: 'b6', type: 'h2', content: 'Action Items' },
      { id: 'b7', type: 'todo', content: '', checked: false },
    ],
    createdAt: '2026-05-24T00:00:00Z',
    updatedAt: '2026-05-24T00:00:00Z',
  },
  {
    id: 'tpl-architecture-review',
    name: 'Architecture Review',
    description: 'Template for capturing architecture review outcomes.',
    labels: ['architecture', 'review'],
    scope: 'global',
    blocks: [
      { id: 'b1', type: 'h1', content: 'Architecture Review' },
      { id: 'b2', type: 'h2', content: 'Current State' },
      { id: 'b3', type: 'paragraph', content: '' },
      { id: 'b4', type: 'h2', content: 'Target State' },
      { id: 'b5', type: 'paragraph', content: '' },
      { id: 'b6', type: 'h2', content: 'Gaps & Risks' },
      { id: 'b7', type: 'bullet', content: '' },
      { id: 'b8', type: 'h2', content: 'Decisions' },
      { id: 'b9', type: 'callout', content: '', variant: 'info', icon: '💡' },
    ],
    createdAt: '2026-05-24T00:00:00Z',
    updatedAt: '2026-05-24T00:00:00Z',
  },
  {
    id: 'tpl-migration-lead-only',
    name: 'Migration Lead Checklist',
    description: 'Internal checklist for platform migration leads.',
    labels: ['checklist', 'engagement'],
    scope: 'function',
    sharedRoles: ['platform_migration_lead', 'admin'],
    blocks: [
      { id: 'b1', type: 'h1', content: 'Migration Lead Checklist — {{projectName}}' },
      { id: 'b2', type: 'todo', content: 'Review application overview', checked: false },
      { id: 'b3', type: 'todo', content: 'Validate resource inventory', checked: false },
      { id: 'b4', type: 'todo', content: 'Confirm wave assignment', checked: false },
    ],
    createdAt: '2026-05-24T00:00:00Z',
    updatedAt: '2026-05-24T00:00:00Z',
  },
]

let store: NoteTemplate[] = [...predefined]

export function getAllNoteTemplates(): NoteTemplate[] {
  return [...store]
}

export function getNoteTemplateById(id: string): NoteTemplate | undefined {
  return store.find(t => t.id === id)
}

export function upsertNoteTemplate(template: NoteTemplate): NoteTemplate {
  const idx = store.findIndex(t => t.id === template.id)
  const updated = { ...template, updatedAt: new Date().toISOString() }
  if (idx >= 0) {
    store[idx] = updated
  } else {
    store = [...store, updated]
  }
  return updated
}

export function deleteNoteTemplate(id: string): void {
  store = store.filter(t => t.id !== id)
}

export function createBlankNoteTemplate(): NoteTemplate {
  const now = new Date().toISOString()
  return {
    id: `ntpl-${Date.now()}`,
    name: 'Untitled Template',
    description: '',
    labels: [],
    blocks: [],
    scope: 'private',
    sharedRoles: [],
    createdAt: now,
    updatedAt: now,
  }
}
