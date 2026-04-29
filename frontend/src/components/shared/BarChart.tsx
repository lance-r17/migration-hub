import { cn } from '@/lib/utils'

interface BarChartDataPoint {
  label: string
  value: number
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

  const maxValue = customMax ?? Math.max(...data.map((d) => d.value), 1)
  const paddingTop = 20
  const paddingBottom = 24
  const chartHeight = height - paddingTop - paddingBottom
  const totalWidth = data.length * barWidth + (data.length + 1) * gap

  return (
    <svg
      width={totalWidth}
      height={height}
      viewBox={`0 0 ${totalWidth} ${height}`}
      role="img"
      aria-label="Bar chart"
      className={className}
    >
      {data.map((d, i) => {
        const x = gap + i * (barWidth + gap)
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
              className="transition-opacity duration-200 hover:opacity-80"
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
  )
}
