import { useRef, useState } from 'react'
import type { CSSProperties, TouchEvent } from 'react'
import { getTodayKey, isWeekend } from '../utils/time'
import { dayOffFraction, dayOffBaseType, isHalfDayOff, DAY_OFF_BASE_TYPES } from '../utils/dayOff'
import type { ExportFormat } from '../services/exportService'
import type { DayEntry } from '../hooks/useTimeTracker'
import type { DayOffType, DaysOffMap } from '../types'

interface CalendarViewProps {
  allDays: DayEntry[]
  onDayClick: (key: string, dayData: DayEntry | null) => void
  daysOff?: DaysOffMap
  onBulkSetDaysOffType?: (dateKeys: string[], type: DayOffType | null) => void
  dailyTargetHours?: number
  /** Pro "export-csv"/"export-pdf"/"export-ics" features: each format is its
   *  own flag, so a user's plan can unlock them independently. Lets the user
   *  export a custom date range in whichever formats are enabled. */
  exportCsvEnabled?: boolean
  exportPdfEnabled?: boolean
  exportIcsEnabled?: boolean
  onExportRange?: (format: ExportFormat, startDate: string, endDate: string) => Promise<boolean>
  /** Free plan ('limited'): keeps calendar navigation within the current
   *  year — data for other years still exists in storage, it's just not
   *  reachable from here. null when paid gating isn't active at all. */
  historyScope?: 'limited' | 'unlimited' | null
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function metaFor(kind: DayOffType | 'weekend') {
  if (kind === 'weekend') return { emoji: '🛋️', label: 'Weekend' }
  const t = DAY_OFF_BASE_TYPES.find(x => x.base === dayOffBaseType(kind))
  if (!t) return { emoji: '❓', label: kind }
  const half = isHalfDayOff(kind)
  return { emoji: half ? `${t.emoji}½` : t.emoji, label: `${t.label}${half ? ' half' : ''} day off` }
}

function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

function buildCalendarRows(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // ISO: Monday = 1, Sunday = 7; JS: Sunday = 0, Monday = 1
  const firstDow = firstDay.getDay() // 0=Sun..6=Sat
  // Steps back to Monday: if firstDow=0 (Sun), go back 6; if 1 (Mon), go back 0
  const stepsBack = firstDow === 0 ? 6 : firstDow - 1

  const start = new Date(firstDay)
  start.setDate(start.getDate() - stepsBack)

  const cells: Date[] = []
  const cursor = new Date(start)
  // Always 6 rows × 7 = 42 cells
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  // Chunk into rows of 7
  const rows: Date[][] = []
  for (let r = 0; r < 6; r++) {
    rows.push(cells.slice(r * 7, r * 7 + 7))
  }
  return { rows, firstDay, lastDay }
}

function weekColor(totalMs: number, targetMs: number): string | null {
  if (totalMs >= targetMs) return 'var(--accent-in)'
  if (totalMs >= targetMs * 0.75) return '#fbbf24'
  if (totalMs > 0) return 'var(--accent-out)'
  return null
}

export default function CalendarView({ allDays, onDayClick, daysOff = {}, onBulkSetDaysOffType, dailyTargetHours = 8, exportCsvEnabled = false, exportPdfEnabled = false, exportIcsEnabled = false, onExportRange, historyScope = null }: CalendarViewProps) {
  const exportEnabled = exportCsvEnabled || exportPdfEnabled || exportIcsEnabled
  const restrictToCurrentYear = historyScope === 'limited'
  const today = getTodayKey()
  const [year, month] = (() => {
    const d = new Date()
    return [d.getFullYear(), d.getMonth()]
  })()
  const [currentMonth, setCurrentMonth] = useState({ year, month })
  const atMinBound = restrictToCurrentYear && currentMonth.year <= year && currentMonth.month === 0
  const atMaxBound = restrictToCurrentYear && currentMonth.year >= year && currentMonth.month === 11
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)
  const touchStartRef = useRef<{ x: number, y: number } | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [bulkHalf, setBulkHalf] = useState(false)
  const [exportPanelOpen, setExportPanelOpen] = useState(false)
  const [exportStart, setExportStart] = useState(today)
  const [exportEnd, setExportEnd] = useState(today)
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  function toggleSelectMode() {
    setSelectMode(m => {
      if (m) setSelectedKeys(new Set())
      setBulkHalf(false)
      return !m
    })
  }

