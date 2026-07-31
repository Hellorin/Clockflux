import { useState, useEffect } from 'react'
import { formatDuration } from '../utils/time'
import type { Session } from '../types'

interface LiveTimerProps {
  isCheckedIn: boolean
  todaySessions: Session[]
}

export default function LiveTimer({ isCheckedIn, todaySessions }: LiveTimerProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isCheckedIn) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isCheckedIn])

  if (!isCheckedIn) return null

  const openSession = todaySessions[todaySessions.length - 1]
  if (!openSession) return null

  const elapsed = Math.max(0, now - new Date(openSession.checkIn).getTime())

  return (
    <div className="live-timer" aria-live="polite" aria-atomic="true">
      <span className="live-dot" aria-hidden="true" />
      <span className="live-duration">{formatDuration(elapsed)}</span>
      <span className="live-label">current session</span>
    </div>
  )
}
