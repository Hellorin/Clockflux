/**
 * Generates iCalendar (.ics) content for the days off in a given month and
 * triggers a browser download. Days off use all-day VEVENTs with stable UIDs
 * so re-imports update existing entries instead of duplicating them.
 */

import { DAY_OFF_BASE_TYPES, dayOffBaseType, isHalfDayOff } from './dayOff'
import type { DayOffType, DaysOffMap } from '../types'

function summaryForType(type: DayOffType): string | null {
  const t = DAY_OFF_BASE_TYPES.find(x => x.base === dayOffBaseType(type))
  if (!t) return null
  return isHalfDayOff(type) ? `Day Off (${t.label}, Half Day)` : `Day Off (${t.label})`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatIcsDateFromKey(dateKey: string): string {
  return dateKey.replaceAll('-', '')
}

// DTEND is exclusive for all-day VEVENTs (RFC 5545), so return the next day.
// Using the Date constructor lets JS normalize month/year overflow.
function nextDayIcsDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const next = new Date(y, m - 1, d + 1)
  return `${next.getFullYear()}${pad2(next.getMonth() + 1)}${pad2(next.getDate())}`
}

function formatIcsTimestampUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  )
}

function escapeIcsText(s: unknown): string {
  return String(s)
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Builds an iCalendar string for the days off in the given month.
 *
 * @param daysOff - values are DAY_OFF_TYPES from ./dayOff
 * @param year - 4-digit year
 * @param month - 0-based month (matches JS Date.getMonth)
 * @returns iCalendar content with CRLF line endings
 */
export function buildDaysOffIcs(daysOff: DaysOffMap, year: number, month: number): string {
  const monthPrefix = `${year}-${pad2(month + 1)}-`
  const stamp = formatIcsTimestampUtc(new Date())

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Clockflux//Days Off Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  const entries = Object.entries(daysOff)
    .filter(([key]) => key.startsWith(monthPrefix))
    .sort(([a], [b]) => a.localeCompare(b))

  for (const [dateKey, type] of entries) {
    const summary = summaryForType(type)
    if (!summary) continue
    lines.push(
      'BEGIN:VEVENT',
      `UID:daysoff-${dateKey}-${type}@clockflux.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${formatIcsDateFromKey(dateKey)}`,
      `DTEND;VALUE=DATE:${nextDayIcsDate(dateKey)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      'TRANSP:TRANSPARENT',
      'CATEGORIES:Time Off',
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

/**
 * Triggers a browser download of the given iCalendar content.
 */
export function downloadIcsFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
