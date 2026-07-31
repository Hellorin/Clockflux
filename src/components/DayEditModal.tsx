import { useState, useEffect, useCallback } from 'react'
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

function hhmmToISO(dateKey: string, hhmm: string): string {
  const [y, mo, d] = dateKey.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  return new Date(y, mo - 1, d, h, min).toISOString()
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

  function handleSave() {
    const newSessions = rows
      .filter(r => r.checkIn !== '')
      .map(r => ({
        checkIn: hhmmToISO(dateKey, r.checkIn),
        checkOut: r.checkOut ? hhmmToISO(dateKey, r.checkOut) : null
      }))
    onSave(dateKey, newSessions)
  }

  return (
    <div className="modal-backdrop">
      <button type="button" className="modal-backdrop__scrim" onClick={onClose} aria-label="Close dialog" />
      <div className="modal" role="dialog" aria-modal="true" aria-label={formatDateKey(dateKey)}>
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
          {rows.map(row => (
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
              <button type="button" className="modal-delete-btn" onClick={() => deleteRow(row.id)} aria-label="Delete session">×</button>
            </div>
          ))}
        </div>

        <button type="button" className="modal-add-btn" onClick={addSession} disabled={isFullDayOff}>+ Add Session</button>

        <div className="modal-actions">
          <button type="button" className="modal-save-btn" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
