import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronRight, ChevronDown, Plus, Trash2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GbiNode } from '@/types/gbi'

export type SelectAction = 'select' | 'exclude' | 'unselect' | 'unexclude'

interface GbiTreeProps {
  nodes: GbiNode[]
  selectedIds: Set<string>
  excludedIds: Set<string>
  onSelect?: (node: GbiNode, action: SelectAction) => void
  onAddChild?: (parentId: string) => void
  onDelete?: (nodeId: string) => void
  onRename?: (nodeId: string, newName: string) => void
  level?: number
  readOnly?: boolean
  checkable?: boolean
  scopeIds?: string[] | null
  maxDepth?: number
}

function computeTreeState(
  node: GbiNode,
  selectedIds: Set<string>,
  excludedIds: Set<string>,
  ancestorSelected: boolean,
  map: Map<string, { checked: boolean; indeterminate: boolean }>,
): void {
  const covered = selectedIds.has(node.id) || (ancestorSelected && !excludedIds.has(node.id))
  const children = node.children ?? []

  for (const child of children) {
    computeTreeState(child, selectedIds, excludedIds, covered, map)
  }

  if (children.length === 0) {
    map.set(node.id, { checked: covered, indeterminate: false })
    return
  }

  const childStates = children.map((c) => map.get(c.id)!)
  const allChecked = childStates.every((s) => s.checked)
  const allUnchecked = childStates.every((s) => !s.checked && !s.indeterminate)

  if (covered) {
    map.set(node.id, { checked: true, indeterminate: !allChecked })
  } else {
    map.set(node.id, { checked: false, indeterminate: !allUnchecked })
  }
}

function buildStateMap(
  nodes: GbiNode[],
  selectedIds: Set<string>,
  excludedIds: Set<string>,
): Map<string, { checked: boolean; indeterminate: boolean }> {
  const map = new Map<string, { checked: boolean; indeterminate: boolean }>()
  for (const node of nodes) {
    computeTreeState(node, selectedIds, excludedIds, false, map)
  }
  return map
}

function GbiTreeNode({
  node,
  selectedIds,
  excludedIds,
  stateMap,
  onSelect,
  onAddChild,
  onDelete,
  onRename,
  level = 0,
  readOnly = false,
  checkable = false,
  scopeIds = null,
  inScope = false,
  maxDepth,
}: {
  node: GbiNode
  selectedIds: Set<string>
  excludedIds: Set<string>
  stateMap: Map<string, { checked: boolean; indeterminate: boolean }>
  onSelect?: (node: GbiNode, action: SelectAction) => void
  onAddChild?: (parentId: string) => void
  onDelete?: (nodeId: string) => void
  onRename?: (nodeId: string, newName: string) => void
  level?: number
  readOnly?: boolean
  checkable?: boolean
  scopeIds?: string[] | null
  inScope?: boolean
  maxDepth?: number
}) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(node.name)
  const checkboxRef = useRef<HTMLInputElement>(null)
  const hasChildren = (node.children?.length ?? 0) > 0
  const canExpand = hasChildren && (!maxDepth || level + 1 < maxDepth)
  const isSelfSelected = selectedIds.has(node.id)
  const isExcluded = excludedIds.has(node.id)
  const isInScope = !scopeIds || inScope || scopeIds.includes(node.id)
  const nodeState = useMemo(() => {
    if (checkable) {
      return { checked: selectedIds.has(node.id), indeterminate: false }
    }
    return stateMap.get(node.id) ?? { checked: false, indeterminate: false }
  }, [checkable, selectedIds, node.id, stateMap])

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = nodeState.indeterminate
    }
  }, [nodeState.indeterminate])

  const handleRename = () => {
    if (editName.trim() && editName !== node.name) {
      onRename?.(node.id, editName.trim())
    }
    setEditing(false)
  }

  const handleSelect = () => {
    if (!isInScope) return
    if (checkable) {
      if (selectedIds.has(node.id)) {
        onSelect?.(node, 'unselect')
      } else {
        onSelect?.(node, 'select')
      }
      return
    }
    if (isSelfSelected) {
      onSelect?.(node, 'unselect')
    } else if (isExcluded) {
      onSelect?.(node, 'unexclude')
    } else if (nodeState.checked) {
      onSelect?.(node, 'exclude')
    } else {
      onSelect?.(node, 'select')
    }
  }

  return (
    <div className="select-none">
      <div
        className={cn(
          'flex items-center gap-1 py-1 pr-2 rounded-sm group',
          !readOnly && isSelfSelected ? 'bg-accent text-accent-foreground' : isInScope ? 'hover:bg-muted/50' : 'opacity-50',
        )}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => canExpand && setExpanded((e) => !e)}
          className={cn(
            'size-5 flex items-center justify-center rounded-sm transition-colors shrink-0',
            canExpand ? 'hover:bg-muted cursor-pointer' : 'invisible',
          )}
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>

        {(readOnly || checkable) && (
          <input
            ref={checkboxRef}
            type="checkbox"
            className="size-4 accent-primary shrink-0 cursor-pointer disabled:cursor-not-allowed"
            checked={nodeState.checked}
            disabled={!isInScope}
            onChange={handleSelect}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        <button
          type="button"
          onClick={handleSelect}
          disabled={!isInScope}
          className={cn(
            'flex-1 flex items-center gap-2 text-left min-w-0',
            !isInScope && 'cursor-not-allowed',
          )}
        >
          {(readOnly || checkable) ? (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
              L{level + 1}
            </span>
          ) : (
            <span className="text-xs font-mono text-muted-foreground shrink-0">{node.id}</span>
          )}
          {editing ? (
            <input
              autoFocus
              className="h-6 px-1.5 text-sm rounded border border-input bg-background flex-1 min-w-0"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') {
                  setEditName(node.name)
                  setEditing(false)
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-sm truncate">{node.name}</span>
          )}
        </button>

        {!readOnly && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onAddChild?.(node.id)
              }}
              className="size-6 flex items-center justify-center rounded-sm hover:bg-muted"
              title="Add child"
            >
              <Plus className="size-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setEditing(true)
              }}
              className="size-6 flex items-center justify-center rounded-sm hover:bg-muted"
              title="Rename"
            >
              <Pencil className="size-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete?.(node.id)
              }}
              className="size-6 flex items-center justify-center rounded-sm hover:bg-muted text-destructive"
              title="Delete"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        )}
      </div>

      {expanded && canExpand && (
        <div>
          {node.children!.map((child) => (
            <GbiTreeNode
              key={child.id}
              node={child}
              selectedIds={selectedIds}
              excludedIds={excludedIds}
              stateMap={stateMap}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onRename={onRename}
              level={level + 1}
              readOnly={readOnly}
              checkable={checkable}
              scopeIds={scopeIds}
              inScope={isInScope}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function GbiTree({ nodes, selectedIds, excludedIds, onSelect, onAddChild, onDelete, onRename, readOnly, checkable, scopeIds, maxDepth }: GbiTreeProps) {
  const stateMap = buildStateMap(nodes, selectedIds, excludedIds)
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <GbiTreeNode
          key={node.id}
          node={node}
          selectedIds={selectedIds}
          excludedIds={excludedIds}
          stateMap={stateMap}
          onSelect={onSelect}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onRename={onRename}
          readOnly={readOnly}
          checkable={checkable}
          scopeIds={scopeIds}
          maxDepth={maxDepth}
        />
      ))}
    </div>
  )
}
