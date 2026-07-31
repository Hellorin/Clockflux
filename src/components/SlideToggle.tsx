import { useRef, useState } from 'react'
import type { KeyboardEvent, TouchEvent } from 'react'
import { formatTime } from '../utils/time'
import type { Session } from '../types'

interface SlideToggleProps {
  isCheckedIn: boolean
  onCheckIn: () => void
  onCheckOut: () => void
  todaySessions: Session[]
  isTodayOff: boolean
}

// Knob left positions (px) matching the CSS rules
const KNOB_REST = 4
const KNOB_WORK = 140  // calc(50%) of 280px track
const MIDPOINT  = (KNOB_REST + KNOB_WORK) / 2  // 72px — past here = "working"

export default function SlideToggle({ isCheckedIn, onCheckIn, onCheckOut, todaySessions, isTodayOff }: SlideToggleProps) {
  const lastSession = todaySessions[todaySessions.length - 1]
  let lastActionTime: string | null = null
  if (lastSession) {
    // !isCheckedIn implies the last session has already been closed (checkOut is set)
    lastActionTime = isCheckedIn ? formatTime(lastSession.checkIn) : formatTime(lastSession.checkOut!)
  }

  const isDisabled = isTodayOff && !isCheckedIn

  // Drag state stored in a ref to avoid re-render overhead during move
  const drag = useRef({ startX: 0, startLeft: 0, moved: false, currentLeft: 0, wasDrag: false })
  // knobLeft drives an inline style override during drag; null = CSS class controls position
  const [knobLeft, setKnobLeft] = useState<number | null>(null)

  function toggle() {
    if (isDisabled) return
    if (isCheckedIn) onCheckOut()
    else onCheckIn()
  }

  function handleClick() {
    // Suppress the synthetic click that follows a touch drag
    if (drag.current.wasDrag) {
      drag.current.wasDrag = false
      return
    }
    toggle()
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
  }

  function handleTouchStart(e: TouchEvent) {
    if (isDisabled) return
    const t = e.touches[0]
    drag.current.startX      = t.clientX
    drag.current.startLeft   = isCheckedIn ? KNOB_WORK : KNOB_REST
    drag.current.moved       = false
    drag.current.currentLeft = drag.current.startLeft
    document.documentElement.classList.add('theme-dragging')
  }

  function handleTouchMove(e: TouchEvent) {
    if (isDisabled) return
    const delta   = e.touches[0].clientX - drag.current.startX
    const newLeft = Math.max(KNOB_REST, Math.min(KNOB_WORK, drag.current.startLeft + delta))

    if (Math.abs(delta) > 4) drag.current.moved = true
    drag.current.currentLeft = newLeft
    setKnobLeft(newLeft)

    // Drive the global theme gradient in real time
    const progress = (newLeft - KNOB_REST) / (KNOB_WORK - KNOB_REST)
    document.documentElement.style.setProperty('--theme-mix', `${(progress * 100).toFixed(1)}%`)
  }

  function handleTouchEnd() {
    // Re-enable the transition so the theme snaps smoothly to 0% or 100%
    document.documentElement.classList.remove('theme-dragging')

    if (!drag.current.moved) {
      // Tiny movement — treat as a tap; let the click handler fire normally
      document.documentElement.style.removeProperty('--theme-mix')
      setKnobLeft(null)
      return
    }

    const shouldBeWorking = drag.current.currentLeft > MIDPOINT
    drag.current.wasDrag = true
    drag.current.moved   = false
    setKnobLeft(null)

    // Remove inline override — data-theme attribute (set by App.jsx) takes over
    // and the css transition animates from wherever the drag left off
    document.documentElement.style.removeProperty('--theme-mix')

    if (shouldBeWorking !== isCheckedIn) toggle()
  }

  const knobStyle = knobLeft !== null ? { left: `${knobLeft}px`, transition: 'none' } : undefined

  return (
    <div className="action-section">
      <div
        className={[
          'slide-toggle',
          isCheckedIn ? 'slide-toggle--working' : 'slide-toggle--resting',
          isDisabled ? 'slide-toggle--disabled' : ''
        ].join(' ')}
        role="switch"
        aria-checked={isCheckedIn}
        aria-disabled={isDisabled}
        aria-label={isCheckedIn ? 'Working — click to check out' : 'Resting — click to check in'}
        tabIndex={isDisabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <span className="slide-toggle__label slide-toggle__label--resting">🛋️ Resting</span>
        <span className="slide-toggle__knob" style={knobStyle}>
          <span className="slide-toggle__emoji" aria-hidden="true">
            {isCheckedIn ? '🏃' : '🛋️'}
          </span>
        </span>
        <span className="slide-toggle__label slide-toggle__label--working">Working 🏃</span>
      </div>
      {lastActionTime && (
        <p className="last-action">
          {isCheckedIn ? 'Checked in at' : 'Checked out at'} <strong>{lastActionTime}</strong>
        </p>
      )}
    </div>
  )
}
