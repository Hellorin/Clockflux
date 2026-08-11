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
}

export type Plan = 'free' | 'pro'

export interface AuthUser {
  name: string
  email: string
  picture: string
  plan: Plan
}

/** Everything a Pro user's data-sync push/pull carries: time entries plus holiday settings. */
export interface SyncData {
  days: DaysMap
  daysOff: DaysOffMap
  settings: Settings
}
