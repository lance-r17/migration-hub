import type { Block } from '../model'

export const TEXT_COLORS = [
  { value: 'default', css: null as string | null, label: 'A', title: 'Default' },
  { value: 'gray', css: '#9B9A93', label: 'A', title: 'Gray' },
  { value: 'brown', css: '#9F6B53', label: 'A', title: 'Brown' },
  { value: 'orange', css: '#D9730D', label: 'A', title: 'Orange' },
  { value: 'yellow', css: '#CB912F', label: 'A', title: 'Yellow' },
  { value: 'green', css: '#448361', label: 'A', title: 'Green' },
  { value: 'blue', css: '#337EA9', label: 'A', title: 'Blue' },
  { value: 'purple', css: '#9065B0', label: 'A', title: 'Purple' },
  { value: 'pink', css: '#C14C8A', label: 'A', title: 'Pink' },
  { value: 'red', css: '#D44C47', label: 'A', title: 'Red' },
]

export const BG_COLORS = [
  { value: 'default', css: null as string | null, title: 'Default' },
  { value: 'gray', css: '#F1F1EF', title: 'Gray' },
  { value: 'brown', css: '#F1ECE7', title: 'Brown' },
  { value: 'orange', css: '#FBECDD', title: 'Orange' },
  { value: 'yellow', css: '#FBF3DB', title: 'Yellow' },
  { value: 'green', css: '#DDEDE3', title: 'Green' },
  { value: 'blue', css: '#DDEBF1', title: 'Blue' },
  { value: 'purple', css: '#EAE4F2', title: 'Purple' },
  { value: 'pink', css: '#F4DFEB', title: 'Pink' },
  { value: 'red', css: '#FBE4E4', title: 'Red' },
]

export const TEXT_COLOR_MAP = Object.fromEntries(TEXT_COLORS.map(c => [c.value, c.css]))
export const BG_COLOR_MAP = Object.fromEntries(BG_COLORS.map(c => [c.value, c.css]))

export const TEXT_CSS_TO_VALUE: Record<string, string> = Object.fromEntries(
  TEXT_COLORS.filter(c => c.css).map(c => [c.css!.toUpperCase(), c.value])
)
export const BG_CSS_TO_VALUE: Record<string, string> = Object.fromEntries(
  BG_COLORS.filter(c => c.css).map(c => [c.css!.toUpperCase(), c.value])
)

export function remapStyles(
  styles: Record<string, { textColor?: string; bgColor?: string }>,
  axis: 'row' | 'col',
  from: number,
  to: number,
) {
  if (from === to) return styles
  const out: Record<string, { textColor?: string; bgColor?: string }> = {}
  for (const key of Object.keys(styles)) {
    const [r, c] = key.split(',').map(Number)
    const target = axis === 'row' ? r : c
    let moved = target
    if (target === from) moved = to
    else if (from < target && target <= to) moved = target - 1
    else if (to <= target && target < from) moved = target + 1
    const nr = axis === 'row' ? moved : r
    const nc = axis === 'col' ? moved : c
    out[`${nr},${nc}`] = styles[key]
  }
  return out
}

export const TD_BASE = 'border-r border-b border-border bg-background align-top p-[7px_11px] relative min-w-[80px]'
export const TH_BASE = 'border-r border-b border-border bg-muted align-top p-[7px_11px] relative min-w-[80px] text-[13px] font-medium text-foreground'

export function setCell(
  rows: string[][],
  cols: number,
  r: number,
  c: number,
  html: string,
): { rows: string[][]; cols: number } {
  return {
    rows: rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? html : cell)) : row)),
    cols,
  }
}

export type TablePatch = Partial<Extract<Block, { type: 'table' }>>