  function toggleDaySelection(key: string) {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function applyBulk(type: DayOffType | null) {
    if (selectedKeys.size === 0) return
    onBulkSetDaysOffType?.(Array.from(selectedKeys), type)
    setSelectedKeys(new Set())
    setSelectMode(false)
  }

  const dayMap = new Map(allDays.map(d => [d.date, d]))

  const { rows, firstDay, lastDay } = buildCalendarRows(
    currentMonth.year,
    currentMonth.month
  )

  function prevMonth() {
    if (atMinBound) return
    setCurrentMonth(({ year, month }) => {
      if (month === 0) return { year: year - 1, month: 11 }
      return { year, month: month - 1 }
    })
  }

  function nextMonth() {
    if (atMaxBound) return
    setCurrentMonth(({ year, month }) => {
      if (month === 11) return { year: year + 1, month: 0 }
      return { year, month: month + 1 }
    })
  }

  function handleTouchStart(e: TouchEvent) {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }

  function handleTouchEnd(e: TouchEvent) {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    const SWIPE_THRESHOLD = 50
    if (Math.abs(dx) < SWIPE_THRESHOLD) return
    if (Math.abs(dy) > Math.abs(dx)) return
    if (dx < 0) nextMonth()
    else prevMonth()
  }

  function toggleExportPanel() {
    setExportPanelOpen(open => {
      if (!open) {
        // Default the range to the month currently in view.
        const first = new Date(currentMonth.year, currentMonth.month, 1)
        const last = new Date(currentMonth.year, currentMonth.month + 1, 0)
        setExportStart(toDateKey(first))
        setExportEnd(toDateKey(last))
        setExportStatus('idle')
      }
      return !open
    })
  }

  async function handleExportRange(format: ExportFormat) {
    if (!onExportRange || exportStart > exportEnd) {
      setExportStatus('error')
      return
    }
    setExportStatus('loading')
    const ok = await onExportRange(format, exportStart, exportEnd)
    setExportStatus(ok ? 'idle' : 'error')
  }

  return (
    <div className="cal-container">
      <div className="cal-nav">
        <div className="cal-nav-group">
          <button type="button" className="cal-nav-btn" onClick={prevMonth} disabled={atMinBound} aria-label="Previous month" title={atMinBound ? 'Upgrade to Pro to view past years' : undefined}>‹</button>
          <span className="cal-month-label">
            {getMonthLabel(currentMonth.year, currentMonth.month)}
          </span>
          <button type="button" className="cal-nav-btn" onClick={nextMonth} disabled={atMaxBound} aria-label="Next month">›</button>
        </div>
        <div className="cal-nav-actions">
          <button
            type="button"
            className={`cal-nav-export${selectMode ? ' cal-nav-export--active' : ''}`}
            onClick={toggleSelectMode}
            title={selectMode ? 'Exit selection mode' : 'Select multiple days to mark as off'}
            aria-pressed={selectMode}
          >
            {selectMode ? 'Cancel' : 'Select'}
          </button>
          {exportEnabled && (
            <button
              type="button"
              className={`cal-nav-export${exportPanelOpen ? ' cal-nav-export--active' : ''}`}
              onClick={toggleExportPanel}
              disabled={selectMode}
              title="Export a custom date range as CSV, PDF, or ICS"
              aria-pressed={exportPanelOpen}
            >
              <span className="settings-sync-star" aria-hidden="true">✦</span> Export…
            </button>
          )}
        </div>
      </div>

      {(atMinBound || atMaxBound) && (
        <p className="settings-note cal-scope-note">
          Free plan shows {year} only — <span className="settings-sync-star" aria-hidden="true">✦</span> Pro unlocks past and future years.
        </p>
      )}

      {exportEnabled && exportPanelOpen && (
        <div className="cal-export-panel" role="region" aria-label="Export date range">
          <div className="cal-export-panel__dates">
            <label className="cal-export-panel__field">
              <span>From</span>
              <input
                type="date"
                value={exportStart}
                max={exportEnd}
                onChange={e => setExportStart(e.target.value)}
              />
            </label>
            <label className="cal-export-panel__field">
              <span>To</span>
              <input
                type="date"
                value={exportEnd}
                min={exportStart}
                onChange={e => setExportEnd(e.target.value)}
              />
            </label>
          </div>
          <div className="cal-export-panel__actions">
            {exportCsvEnabled && (
              <button type="button" className="cal-export-panel__btn" onClick={() => handleExportRange('csv')} disabled={exportStatus === 'loading'}>
                CSV
              </button>
            )}
            {exportPdfEnabled && (
              <button type="button" className="cal-export-panel__btn" onClick={() => handleExportRange('pdf')} disabled={exportStatus === 'loading'}>
                PDF
              </button>
            )}
            {exportIcsEnabled && (
              <button type="button" className="cal-export-panel__btn" onClick={() => handleExportRange('ics')} disabled={exportStatus === 'loading'}>
                ICS
              </button>
            )}
          </div>
          {exportStatus === 'loading' && <p className="cal-export-panel__status">Generating export…</p>}
          {exportStatus === 'error' && <p className="cal-export-panel__status cal-export-panel__status--error">Export failed. Check the date range and try again.</p>}
        </div>
      )}

      <div
        className="cal-grid"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header row */}
        <div className="cal-header-row">
          {DAY_LABELS.map(d => (
            <div key={d} className="cal-header-cell">{d}</div>
          ))}
          <div className="cal-header-cell cal-week-header">Week</div>
        </div>

        {/* Day rows */}
        {rows.map((row) => {
          // Use raw ms for both comparison and display to match the track page
          const weekTotalMs = row.reduce((sum, date) => {
            const key = toDateKey(date)
            return sum + (dayMap.get(key)?.totalMs ?? 0)
          }, 0)
          const weekTotal = weekTotalMs / 3600000
          // row[0..4] = Mon–Fri; only weekdays count toward target
          const daysOffSum = row.slice(0, 5).reduce((sum, d) => sum + dayOffFraction(daysOff[toDateKey(d)]), 0)
          const weekTarget = (5 - daysOffSum) * dailyTargetHours

          // For the current week, prorate the target based on workdays elapsed so far
          const isCurrentWeek = row.some(date => toDateKey(date) === today)
          let effectiveTarget = weekTarget
          if (isCurrentWeek) {
            const daysElapsed = row.slice(0, 5).reduce((sum, d) => {
              const key = toDateKey(d)
              if (isWeekend(key) || key > today) return sum
              return sum + (1 - dayOffFraction(daysOff[key]))
            }, 0)
            effectiveTarget = daysElapsed * dailyTargetHours
          }

          const effectiveTargetMs = effectiveTarget * 3600000
          const weekTargetMs = weekTarget * 3600000
          const color = weekColor(weekTotalMs, effectiveTargetMs)
          const pct = weekTargetMs > 0 ? Math.min((weekTotalMs / weekTargetMs) * 100, 100) : 0

          return (
            <div key={toDateKey(row[0])} className="cal-row">
              {row.map(date => {
                const key = toDateKey(date)
                const isCurrentMonth = date >= firstDay && date <= lastDay
                const isToday = key === today
                const dayData = dayMap.get(key)
                const isWeekendDay = isWeekend(key)
                const isDayOff = !!daysOff[key] || isWeekendDay
                const isFullyOff = dayOffFraction(daysOff[key]) === 1 || isWeekendDay
                const hasSessions = !isFullyOff && dayData && dayData.sessions.length > 0

                const autoCheckedOut = !isFullyOff && !!dayData?.autoCheckedOut
                const isSelectable = selectMode && !isWeekendDay
                const isSelected = selectedKeys.has(key)

                let cls = 'cal-day'
                if (!isCurrentMonth) cls += ' cal-day--other-month'
                if (isToday) cls += ' cal-day--today'
                if (hasSessions) cls += ' cal-day--has-sessions'
                if (isDayOff) cls += ' cal-day--day-off'
                if (autoCheckedOut) cls += ' cal-day--auto-checkout'
                if (selectMode && !isSelectable) cls += ' cal-day--unselectable'
                if (isSelected) cls += ' cal-day--selected'

                function handleClick() {
                  if (selectMode) {
                    if (isSelectable) toggleDaySelection(key)
                    return
                  }
                  onDayClick(key, dayData ?? null)
                }

                return (
                  <button
                    type="button"
                    key={key}
                    className={cls}
                    onClick={handleClick}
                    onMouseEnter={() => !selectMode && hasSessions && setHoveredDay(key)}
                    onMouseLeave={() => setHoveredDay(null)}
                  >
                    <span className="cal-day-num">{date.getDate()}</span>
                    {isDayOff && (() => {
                      const kind = daysOff[key] || 'weekend'
                      const { emoji, label } = metaFor(kind)
                      return (
                        <span
                          className="cal-day-off-badge cal-day-off-badge--emoji"
                          aria-label={label}
                          title={label}
                        >
                          {emoji}
                        </span>
                      )
                    })()}
                    {!isDayOff && hasSessions && <span className="cal-day-dot" />}
                    {autoCheckedOut && (
                      <span
                        className="cal-day-warn"
                        aria-label="Auto-checked-out — verify hours"
                        title="Auto-checked-out at 21:00"
                      >⚠</span>
                    )}
                    {!selectMode && hasSessions && hoveredDay === key && (
                      <div className="cal-day-tooltip">
                        <strong>{dayData.totalDecimal.toFixed(1)}h</strong>
                        <span> · {dayData.sessions.length} session{dayData.sessions.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </button>
                )
              })}

              {/* Week summary */}
              <div className="cal-week-summary">
                {weekTotal > 0 ? (
                  <>
                    <div className="cal-week-total" style={{ color: color ?? 'var(--text-muted)' }}>
                      {weekTotal.toFixed(1)}h
                    </div>
                    <div className="cal-week-sub">/ {weekTarget}h</div>
                    <div className="cal-week-bar-track">
                      <div
                        className="cal-week-bar-fill"
                        style={{ width: `${pct}%`, background: color ?? 'var(--text-muted)' }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="cal-week-empty">--</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selectMode && (
        <div className="cal-bulk-bar" role="toolbar" aria-label="Bulk day-off actions">
          <span className="cal-bulk-count">
            {selectedKeys.size} day{selectedKeys.size === 1 ? '' : 's'} selected
          </span>
          <div className="cal-bulk-actions">
            <div className="dayoff-picker">
              <fieldset className="dayoff-picker__segments">
                <legend className="sr-only">Day off type</legend>
                {DAY_OFF_BASE_TYPES.map(t => (
                  <button
                    key={t.base}
                    type="button"
                    className="dayoff-seg"
                    style={{ '--seg-accent': t.color } as CSSProperties}
                    onClick={() => applyBulk(t.allowsHalf && bulkHalf ? `${t.base}-half` : t.base)}
                    disabled={selectedKeys.size === 0}
                    title={t.note}
                  >
                    <span>{t.emoji}</span> {t.label}
                  </button>
                ))}
              </fieldset>
              <button
                type="button"
                className={`dayoff-half-toggle${bulkHalf ? ' dayoff-half-toggle--active' : ''}`}
                onClick={() => setBulkHalf(h => !h)}
                aria-pressed={bulkHalf}
                title="Apply as half day"
              >
                ½ Half day
              </button>
            </div>
            <button
              type="button"
              className="cal-bulk-btn cal-bulk-btn--clear"
              onClick={() => applyBulk(null)}
              disabled={selectedKeys.size === 0}
              title="Clear day-off marker"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
