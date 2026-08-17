import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import type { Milestone } from '../hooks/useTimeTracker'

interface CelebrationOverlayProps {
  milestone: Milestone | null
  onDismiss: () => void
  /** The user's own target, so the message doesn't claim 8 hours to someone on 6. */
  dailyTargetHours?: number
}

function messagesFor(dailyTargetHours: number): Record<Milestone, { icon: string, title: string, sub: string }> {
  const hours = Number.isInteger(dailyTargetHours) ? dailyTargetHours : dailyTargetHours.toFixed(1)
  return {
    daily: { icon: '🎯', title: 'Daily goal smashed!', sub: `You've hit ${hours} hours today.` },
    weekly: { icon: '🏆', title: 'Weekly target reached!', sub: "You've hit your prorated weekly target." },
  }
}

export default function CelebrationOverlay({ milestone, onDismiss, dailyTargetHours = 8 }: CelebrationOverlayProps) {
  const firedRef = useRef(false)

  useEffect(() => {
    // Reset when the overlay closes. firedRef was previously set once and never
    // cleared, so the *second* milestone of a session early-returned here —
    // meaning no confetti, and, worse, no setTimeout(onDismiss) either, leaving
    // celebrationMilestone non-null indefinitely. Hit your daily goal on Monday
    // and nothing ever celebrated again until a reload.
    if (!milestone) {
      firedRef.current = false
      return
    }
    if (firedRef.current) return
    firedRef.current = true

    if (milestone === 'weekly') {
      confetti({ particleCount: 120, spread: 70, origin: { x: 0.2, y: 0.6 } })
      confetti({ particleCount: 120, spread: 70, origin: { x: 0.8, y: 0.6 } })
    } else {
      confetti({ particleCount: 80, spread: 60, origin: { x: 0.5, y: 0.4 } })
    }

    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [milestone, onDismiss])

  if (!milestone) return null

  const { icon, title, sub } = messagesFor(dailyTargetHours)[milestone]

  return (
    <div className="celebration-overlay" role="status" aria-live="polite">
      <div className="celebration-card">
        <div className="celebration-icon">{icon}</div>
        <h2 className="celebration-title">{title}</h2>
        <p className="celebration-sub">{sub}</p>
      </div>
    </div>
  )
}
