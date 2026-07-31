/**
 * Day-off type helpers. A day-off marker is a string: a base type
 * (see DAY_OFF_BASE_TYPES) optionally suffixed with '-half' to mark a half
 * day off (the other half is expected to be worked normally).
 */
import type { DayOffMeta, DayOffType } from '../types'

export const DAY_OFF_BASE_TYPES: DayOffMeta[] = [
  { base: 'personal', label: 'Personal', emoji: '🌴', color: 'var(--accent-in)', allowsHalf: true, note: 'Counts against your yearly holiday allowance' },
  { base: 'sick', label: 'Sick', emoji: '🤒', color: '#a78bfa', allowsHalf: true, note: 'Sick leave — does not consume your allowance' },
  { base: 'official', label: 'Official', emoji: '🇨🇭', color: '#60a5fa', allowsHalf: false, note: 'Public holiday — does not consume your allowance' },
  { base: 'unpaid', label: 'Unpaid', emoji: '💸', color: '#f59e0b', allowsHalf: true, note: 'Unpaid leave — does not consume your allowance' },
]

export const DAY_OFF_TYPES: DayOffType[] = DAY_OFF_BASE_TYPES.flatMap(t => t.allowsHalf ? [t.base, `${t.base}-half` as const] : [t.base])

export function isValidDayOffType(type: unknown): type is DayOffType {
  return DAY_OFF_TYPES.includes(type as DayOffType)
}

export function isHalfDayOff(type: unknown): type is `${string}-half` {
  return typeof type === 'string' && type.endsWith('-half')
}

// Fraction of the day taken off by the given marker (0 when unset).
export function dayOffFraction(type: DayOffType | null | undefined): number {
  if (!type) return 0
  return isHalfDayOff(type) ? 0.5 : 1
}

// Strips the '-half' suffix, e.g. 'personal-half' -> 'personal'.
export function dayOffBaseType(type: DayOffType): DayOffMeta['base'] {
  return (isHalfDayOff(type) ? type.slice(0, -'-half'.length) : type) as DayOffMeta['base']
}

// Metadata (label/emoji/color/etc.) for the base type of the given marker.
export function getDayOffMeta(type: DayOffType): DayOffMeta | undefined {
  return DAY_OFF_BASE_TYPES.find(t => t.base === dayOffBaseType(type))
}
