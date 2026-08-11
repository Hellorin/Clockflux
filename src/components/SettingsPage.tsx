import { useMemo } from 'react'
import { getProratedAllowance } from '../services/ptoService'
import { formatHolidayDays } from '../utils/holidays'
import SettingsSection from './SettingsSection'
import type { HolidayAccrualMode } from '../types'

interface SettingsPageProps {
  allowance: number
  onAllowanceChange: (value: number | string) => void
  startDate: string | null
  onStartDateChange: (value: string | null) => void
  accrualMode: HolidayAccrualMode
  onAccrualModeChange: (value: string) => void
}

export default function SettingsPage({ allowance, onAllowanceChange, startDate, onStartDateChange, accrualMode, onAccrualModeChange }: SettingsPageProps) {
  const year = useMemo(() => new Date().getFullYear(), [])
  const proratedAllowance = getProratedAllowance(startDate, allowance, year)
  const isProrated = startDate && proratedAllowance !== allowance

  return (
    <section className="settings-page">
      <SettingsSection title="Holiday">
        <div className="settings-field">
          <span className="settings-field-label">Accrual</span>
          <div className="settings-mode-toggle" role="radiogroup" aria-label="Holiday accrual mode">
            <button
              type="button"
              className={`settings-mode-btn${accrualMode !== 'immediate' ? ' settings-mode-btn--active' : ''}`}
              aria-pressed={accrualMode !== 'immediate'}
              onClick={() => onAccrualModeChange('gradual')}
            >
              Gradually
            </button>
            <button
              type="button"
              className={`settings-mode-btn${accrualMode === 'immediate' ? ' settings-mode-btn--active' : ''}`}
              aria-pressed={accrualMode === 'immediate'}
              onClick={() => onAccrualModeChange('immediate')}
            >
              All at once
            </button>
          </div>
        </div>
        <label className="settings-field">
          <span className="settings-field-label">Annual allowance</span>
          <span className="settings-field-control">
            <input
              type="number"
              min="0"
              className="settings-field-input"
              value={allowance}
              onChange={e => onAllowanceChange(e.target.value)}
              aria-label="Annual holiday allowance"
            />
            <span className="settings-field-suffix">days/yr</span>
          </span>
        </label>
        <label className="settings-field">
          <span className="settings-field-label">Started on</span>
          <input
            type="date"
            className="settings-field-input settings-field-input--date"
            value={startDate || ''}
            onChange={e => onStartDateChange(e.target.value)}
            aria-label="Employment start date"
          />
        </label>
        {isProrated && (
          <p className="settings-note">
            Prorated from {formatStartDate(startDate)} ({formatHolidayDays(proratedAllowance)} of {allowance} days)
          </p>
        )}
      </SettingsSection>
    </section>
  )
}

function formatStartDate(key: string | null): string {
  if (!key) return ''
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
