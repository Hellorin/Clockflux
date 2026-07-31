import { useCallback, useState } from 'react'
import { loadSettingsRaw, saveSettings } from '../services/settingsRepository'

const DEFAULTS = {
  annualHolidayAllowance: 25,
  employmentStartDate: null,
  holidayAccrualMode: 'gradual',
}

function loadSettings() {
  const parsed = loadSettingsRaw() ?? {}
  return { ...DEFAULTS, ...parsed }
}

export function useAppSettings() {
  const [settings, setSettings] = useState(loadSettings)

  const setAnnualHolidayAllowance = useCallback((value) => {
    const n = Math.max(0, Math.floor(Number(value) || 0))
    setSettings(prev => {
      const next = { ...prev, annualHolidayAllowance: n }
      saveSettings(next)
      return next
    })
  }, [])

  const setEmploymentStartDate = useCallback((value) => {
    const v = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
    setSettings(prev => {
      const next = { ...prev, employmentStartDate: v }
      saveSettings(next)
      return next
    })
  }, [])

  const setHolidayAccrualMode = useCallback((value) => {
    const v = value === 'immediate' ? 'immediate' : 'gradual'
    setSettings(prev => {
      const next = { ...prev, holidayAccrualMode: v }
      saveSettings(next)
      return next
    })
  }, [])

  return { settings, setAnnualHolidayAllowance, setEmploymentStartDate, setHolidayAccrualMode }
}
