export type DayOffBaseType = 'personal' | 'sick' | 'official' | 'unpaid'
export type DayOffType = DayOffBaseType | `${DayOffBaseType}-half`

export interface DayOffMeta {
  base: DayOffBaseType
  label: string
  emoji: string
  color: string
  allowsHalf: boolean
  note: string
}

export interface Session {
  checkIn: string
  checkOut: string | null
  autoCheckedOut?: boolean
}

export type DaysMap = Record<string, Session[]>
export type DaysOffMap = Record<string, DayOffType>

export interface TimeEntriesData {
  days: DaysMap
  daysOff: DaysOffMap
}

export type HolidayAccrualMode = 'gradual' | 'immediate'
export type HoursFormat = 'decimal' | 'hhmm'

export interface Settings {
  annualHolidayAllowance: number
  employmentStartDate: string | null
  holidayAccrualMode: HolidayAccrualMode
  /** Custom theme colors (Pro "themes" feature). Null = use the app default. */
  themeLightColor: string | null
  themeDarkColor: string | null
  /** Expected work hours per day (Pro "custom-daily-target" feature). Defaults to 8. */
  dailyTargetHours: number
  /** Carry unused holiday days into the new year (Pro "holiday-carryover" feature). */
  holidayCarryoverEnabled: boolean
}

export type Plan = 'free' | 'pro'

export interface AuthUser {
  name: string
  email: string
  picture: string
  plan: Plan
  /** True once a Pro user has cancelled but is still within their paid billing period. */
  cancelAtPeriodEnd: boolean
  /**
   * ISO 8601 timestamp of when the current billing period ends — the next
   * renewal date, or the date Pro access ends if cancelAtPeriodEnd is true.
   * Undefined for Free users or briefly after checkout, before the backend
   * has received Stripe's subscription webhook.
   */
  currentPeriodEnd?: string
  /** Billing interval of the active subscription ("month", "year", ...). Undefined alongside currentPeriodEnd. */
  subscriptionInterval?: string
}

/**
 * Narrows unknown JSON to an AuthUser.
 *
 * Lives here rather than in authService so the localStorage repository can
 * use it too without importing the service that imports it. Both the network
 * response and the stored copy are parsed JSON of unknown shape, and both feed
 * `plan`-based routing and feature flags — validating one but not the other
 * left the storage path trusting whatever happened to be in localStorage.
 */
export function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AuthUser>
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.picture === 'string' &&
    (candidate.plan === 'free' || candidate.plan === 'pro')
  )
}

/** Everything a Pro user's data-sync push/pull carries: time entries plus holiday settings. */
export interface SyncData {
  days: DaysMap
  daysOff: DaysOffMap
  settings: Settings
}
