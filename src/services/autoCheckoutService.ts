import type { TimeEntriesData } from '../types'

const AUTO_CHECKOUT_HOUR = 21

/**
 * Auto-closes any open session whose check-in was on a past calendar day —
 * we assume the user forgot to check out. Caps the checkout at 21:00 of the
 * check-in day (or the check-in time itself if it was already later).
 *
 * Runs today as a lazy sweep on data load. Isolated from timeTrackingService
 * because this is the piece meant to become a server-side scheduled sweep
 * once there's a backend — interactive check-in/out and this correction job
 * are different bounded contexts even though they share the same data.
 */
export function closeStaleSessions(data: TimeEntriesData, todayKey: string): TimeEntriesData {
  let nextDays: TimeEntriesData['days'] | null = null

  for (const dateKey of Object.keys(data.days)) {
    if (dateKey >= todayKey) continue
    const sessions = data.days[dateKey]
    const last = sessions[sessions.length - 1]
    if (!last || last.checkOut !== null) continue

    const [y, m, d] = dateKey.split('-').map(Number)
    const cutoff = new Date(y, m - 1, d, AUTO_CHECKOUT_HOUR, 0, 0, 0).getTime()
    const checkInMs = new Date(last.checkIn).getTime()
    const checkOutMs = Math.max(checkInMs, cutoff)

    if (!nextDays) nextDays = { ...data.days }
    const updated = sessions.slice()
    updated[updated.length - 1] = {
      ...last,
      checkOut: new Date(checkOutMs).toISOString(),
      autoCheckedOut: true,
    }
    nextDays[dateKey] = updated
  }

  return nextDays ? { ...data, days: nextDays } : data
}
