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

    // `Math.max(checkInMs, cutoff)` alone produced a session of exactly zero
    // milliseconds for any check-in after the cutoff hour: a shift started at
    // 22:00 got a checkout of 22:00, so a whole night's work was silently
    // recorded as no work at all. Falling back to the end of the check-in day
    // is still an estimate, but it errs towards preserving the shift rather
    // than deleting it, and autoCheckedOut below marks it for the user to
    // correct. (The common cross-midnight case no longer reaches here at all —
    // checkOut() now closes a session started on a previous day.)
    const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
    const checkOutMs = checkInMs >= cutoff ? Math.max(checkInMs, endOfDay) : cutoff

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
