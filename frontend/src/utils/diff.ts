import type { AuditChange } from '@/types/audit'

const TRUNCATE_LEN = 80

export function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) {
    if (v.length === 0) return '(empty)'
    const joined = v.map(item =>
      typeof item === 'object' && item !== null
        ? (item as Record<string, unknown>).name ?? JSON.stringify(item)
        : String(item)
    ).join(', ')
    return joined.length > TRUNCATE_LEN ? joined.slice(0, TRUNCATE_LEN) + '…' : joined
  }
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  return s.length > TRUNCATE_LEN ? s.slice(0, TRUNCATE_LEN) + '…' : s
}

/**
 * Compares two values and returns an array of field-level changes.
 * Handles primitives, shallow objects, and arrays.
 *
 * @param before - Previous value (whole section or field)
 * @param after  - New value
 * @param labelMap - Optional map of fieldKey → human-readable label
 * @param prefix  - Used internally for nested field paths
 */
export function diffObjects(
  before: unknown,
  after: unknown,
  labelMap: Record<string, string> = {},
  prefix = '',
): AuditChange[] {
  const changes: AuditChange[] = []

  // Both primitives or same type leaf
  if (!isPlainObject(before) || !isPlainObject(after)) {
    const bStr = formatValue(before)
    const aStr = formatValue(after)
    if (bStr !== aStr) {
      const field = prefix || 'value'
      changes.push({
        field,
        label: labelMap[field] ?? toLabel(field),
        oldValue: before,
        newValue: after,
      })
    }
    return changes
  }

  const beforeObj = before as Record<string, unknown>
  const afterObj = after as Record<string, unknown>
  const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])

  for (const key of allKeys) {
    const fieldPath = prefix ? `${prefix}.${key}` : key
    const bVal = beforeObj[key]
    const aVal = afterObj[key]

    if (bVal === undefined && aVal === undefined) continue

    // Recurse one level into nested plain objects, but not arrays
    if (isPlainObject(bVal) && isPlainObject(aVal) && !prefix) {
      const nested = diffObjects(bVal, aVal, labelMap, key)
      changes.push(...nested)
      continue
    }

    const bStr = formatValue(bVal)
    const aStr = formatValue(aVal)
    if (bStr !== aStr) {
      changes.push({
        field: fieldPath,
        label: labelMap[fieldPath] ?? labelMap[key] ?? toLabel(key),
        oldValue: bVal,
        newValue: aVal,
      })
    }
  }

  return changes
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function toLabel(key: string): string {
  // camelCase / snake_case → Title Case
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\s/, '')
    .replace(/\b\w/g, c => c.toUpperCase())
}
