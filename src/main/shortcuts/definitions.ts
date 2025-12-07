import type { TaskCategory } from '@shared/types'

export type ShortcutId =
  | 'toodoo:short_term'
  | 'toodoo:long_term'
  | 'toodoo:project'
  | 'toodoo:immediate'
  | 'transly:correct'
  | 'transly:translate'
  | 'notetank:editor'
  | 'airu:popup'

export type ShortcutDefinition = {
  id: ShortcutId
  accelerator: string
  tool: string
  description: string
}

export const SHORTCUTS: Record<ShortcutId, ShortcutDefinition> = {
  'toodoo:short_term': {
    id: 'toodoo:short_term',
    accelerator: 'Alt+Shift+S',
    tool: 'TooDoo',
    description: 'Add short-term task',
  },
  'toodoo:long_term': {
    id: 'toodoo:long_term',
    accelerator: 'Alt+Shift+L',
    tool: 'TooDoo',
    description: 'Add long-term task',
  },
  'toodoo:project': {
    id: 'toodoo:project',
    accelerator: 'Alt+Shift+P',
    tool: 'TooDoo',
    description: 'Add project task',
  },
  'toodoo:immediate': {
    id: 'toodoo:immediate',
    accelerator: 'Alt+Shift+I',
    tool: 'TooDoo',
    description: 'Add immediate task',
  },
  'transly:correct': {
    id: 'transly:correct',
    accelerator: 'Alt+Shift+T',
    tool: 'Transly',
    description: 'Correct typo in selection',
  },
  'transly:translate': {
    id: 'transly:translate',
    accelerator: 'Alt+Shift+K',
    tool: 'Transly',
    description: 'Show translation options',
  },
  'notetank:editor': {
    id: 'notetank:editor',
    accelerator: 'Alt+Shift+N',
    tool: 'NoteTank',
    description: 'Open note editor',
  },
  'airu:popup': {
    id: 'airu:popup',
    accelerator: 'Alt+Shift+A',
    tool: 'Airu',
    description: 'Open Airu popup',
  },
}

export const TOODOO_CATEGORY_SHORTCUTS: Record<string, TaskCategory> = {
  'Alt+Shift+S': 'short_term',
  'Alt+Shift+L': 'long_term',
  'Alt+Shift+P': 'project',
  'Alt+Shift+I': 'immediate',
}
