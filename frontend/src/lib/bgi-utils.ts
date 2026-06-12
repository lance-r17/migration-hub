import type { BgiNode } from '@/types/bgi'

export function filterBgiTree(nodes: BgiNode[], query: string): BgiNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes

  function walk(node: BgiNode): BgiNode | null {
    const matches = node.name.toLowerCase().includes(q)
    if (matches) {
      return { ...node }
    }
    const children = node.children?.map(walk).filter(Boolean) as BgiNode[] | undefined
    if (children && children.length > 0) {
      return { ...node, children }
    }
    return null
  }

  return nodes.map(walk).filter(Boolean) as BgiNode[]
}

export function collectAllIds(node: BgiNode): string[] {
  return [node.id, ...(node.children?.flatMap(collectAllIds) ?? [])]
}

export function findNodeById(node: BgiNode, id: string): BgiNode | null {
  if (node.id === id) return node
  for (const child of node.children ?? []) {
    const found = findNodeById(child, id)
    if (found) return found
  }
  return null
}

export function isDescendantOf(root: BgiNode, targetId: string, ancestorId: string): boolean {
  if (targetId === ancestorId) return false
  const ancestor = findNodeById(root, ancestorId)
  if (!ancestor) return false
  return collectAllIds(ancestor).includes(targetId)
}

export function getAncestorIds(root: BgiNode, targetId: string): string[] {
  const result: string[] = []
  function walk(node: BgiNode, path: string[]): boolean {
    if (node.id === targetId) {
      result.push(...path)
      return true
    }
    for (const child of node.children ?? []) {
      if (walk(child, [...path, node.id])) return true
    }
    return false
  }
  walk(root, [])
  return result
}

export function getBgiAncestry(
  root: BgiNode,
  targetId: string,
): { l2?: string; l3?: string; l4?: string; leafName?: string } {
  function walk(node: BgiNode, path: BgiNode[]): { l2?: string; l3?: string; l4?: string; leafName?: string } | null {
    if (node.id === targetId) {
      const fullPath = [...path, node]
      return {
        l2: fullPath[1]?.name,
        l3: fullPath[2]?.name,
        l4: fullPath[3]?.name,
        leafName: node.name,
      }
    }
    for (const child of node.children ?? []) {
      const result = walk(child, [...path, node])
      if (result) return result
    }
    return null
  }
  return walk(root, []) ?? {}
}

export function hasCoveredDescendants(
  root: BgiNode,
  nodeId: string,
  selectedIds: Set<string>,
  excludedIds: Set<string>,
): boolean {
  const node = findNodeById(root, nodeId)
  if (!node?.children || node.children.length === 0) return false

  function walk(n: BgiNode, ancestorSelected: boolean): boolean {
    const covered = selectedIds.has(n.id) || (ancestorSelected && !excludedIds.has(n.id))
    if (covered) return true
    const nowSelected = selectedIds.has(n.id)
    for (const child of n.children ?? []) {
      if (walk(child, nowSelected || ancestorSelected)) return true
    }
    return false
  }

  for (const child of node.children) {
    if (walk(child, selectedIds.has(node.id))) return true
  }
  return false
}

export function pruneEmptySelections(
  root: BgiNode,
  selectedIds: Set<string>,
  excludedIds: Set<string>,
): Set<string> {
  const result = new Set(selectedIds)
  let changed = true
  while (changed) {
    changed = false
    for (const id of result) {
      const node = findNodeById(root, id)
      if (node?.children && node.children.length > 0 && !hasCoveredDescendants(root, id, result, excludedIds)) {
        result.delete(id)
        changed = true
        break
      }
    }
  }
  return result
}

export function isFullySelected(
  node: BgiNode,
  selectedIds: Set<string>,
  excludedIds: Set<string>,
  ancestorSelected: boolean,
): boolean {
  const covered = selectedIds.has(node.id) || (ancestorSelected && !excludedIds.has(node.id))
  if (covered) return true
  if (!node.children || node.children.length === 0) return false
  const nowSelected = selectedIds.has(node.id)
  return node.children.every(child =>
    isFullySelected(child, selectedIds, excludedIds, nowSelected || ancestorSelected),
  )
}

export function promoteFullSelections(
  root: BgiNode,
  selectedIds: Set<string>,
  excludedIds: Set<string>,
  changedId: string,
): { selected: Set<string>; excluded: Set<string> } {
  let currentSelected = new Set(selectedIds)
  let currentExcluded = new Set(excludedIds)

  const ancestors = getAncestorIds(root, changedId)
  for (const parentId of ancestors) {
    const parent = findNodeById(root, parentId)
    if (!parent?.children) continue

    const allChildrenFullySelected = parent.children.every(child =>
      isFullySelected(child, currentSelected, currentExcluded, currentSelected.has(parent.id)),
    )

    if (allChildrenFullySelected) {
      for (const child of parent.children) {
        collectAllIds(child).forEach(id => currentSelected.delete(id))
      }
      currentSelected.add(parent.id)
      for (const ex of currentExcluded) {
        if (isDescendantOf(root, ex, parent.id)) {
          currentExcluded.delete(ex)
        }
      }
    }
  }

  return { selected: currentSelected, excluded: currentExcluded }
}
