import { useMemo } from 'react'
import type { OvertimeSeriesPoint } from '../utils/stats'

interface OvertimeChartProps {
  series: OvertimeSeriesPoint[] | undefined
}

interface Point {
  x: number
  y: number
  v: number
}

interface MonthLabel {
  x: number
  label: string
}

interface Segment {
  positive: boolean
  pts: { x: number, y: number }[]
}

const W = 300
const H = 110
const PAD = { t: 10, r: 8, b: 22, l: 30 }
const CW = W - PAD.l - PAD.r
const CH = H - PAD.t - PAD.b

export default function OvertimeChart({ series }: OvertimeChartProps) {
  const memoData = useMemo(() => {
    if (!series || series.length < 2) return null

    const n = series.length
    const values = series.map(d => d.cumulative)
    const minVal = Math.min(0, ...values)
    const maxVal = Math.max(0, ...values)
    const range = maxVal - minVal || 1

    const xAt = (i: number) => PAD.l + (i / (n - 1)) * CW
    const yAt = (v: number) => PAD.t + CH * (1 - (v - minVal) / range)

    const points: Point[] = series.map((d, i) => ({ x: xAt(i), y: yAt(d.cumulative), v: d.cumulative }))

    // Month labels: show label only when month changes
    const monthLabels: MonthLabel[] = []
    let lastMonth: string | null = null
    series.forEach((d, i) => {
      const m = d.weekKey.slice(0, 7) // "YYYY-MM"
      if (m !== lastMonth) {
        const [, month] = m.split('-').map(Number)
        const shortMonth = new Date(2000, month - 1, 1).toLocaleDateString(undefined, { month: 'short' })
        monthLabels.push({ x: xAt(i), label: shortMonth })
        lastMonth = m
      }
    })

    // Split polyline into positive/negative segments so each gets its own color.
    // A "segment" is a run of consecutive points on the same side of zero.
    const segments: Segment[] = []
    let current: Segment | null = null
    for (let i = 0; i < points.length; i++) {
      const positive = points[i].v >= 0
      if (current === null || current.positive !== positive) {
        // If crossing zero, insert an interpolated zero-crossing point so lines meet on the axis.
        if (current && i > 0) {
          const prev = points[i - 1]
          const curr = points[i]
          const t = Math.abs(prev.v) / (Math.abs(prev.v) + Math.abs(curr.v))
          const zx = prev.x + t * (curr.x - prev.x)
          const zy = yAt(0)
          current.pts.push({ x: zx, y: zy })
          current = { positive, pts: [{ x: zx, y: zy }, points[i]] }
        } else {
          current = { positive, pts: [points[i]] }
        }
        segments.push(current)
      } else {
        current.pts.push(points[i])
      }
    }

    return { points, minVal, maxVal, yAt, monthLabels, segments }
  }, [series])

  if (!memoData) return null

  const { points, minVal, maxVal, yAt, monthLabels, segments } = memoData

  const yZero = yAt(0)

  const fmtHours = (v: number) => {
    const abs = Math.abs(v)
    const h = Math.floor(abs)
    const m = Math.round((abs - h) * 60)
    const sign = v < 0 ? '-' : '+'
    return m > 0 ? `${sign}${h}h${m}m` : `${sign}${h}h`
  }

  const ptsStr = (pts: { x: number, y: number }[]) => pts.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="overtime-chart" aria-hidden="true">
      {/* Horizontal grid lines + Y labels */}
      {[minVal, 0, maxVal].filter((v, i, a) => a.indexOf(v) === i).map(v => (
        <g key={v}>
          <line x1={PAD.l} y1={yAt(v)} x2={W - PAD.r} y2={yAt(v)} className="overtime-chart__grid" />
          <text x={PAD.l - 3} y={yAt(v)} textAnchor="end" dominantBaseline="middle" className="overtime-chart__axis-label">
            {fmtHours(v)}
          </text>
        </g>
      ))}

      {/* Zero reference line */}
      {minVal < 0 && maxVal > 0 && (
        <line x1={PAD.l} y1={yZero} x2={W - PAD.r} y2={yZero} className="overtime-chart__zero-line" />
      )}

      {/* Data segments colored by sign */}
      {segments.map(seg => (
        <polyline
          key={`${seg.positive}-${seg.pts[0].x}`}
          points={ptsStr(seg.pts)}
          className={`overtime-chart__line overtime-chart__line--${seg.positive ? 'positive' : 'negative'}`}
        />
      ))}

      {/* Last data point marker */}
      {points.length > 0 && (
        <line
          x1={points[points.length - 1].x}
          y1={PAD.t}
          x2={points[points.length - 1].x}
          y2={H - PAD.b}
          className="overtime-chart__today-line"
        />
      )}

      {/* Month labels on X axis */}
      {monthLabels.map(ml => (
        <text key={ml.x} x={ml.x} y={H - 5} textAnchor="middle" className="overtime-chart__week-label">
          {ml.label}
        </text>
      ))}
    </svg>
  )
}
