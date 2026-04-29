import { cn } from '@/lib/utils'

interface PieSlice {
  label: string
  value: number
  color: string
}

interface PieChartProps {
  data: PieSlice[]
  size?: number
  strokeWidth?: number
  className?: string
}

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  }
}

export function PieChart({ data, size = 160, strokeWidth = 0, className }: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (total === 0) {
    return (
      <div className={cn('flex items-center justify-center text-muted-foreground text-sm', className)} style={{ width: size, height: size }}>
        No data
      </div>
    )
  }

  const cx = size / 2
  const cy = size / 2
  const r = (size - strokeWidth) / 2 - 4
  const holeR = r * 0.55

  const slices = data.reduce<{ label: string; value: number; color: string; path: string; percentage: number }[]>(
    (acc, d) => {
      const prevAngle = acc.length > 0
        ? -Math.PI / 2 + data.slice(0, acc.length).reduce((s, x) => s + (x.value / total) * Math.PI * 2, 0)
        : -Math.PI / 2
      const angle = (d.value / total) * Math.PI * 2
      const startAngle = prevAngle
      const endAngle = prevAngle + angle

      const start = polarToCartesian(cx, cy, r, startAngle)
      const end = polarToCartesian(cx, cy, r, endAngle)
      const largeArcFlag = angle > Math.PI ? 1 : 0

      const path = [
        `M ${cx} ${cy}`,
        `L ${start.x} ${start.y}`,
        `A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
        'Z',
      ].join(' ')

      acc.push({ ...d, path, percentage: Math.round((d.value / total) * 100) })
      return acc
    },
    [],
  )

  return (
    <div className={cn('flex items-center gap-6', className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Pie chart">
        {slices.map((slice, i) => (
          <path
            key={i}
            d={slice.path}
            fill={slice.color}
            stroke="var(--card)"
            strokeWidth={strokeWidth || 2}
            className="transition-opacity duration-200 hover:opacity-80"
          />
        ))}
        {/* centre hole for doughnut effect */}
        <circle cx={cx} cy={cy} r={holeR} fill="var(--card)" />
        {/* centre text */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground text-[10px] font-semibold uppercase tracking-wider"
        >
          Total
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground text-lg font-bold"
        >
          {total}
        </text>
      </svg>

      <ul className="flex flex-col gap-2 min-w-[120px]">
        {slices.map((slice, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: slice.color }}
            />
            <span className="flex-1 text-muted-foreground">{slice.label}</span>
            <span className="font-semibold text-foreground tabular-nums">
              {slice.value}
              <span className="text-muted-foreground font-normal ml-0.5">({slice.percentage}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
