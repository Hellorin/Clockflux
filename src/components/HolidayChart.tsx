import { useMemo } from 'react'
import { formatHolidayDays } from '../utils/holidays'
import { dayOffBaseType, dayOffFraction } from '../utils/dayOff'
import { getAccruedDays } from '../services/ptoService'
import type { DaysOffMap, HolidayAccrualMode } from '../types'

interface HolidayChartProps {
  daysOff: DaysOffMap
  allowance: number
  startDate: string | null
  accrualMode: HolidayAccrualMode
}

const MONTH_LABELS = ['J','F','M','A','M','J','J','A','S','O','N','D']

const W = 300
const H = 110
const PAD = { t: 22, r: 8, b: 22, l: 26 }
const CW = W - PAD.l - PAD.r
const CH = H - PAD.t - PAD.b
const LEGEND_Y = 8

export default function HolidayChart({ daysOff, allowance, startDate, accrualMode }: HolidayChartProps) {
  const today = new Date()
  const year = today.getFullYear()
  const currentM = today.getMonth()

  // First month to show: honour startDate if it falls within the current year.
  const startMonth = useMemo(() => {
    if (!startDate) return 0
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate)
    if (!m) return 0
    const y = Number(m[1])
    if (y !== year) return 0
    return Number(m[2]) - 1
  }, [startDate, year])

  const data = useMemo(() => {
    return Array.from({ length: 12 - startMonth }, (_, idx) => {
      const i = startMonth + idx
      const monthEnd = new Date(year, i + 1, 0)
      const monthEndKey = `${year}-${String(i + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`
      const earned = getAccruedDays(startDate, allowance, monthEnd, accrualMode)
      const used = Object.entries(daysOff).reduce((n, [k, v]) => {
        if (dayOffBaseType(v) !== 'personal' || !k.startsWith(`${year}-`)) return n
        return k <= monthEndKey ? n + dayOffFraction(v) : n
      }, 0)
      return { month: i, earned, used }
    })
  }, [daysOff, startDate, allowance, year, startMonth, accrualMode])

  const maxY = Math.max(...data.map(d => Math.max(d.earned, d.used)), 1)

  const span = Math.max(data.length - 1, 1)
  const xAt = (i: number) => PAD.l + ((i - startMonth) / span) * CW
  const yAt = (v: number) => PAD.t + CH * (1 - v / maxY)

  const pastData = data.filter(d => d.month <= currentM)
  const futureData = data.filter(d => d.month >= currentM)
  const earnedPast = pastData.map(d => `${xAt(d.month)},${yAt(d.earned)}`).join(' ')
  const earnedFuture = futureData.map(d => `${xAt(d.month)},${yAt(d.earned)}`).join(' ')
  const usedPast = pastData.map(d => `${xAt(d.month)},${yAt(d.used)}`).join(' ')
  const usedFuture = futureData.map(d => `${xAt(d.month)},${yAt(d.used)}`).join(' ')

  const yTicks = [0, maxY / 2, maxY]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="holiday-chart" aria-hidden="true">
      {/* Horizontal grid lines + Y labels */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PAD.l} y1={yAt(v)} x2={W - PAD.r} y2={yAt(v)} className="holiday-chart__grid" />
          <text x={PAD.l - 3} y={yAt(v)} textAnchor="end" dominantBaseline="middle" className="holiday-chart__axis-label">
            {formatHolidayDays(v)}
          </text>
        </g>
      ))}

      {/* Earned line */}
      {earnedPast && <polyline points={earnedPast} className="holiday-chart__earned" />}
      {earnedFuture && <polyline points={earnedFuture} className="holiday-chart__earned holiday-chart__earned--future" />}

      {/* Used/planned line */}
      {usedPast && <polyline points={usedPast} className="holiday-chart__used-line" />}
      {usedFuture && <polyline points={usedFuture} className="holiday-chart__used-line holiday-chart__used-line--future" />}

      {/* Today vertical marker */}
      {currentM >= startMonth && (
        <line x1={xAt(currentM)} y1={PAD.t} x2={xAt(currentM)} y2={H - PAD.b} className="holiday-chart__today-line" />
      )}

      {/* Month labels */}
      {data.map(({ month: i }) => (
        <text
          key={i}
          x={xAt(i)}
          y={H - 5}
          textAnchor="middle"
          className={`holiday-chart__month-label${i === currentM ? ' holiday-chart__month-label--current' : ''}`}
        >
          {MONTH_LABELS[i]}
        </text>
      ))}

      {/* Legend */}
      <circle cx={W - PAD.r - 80} cy={LEGEND_Y} r={2.5} className="holiday-chart__legend-earned" />
      <text x={W - PAD.r - 75} y={LEGEND_Y + 2} className="holiday-chart__axis-label">Earned</text>
      <circle cx={W - PAD.r - 38} cy={LEGEND_Y} r={2.5} className="holiday-chart__legend-used" />
      <text x={W - PAD.r - 33} y={LEGEND_Y + 2} className="holiday-chart__axis-label">Used</text>
    </svg>
  )
}
