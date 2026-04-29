import { useState } from 'react'
import { cn } from '@/lib/utils'

interface BarChartSegment {
  label: string
  value: number
  color: string
}

interface BarChartDataPoint {
  label: string
  value: number
  segments?: BarChartSegment[]
}

interface BarChartProps {
  data: BarChartDataPoint[]
  barColor?: string
  maxValue?: number
  barWidth?: number
  height?: number
  gap?: number
  className?: string
}

export function BarChart({
  data,
  barColor = 'var(--primary)',
  maxValue: customMax,
  barWidth = 28,
  height = 140,
  gap = 8,
  className,
}: BarChartProps) {
  const [tooltip, setTooltip] = useState<{
    visible: boolean
    x: number
    y: number
    title: string
    items: { label: string; value: number; color: string }[]
  } | null>(null)

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-muted-foreground text-sm',
          className,
        )}
        style={{ height }}
      >
        No data
      </div>
    )
  }

  const getTotal = (d: BarChartDataPoint) =>
    d.segments ? d.segments.reduce((sum, s) => sum + s.value, 0) : d.value

  const maxValue = customMax ?? Math.max(...data.map(getTotal), 1)
  const paddingTop = 20
  const paddingBottom = 24
  const chartHeight = height - paddingTop - paddingBottom
  const totalWidth = data.length * barWidth + (data.length + 1) * gap

  const handleMouseEnter = (
    e: React.MouseEvent<SVGRectElement>,
    point: BarChartDataPoint,
  ) => {
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const items = point.segments
      ? point.segments.map((s) => ({ label: s.label, value: s.value, color: s.color }))
      : [{ label: 'Value', value: point.value, color: barColor }]

    setTooltip({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 8,
      title: point.label,
      items,
    })
  }

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    setTooltip((prev) =>
      prev
        ? {
            ...prev,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top - 8,
          }
        : null,
    )
  }

  const handleMouseLeave = () => {
    setTooltip(null)
  }

  return (
    <div className={cn('relative', className)}>
      <svg
        width={totalWidth}
        height={height}
        viewBox={`0 0 ${totalWidth} ${height}`}
        role="img"
        aria-label="Bar chart"
      >
        {data.map((d, i) => {
          const x = gap + i * (barWidth + gap)
          const total = getTotal(d)
          const totalHeight = (total / maxValue) * chartHeight
          const totalY = paddingTop + chartHeight - totalHeight

          if (d.segments && d.segments.length > 0) {
            let currentY = totalY + totalHeight
            return (
              <g key={i}>
                {d.segments.map((segment, si) => {
                  const segmentHeight = (segment.value / maxValue) * chartHeight
                  currentY -= segmentHeight
                  const isTop = si === d.segments!.length - 1
                  return (
                    <rect
                      key={si}
                      x={x}
                      y={currentY}
                      width={barWidth}
                      height={segmentHeight}
                      fill={segment.color}
                      rx={isTop ? 3 : 0}
                      ry={isTop ? 3 : 0}
                      className="transition-opacity duration-200 hover:opacity-80 cursor-pointer"
                      onMouseEnter={(e) => handleMouseEnter(e, d)}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                    />
                  )
                })}
                {total > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={totalY - 5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-foreground text-[9px] font-semibold tabular-nums"
                  >
                    {total}
                  </text>
                )}
                <text
                  x={x + barWidth / 2}
                  y={height - 6}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[9px]"
                >
                  {d.label}
                </text>
              </g>
            )
          }

          const barHeight = (d.value / maxValue) * chartHeight
          const y = paddingTop + chartHeight - barHeight

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={barColor}
                rx={3}
                className="transition-opacity duration-200 hover:opacity-80 cursor-pointer"
                onMouseEnter={(e) => handleMouseEnter(e, d)}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              />
              {d.value > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground text-[9px] font-semibold tabular-nums"
                >
                  {d.value}
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={height - 6}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[9px]"
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>

      {tooltip && tooltip.visible && (
        <div
          className="absolute z-50 pointer-events-none rounded-md bg-foreground px-3 py-2 text-xs text-background shadow-md"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-semibold mb-1">{tooltip.title}</div>
          <div className="space-y-0.5">
            {tooltip.items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="flex-1">{item.label}</span>
                <span className="font-medium tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
