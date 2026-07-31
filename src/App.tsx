import { useState, useEffect } from 'react'
import { useTimeTracker } from './hooks/useTimeTracker'
import { useAppSettings } from './hooks/useAppSettings'
import SlideToggle from './components/SlideToggle'
import LiveTimer from './components/LiveTimer'
import TodaySummary from './components/TodaySummary'
import HistoryList from './components/HistoryList'
import CalendarView from './components/CalendarView'
import DayEditModal from './components/DayEditModal'
import CelebrationOverlay from './components/CelebrationOverlay'
import HealthPage from './components/HealthPage'
import HolidayPage from './components/HolidayPage'
import { formatDateKey } from './utils/time'
import { loadHoursFormat, saveHoursFormat } from './services/preferencesRepository'
import type { Milestone } from './hooks/useTimeTracker'
import type { HoursFormat, Session } from './types'

type View = 'tracker' | 'calendar' | 'holiday' | 'health'

interface SelectedDay {
  dateKey: string
  sessions: Session[]
}

export default function App() {
  const { isCheckedIn, checkIn, checkOut, todaySessions, todayKey, allDays, setDaySessions, daysOff, setDayOffType, setDaysOffTypeBulk, isTodayOff, todayTargetMs, personalDaysUsedThisYear, setMilestoneCallback, weekTargetMs, weekTotalOtherDaysMs, allPastWorkdayOvertimeMs, stats } = useTimeTracker()
  const { settings, setAnnualHolidayAllowance, setEmploymentStartDate, setHolidayAccrualMode } = useAppSettings()
  const [view, setView] = useState<View>('tracker')
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null)
  const [hoursFormat, setHoursFormat] = useState<HoursFormat>(() => (loadHoursFormat() as HoursFormat) || 'decimal')
  const [celebrationMilestone, setCelebrationMilestone] = useState<Milestone | null>(null)

  useEffect(() => {
    setMilestoneCallback(type => setCelebrationMilestone(type))
    return () => setMilestoneCallback(null)
  }, [setMilestoneCallback])

  useEffect(() => {
    document.documentElement.dataset.theme = isCheckedIn ? 'light' : 'dark'
    const color = isCheckedIn ? '#fffbf5' : '#1a1a2e'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  }, [isCheckedIn])

  function toggleHoursFormat() {
    const next = hoursFormat === 'decimal' ? 'hhmm' : 'decimal'
    setHoursFormat(next)
    saveHoursFormat(next)
  }

  return (
    <>
    <CelebrationOverlay
      milestone={celebrationMilestone}
      onDismiss={() => setCelebrationMilestone(null)}
    />
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Timeforge</h1>
        <p className="app-date">{formatDateKey(todayKey)}</p>
      </header>

      <main className="app-main">
        {view === 'tracker' && (
          <>
            <SlideToggle
              isCheckedIn={isCheckedIn}
              onCheckIn={checkIn}
              onCheckOut={checkOut}
              todaySessions={todaySessions}
              isTodayOff={isTodayOff}
            />
            <LiveTimer isCheckedIn={isCheckedIn} todaySessions={todaySessions} />
            <TodaySummary todaySessions={todaySessions} hoursFormat={hoursFormat} onToggleFormat={toggleHoursFormat} isTodayOff={isTodayOff} todayTargetMs={todayTargetMs} weekTargetMs={weekTargetMs} weekTotalOtherDaysMs={weekTotalOtherDaysMs} allPastWorkdayOvertimeMs={allPastWorkdayOvertimeMs} />
            <HistoryList allDays={allDays} todayKey={todayKey} hoursFormat={hoursFormat} daysOff={daysOff} />
          </>
        )}
        {view === 'calendar' && (
          <CalendarView
            allDays={allDays}
            daysOff={daysOff}
            onDayClick={(key, dayData) => setSelectedDay({ dateKey: key, sessions: dayData?.sessions ?? [] })}
            onBulkSetDaysOffType={setDaysOffTypeBulk}
          />
        )}
        {view === 'holiday' && (
          <HolidayPage
            used={personalDaysUsedThisYear}
            daysOff={daysOff}
            allowance={settings.annualHolidayAllowance}
            onAllowanceChange={setAnnualHolidayAllowance}
            startDate={settings.employmentStartDate}
            onStartDateChange={setEmploymentStartDate}
            accrualMode={settings.holidayAccrualMode}
            onAccrualModeChange={setHolidayAccrualMode}
          />
        )}
        {view === 'health' && (
          <HealthPage
            stats={stats}
            allDays={allDays}
            daysOff={daysOff}
            employmentStartDate={settings.employmentStartDate}
          />
        )}
      </main>

      {selectedDay && (
        <DayEditModal
          dateKey={selectedDay.dateKey}
          sessions={selectedDay.sessions}
          onSave={(dateKey, sessions) => { setDaySessions(dateKey, sessions); setSelectedDay(null) }}
          onClose={() => setSelectedDay(null)}
          dayOffType={daysOff[selectedDay.dateKey] ?? null}
          onSetDayOffType={(type) => setDayOffType(selectedDay.dateKey, type)}
        />
      )}

      <nav className="tab-bar">
        <button
          type="button"
          className={`tab-btn${view === 'tracker' ? ' tab-btn--active' : ''}`}
          onClick={() => setView('tracker')}
        >
          <span className="tab-icon">⏱️</span>
          <span className="tab-label">Track</span>
        </button>
        <button
          type="button"
          className={`tab-btn${view === 'calendar' ? ' tab-btn--active' : ''}`}
          onClick={() => setView('calendar')}
        >
          <span className="tab-icon">📅</span>
          <span className="tab-label">Calendar</span>
        </button>
        <button
          type="button"
          className={`tab-btn${view === 'holiday' ? ' tab-btn--active' : ''}`}
          onClick={() => setView('holiday')}
        >
          <span className="tab-icon">🏖️</span>
          <span className="tab-label">Holiday</span>
        </button>
        <button
          type="button"
          className={`tab-btn${view === 'health' ? ' tab-btn--active' : ''}`}
          onClick={() => setView('health')}
        >
          <span className="tab-icon">🫀</span>
          <span className="tab-label">Health</span>
        </button>
      </nav>
    </div>
    </>
  )
}
