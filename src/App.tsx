import { Analytics } from "@vercel/analytics/react"
import { useState, useEffect, useRef } from 'react'
import { useTimeTracker } from './hooks/useTimeTracker'
import { useAppSettings } from './hooks/useAppSettings'
import { useLandingPage } from './hooks/useLandingPage'
import { useAuth } from './hooks/useAuth'
import GoogleSignInButton from './components/GoogleSignInButton'
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
import * as preferencesService from './services/preferencesService'
import type { Milestone } from './hooks/useTimeTracker'
import type { HoursFormat, Session } from './types'

type View = 'tracker' | 'calendar' | 'holiday' | 'health'

const AUTH_ENABLED = import.meta.env.VITE_ENABLE_AUTH === 'true'
// Master switch for paid-only functionality. Nothing is paid-gated yet, but
// this is the flag future paid tabs/features should check, and it's what
// login is gated on below — signing in only exists to unlock paid features.
const PAID_FEATURES_ENABLED = import.meta.env.VITE_ENABLE_PAID_FEATURES === 'true'

interface SelectedDay {
  dateKey: string
  sessions: Session[]
}

export default function App() {
  const { isCheckedIn, checkIn, checkOut, todaySessions, todayKey, allDays, setDaySessions, daysOff, setDayOffType, setDaysOffTypeBulk, isTodayOff, todayTargetMs, personalDaysUsedThisYear, setMilestoneCallback, weekTargetMs, weekTotalOtherDaysMs, allPastWorkdayOvertimeMs, stats } = useTimeTracker()
  const { settings, setAnnualHolidayAllowance, setEmploymentStartDate, setHolidayAccrualMode } = useAppSettings()
  const [view, setView] = useState<View>('tracker')
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null)
  const [hoursFormat, setHoursFormat] = useState<HoursFormat>(() => (preferencesService.loadHoursFormat() as HoursFormat) || 'decimal')
  const [celebrationMilestone, setCelebrationMilestone] = useState<Milestone | null>(null)
  const aboutBtnRef = useRef<HTMLButtonElement>(null)
  const { isLandingOpen, openLanding } = useLandingPage({ returnFocusRef: aboutBtnRef })
  const { user, features, signIn, signOut } = useAuth()
  const enabledViews = new Set(features.map(feature => feature.key))
  // If the active tab's feature gets disabled out from under the user (e.g.
  // after sign-out drops an authenticated-only feature), fall back to the
  // first tab that's still enabled rather than rendering a dead tab.
  const activeView = enabledViews.has(view) ? view : ((features[0]?.key as View | undefined) ?? view)

  useEffect(() => {
    setMilestoneCallback(type => setCelebrationMilestone(type))
    return () => setMilestoneCallback(null)
  }, [setMilestoneCallback])

  useEffect(() => {
    console.log('[features]', features)
  }, [features])

  useEffect(() => {
    document.documentElement.dataset.theme = isCheckedIn ? 'light' : 'dark'
    const color = isCheckedIn ? '#fffbf5' : '#1a1a2e'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  }, [isCheckedIn])

  function toggleHoursFormat() {
    const next = hoursFormat === 'decimal' ? 'hhmm' : 'decimal'
    setHoursFormat(next)
    preferencesService.saveHoursFormat(next)
  }

  return (
    <>
    <CelebrationOverlay
      milestone={celebrationMilestone}
      onDismiss={() => setCelebrationMilestone(null)}
    />
    <div className="app" inert={isLandingOpen}>
      <header className="app-header">
        {/* Not an <h1>: the landing page in index.html owns the document's only
            top-level heading, so the SEO signal stays unambiguous. */}
        <p className="app-title">Clockflux</p>
        <p className="app-date">{formatDateKey(todayKey)}</p>
        {AUTH_ENABLED && PAID_FEATURES_ENABLED && <GoogleSignInButton user={user} onSignIn={signIn} onSignOut={signOut} />}
        <button
          ref={aboutBtnRef}
          type="button"
          className="app-about-btn"
          onClick={openLanding}
          aria-label="About Clockflux"
          title="About Clockflux"
        >
          ?
        </button>
      </header>

      <main className="app-main">
        {activeView === 'tracker' && (
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
        {activeView === 'calendar' && (
          <CalendarView
            allDays={allDays}
            daysOff={daysOff}
            onDayClick={(key, dayData) => setSelectedDay({ dateKey: key, sessions: dayData?.sessions ?? [] })}
            onBulkSetDaysOffType={setDaysOffTypeBulk}
          />
        )}
        {activeView === 'holiday' && (
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
        {activeView === 'health' && (
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
        {enabledViews.has('tracker') && (
          <button
            type="button"
            className={`tab-btn${activeView === 'tracker' ? ' tab-btn--active' : ''}`}
            onClick={() => setView('tracker')}
          >
            <span className="tab-icon">⏱️</span>
            <span className="tab-label">Track</span>
          </button>
        )}
        {enabledViews.has('calendar') && (
          <button
            type="button"
            className={`tab-btn${activeView === 'calendar' ? ' tab-btn--active' : ''}`}
            onClick={() => setView('calendar')}
          >
            <span className="tab-icon">📅</span>
            <span className="tab-label">Calendar</span>
          </button>
        )}
        {enabledViews.has('holiday') && (
          <button
            type="button"
            className={`tab-btn${activeView === 'holiday' ? ' tab-btn--active' : ''}`}
            onClick={() => setView('holiday')}
          >
            <span className="tab-icon">🏖️</span>
            <span className="tab-label">Holiday</span>
          </button>
        )}
        {enabledViews.has('health') && (
          <button
            type="button"
            className={`tab-btn${activeView === 'health' ? ' tab-btn--active' : ''}`}
            onClick={() => setView('health')}
          >
            <span className="tab-icon">🫀</span>
            <span className="tab-label">Health</span>
          </button>
        )}
      </nav>
    </div>
    <Analytics />
    </>
  )
}
