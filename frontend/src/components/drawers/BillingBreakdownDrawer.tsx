import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { getBillingBreakdown } from '@/services/billing'
import type { BillingBreakdownRecord } from '@/types/finance'

interface BillingBreakdownDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resourceSet: string
  month: string
  currency: string
}

interface BreakdownRow {
  product: string
  existingAmount: number | null
  targetAmount: number | null
  ratio: number | null
}

function formatMoney(amount: number | null, currency: string): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function RatioBadge({ ratio }: { ratio: number | null }) {
  if (ratio === null) return <span className="text-muted-foreground/40">—</span>
  const pct = `${ratio.toFixed(1)}%`
  const className =
    ratio < 100
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : ratio <= 120
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  return (
    <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-bold tabular-nums', className)}>
      {pct}
    </span>
  )
}

export function BillingBreakdownDrawer({
  open,
  onOpenChange,
  resourceSet,
  month,
  currency,
}: BillingBreakdownDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<BreakdownRow[]>([])

  useEffect(() => {
    if (!open || !resourceSet || !month) return
    setLoading(true)
    Promise.all([
      getBillingBreakdown(month, 'existing', resourceSet),
      getBillingBreakdown(month, 'target', resourceSet),
    ])
      .then(([existing, target]) => {
        const existingMap = new Map<string, number>(existing.map((r: BillingBreakdownRecord) => [r.product, r.amount]))
        const targetMap   = new Map<string, number>(target.map((r: BillingBreakdownRecord) => [r.product, r.amount]))
        const products = Array.from(new Set([...existingMap.keys(), ...targetMap.keys()])).sort()
        setRows(products.map(product => {
          const e = existingMap.get(product) ?? null
          const t = targetMap.get(product) ?? null
          const ratio = e !== null && t !== null ? (t / e) * 100 : null
          return { product, existingAmount: e, targetAmount: t, ratio }
        }))
      })
      .finally(() => setLoading(false))
  }, [open, resourceSet, month])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[600px] sm:!max-w-[600px] flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        <SheetHeader className="border-b px-6 py-4 pr-12 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-base">Cost Breakdown by Product</SheetTitle>
              <SheetDescription className="mt-1">
                <code className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded font-mono">
                  {resourceSet}
                </code>
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => onOpenChange(false)}
            >
              <X size={15} />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-center">
              <p className="text-sm text-muted-foreground">
                No breakdown data available for this resource set.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Product</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Existing</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Target</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-center">Ratio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.product}>
                      <TableCell>
                        <code className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded font-mono">
                          {row.product}
                        </code>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {row.existingAmount !== null
                          ? formatMoney(row.existingAmount, currency)
                          : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {row.targetAmount !== null
                          ? formatMoney(row.targetAmount, currency)
                          : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <RatioBadge ratio={row.ratio} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
