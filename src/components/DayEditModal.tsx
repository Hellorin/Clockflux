import { useState, useEffect, useCallback } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { CSSProperties } from 'react'
import { formatDateKey, isWeekend } from '../utils/time'
import { isHalfDayOff, dayOffBaseType, DAY_OFF_BASE_TYPES } from '../utils/dayOff'
import type { DayOffType, Session } from '../types'

interface DayEditModalProps {
  dateKey: string
  sessions: Session[]
  onSave: (dateKey: string, sessions: Session[]) => void
  onClose: () => void
  dayOffType?: DayOffType | null
  onSetDayOffType: (type: DayOffType | null) => void
}

interface Row {
  id: number
  checkIn: string
  checkOut: string
}

function isoToHHMM(iso: string): string {
  const d = new Date(iso)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

// dayOffset exists so a session can end on the day *after* the one being
// edited. Without it both ends were pinned to dateKey, which made an overnight
// shift (23:00 → 01:00) structurally impossible to record: it came out as a
// negative span, sumSessionsMs clamped it with Math.max(0, …), and the day
// silently displayed 0h.
function hhmmToDate(dateKey: string, hhmm: string, dayOffset = 0): Date {
  const [y, mo, d] = dateKey.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  return new Date(y, mo - 1, d + dayOffset, h, min)
}

/** A row resolved to real timestamps, with overnight roll-over applied. */
interface ParsedRow {
  id: number
  startMs: number
  /** null for a session that is still open (no check-out entered). */
  endMs: number | null
  /** True when the check-out was earlier in the clock than the check-in. */
  rollsOver: boolean
}

function parseRow(dateKey: string, row: Row): ParsedRow | null {
  if (!row.checkIn) return null
  const start = hhmmToDate(dateKey, row.checkIn)
  if (!row.checkOut) return { id: row.id, startMs: start.getTime(), endMs: null, rollsOver: false }

  const sameDayEnd = hhmmToDate(dateKey, row.checkOut)
  // An end earlier than the start is read as "the next morning" rather than
  // rejected, so night shifts are expressible. The row shows a "+1d" marker and
  // the resulting duration, so a genuine typo is visible rather than silent.
  const rollsOver = sameDayEnd.getTime() <= start.getTime()
  const end = rollsOver ? hhmmToDate(dateKey, row.checkOut, 1) : sameDayEnd
  return { id: row.id, startMs: start.getTime(), endMs: end.getTime(), rollsOver }
}

/**
 * Returns a human-readable problem with the set of rows, or null if they're
 * fine. Previously handleSave did no validation at all, so overlapping sessions
 * were accepted and double-counted, and a check-out with no check-in was
 * silently dropped on save with the user believing it had been recorded.
 */
function validateRows(dateKey: string, rows: Row[]): string | null {
  if (rows.some(r => !r.checkIn && r.checkOut)) {
    return 'Every session needs a check-in time.'
  }

  const parsed = rows
    .map(r => parseRow(dateKey, r))
    .filter((r): r is ParsedRow => r !== null)
    .sort((a, b) => a.startMs - b.startMs)

  const openCount = parsed.filter(r => r.endMs === null).length
  if (openCount > 1) {
    return 'Only one session can be left running.'
  }
  if (openCount === 1 && parsed[parsed.length - 1].endMs !== null) {
    return 'A session left running must be the last one of the day.'
  }

  for (let i = 1; i < parsed.length; i++) {
    const prev = parsed[i - 1]
    // An open session has no end, so anything starting after it overlaps it.
    if (prev.endMs === null || parsed[i].startMs < prev.endMs) {
      return 'Sessions overlap — each one has to start after the previous ends.'
    }
  }

  return null
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function currentHHMM(): string {
  const d = new Date()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function nextRowId(existingRows: Row[]): number {
  return existingRows.reduce((max, r) => Math.max(max, r.id), -1) + 1
}

export default function DayEditModal({ dateKey, sessions, onSave, onClose, dayOffType = null, onSetDayOffType }: DayEditModalProps) {
  const DEFAULT_ROWS = [
    { checkIn: '08:00', checkOut: '12:00' },
    { checkIn: '13:00', checkOut: '17:00' },
  ]

  const isWeekendDay = isWeekend(dateKey)
  // A half day off still expects the other half to be worked, so sessions
  // stay editable; only a full day off (or weekend) disables them.
  const isFullDayOff = (!!dayOffType && !isHalfDayOff(dayOffType)) || isWeekendDay

  const activeBase = dayOffType ? dayOffBaseType(dayOffType) : null
  const activeHalf = dayOffType ? isHalfDayOff(dayOffType) : false
  const activeMeta = DAY_OFF_BASE_TYPES.find(t => t.base === activeBase)

  function selectBase(base: DayOffType) {
    if (activeBase === base) { onSetDayOffType(null); return }
    const t = DAY_OFF_BASE_TYPES.find(x => x.base === base)
    onSetDayOffType(activeHalf && t?.allowsHalf ? (`${base}-half` as DayOffType) : base)
  }

  function toggleHalf() {
    if (!activeMeta?.allowsHalf || !activeBase) return
    onSetDayOffType(activeHalf ? activeBase : (`${activeBase}-half` as DayOffType))
  }

  const [rows, setRows] = useState<Row[]>(() => {
    if (sessions.length > 0) {
      return sessions.map((s, i) => ({
        id: i,
        checkIn: s.checkIn ? isoToHHMM(s.checkIn) : '',
        checkOut: s.checkOut ? isoToHHMM(s.checkOut) : ''
      }))
    }
    return isFullDayOff ? [] : DEFAULT_ROWS.map((r, i) => ({ id: i, ...r }))
  })

  // Confines Tab to the dialog and restores focus on close — it declared
  // aria-modal="true" but Tab walked straight out into the page behind.
  const dialogRef = useFocusTrap<HTMLDivElement>()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  function updateRow(id: number, field: 'checkIn' | 'checkOut', value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function deleteRow(id: number) {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  function addSession() {
    setRows(prev => [...prev, { id: nextRowId(prev), checkIn: currentHHMM(), checkOut: '' }])
  }

  const validationError = validateRows(dateKey, rows)

  function handleSave() {
    if (validationError) return
    const newSessions = rows
      .filter(r => r.checkIn !== '')
      .map(r => {
        const parsed = parseRow(dateKey, r)!
        return {
          checkIn: new Date(parsed.startMs).toISOString(),
          checkOut: parsed.endMs === null ? null : new Date(parsed.endMs).toISOString(),
        }
      })
    onSave(dateKey, newSessions)
  }

  return (
    <div className="modal-backdrop">
      <button type="button" className="modal-backdrop__scrim" onClick={onClose} aria-label="Close dialog" />
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label={formatDateKey(dateKey)}>
        <div className="modal-header">
          <span className="modal-title">{formatDateKey(dateKey)}</span>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-day-off-row">
          {isWeekendDay ? (
            <span className="modal-day-off-btn modal-day-off-btn--active modal-day-off-btn--static">Weekend</span>
          ) : (
            <div className="dayoff-picker">
              <fieldset className="dayoff-picker__segments">
                <legend className="sr-only">Day off type</legend>
                {DAY_OFF_BASE_TYPES.map(t => (
                  <button
                    key={t.base}
                    type="button"
                    className={`dayoff-seg${activeBase === t.base ? ' dayoff-seg--active' : ''}`}
                    style={{ '--seg-accent': t.color } as CSSProperties}
                    onClick={() => selectBase(t.base)}
                    title={t.note}
                  >
                    <span>{t.emoji}</span> {t.label}
                  </button>
                ))}
              </fieldset>
              <button
                type="button"
                className={`dayoff-half-toggle${activeHalf ? ' dayoff-half-toggle--active' : ''}`}
                style={activeMeta ? ({ '--seg-accent': activeMeta.color } as CSSProperties) : undefined}
                onClick={toggleHalf}
                disabled={!activeMeta?.allowsHalf}
                aria-pressed={activeHalf}
                title="Toggle half day"
              >
                ½ Half day
              </button>
            </div>
          )}
        </div>

        <div className={`modal-sessions${isFullDayOff ? ' modal-sessions--dimmed' : ''}`}>
          {rows.length === 0 && (
            <p className="modal-empty">No sessions. Add one below.</p>
          )}
          {rows.map(row => {
            const parsed = parseRow(dateKey, row)
            return (
              <div key={row.id} className="modal-session-row">
                <input
                  type="time"
                  value={row.checkIn}
                  onChange={e => updateRow(row.id, 'checkIn', e.target.value)}
                  aria-label="Check-in time"
                />
                <span className="modal-sep">→</span>
                <input
                  type="time"
                  value={row.checkOut}
                  onChange={e => updateRow(row.id, 'checkOut', e.target.value)}
                  aria-label="Check-out time"
                  placeholder="open"
                />
                {/* The computed span, so an inverted or mistyped time is
                    visible immediately rather than showing up later as a day
                    that mysteriously totals 0h. */}
                {parsed?.endMs != null && (
                  <span className="modal-session-duration">
                    {parsed.rollsOver && <span className="modal-session-nextday" title="Ends the next day">+1d</span>}
                    {formatDuration(parsed.endMs - parsed.startMs)}
                  </span>
                )}
                <button type="button" className="modal-delete-btn" onClick={() => deleteRow(row.id)} aria-label="Delete session">×</button>
              </div>
            )
          })}
        </div>

        <button type="button" className="modal-add-btn" onClick={addSession} disabled={isFullDayOff}>+ Add Session</button>

        {validationError && <p className="modal-validation-error" role="alert">{validationError}</p>}

        <div className="modal-actions">
          <button
            type="button"
            className="modal-save-btn"
            onClick={handleSave}
            disabled={validationError !== null}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
