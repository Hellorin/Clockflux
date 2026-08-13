import { Analytics } from "@vercel/analytics/react"
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTimeTracker } from './hooks/useTimeTracker'
import { useAppSettings } from './hooks/useAppSettings'
import { useLandingPage } from './hooks/useLandingPage'
import { useAuth } from './hooks/useAuth'
import { useSync } from './hooks/useSync'
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
import SettingsPage from './components/SettingsPage'
import { formatDateKey, getGreeting } from './utils/time'
import * as preferencesService from './services/preferencesService'
import * as authService from './services/authService'
import { requestExport, downloadExportFile } from './services/exportService'
import { cancelSubscription } from './services/billingService'
import type { ExportFormat } from './services/exportService'
import type { Milestone } from './hooks/useTimeTracker'
import type { HoursFormat, Session } from './types'

type View = 'tracker' | 'calendar' | 'holiday' | 'health' | 'settings'

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
  const [view, setView] = useState<View>('tracker')
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null)
  const [hoursFormat, setHoursFormat] = useState<HoursFormat>(() => (preferencesService.loadHoursFormat() as HoursFormat) || 'decimal')
  const [celebrationMilestone, setCelebrationMilestone] = useState<Milestone | null>(null)
  const aboutBtnRef = useRef<HTMLButtonElement>(null)
  const { isLandingOpen, openLanding } = useLandingPage({ returnFocusRef: aboutBtnRef })
  const { user, features, accessToken, signIn, signOut, updateUser, previouslySignedIn } = useAuth()
  // Settings round-trip through the server-validated /api/v1/settings
  // endpoint whenever signed in (see useAppSettings), which is what actually
  // enforces the Pro-only fields below against the caller's real plan.
  const { settings, setAnnualHolidayAllowance, setEmploymentStartDate, setHolidayAccrualMode, setDailyTargetHours, setHolidayCarryoverEnabled, setThemeLightColor, setThemeDarkColor, replaceSettings } = useAppSettings(accessToken)
  const enabledViews = new Set(features.map(feature => feature.key))
  const syncEnabled = AUTH_ENABLED && PAID_FEATURES_ENABLED && user?.plan === 'pro' && enabledViews.has('cloud-sync')
  const themesEnabled = AUTH_ENABLED && PAID_FEATURES_ENABLED && user?.plan === 'pro' && enabledViews.has('themes')
  const dailyTargetEnabled = AUTH_ENABLED && PAID_FEATURES_ENABLED && user?.plan === 'pro' && enabledViews.has('custom-daily-target')
  // Whether the caller's plan unlocks the feature at all, vs. settings.holidayCarryoverEnabled
  // below which is whether they've actually switched it on in Settings.
  const holidayCarryoverFeatureEnabled = AUTH_ENABLED && PAID_FEATURES_ENABLED && user?.plan === 'pro' && enabledViews.has('holiday-carryover')
  const carryoverActive = holidayCarryoverFeatureEnabled && settings.holidayCarryoverEnabled
  const exportCsvEnabled = AUTH_ENABLED && PAID_FEATURES_ENABLED && user?.plan === 'pro' && enabledViews.has('export-csv')
  const exportPdfEnabled = AUTH_ENABLED && PAID_FEATURES_ENABLED && user?.plan === 'pro' && enabledViews.has('export-pdf')
  const exportIcsEnabled = AUTH_ENABLED && PAID_FEATURES_ENABLED && user?.plan === 'pro' && enabledViews.has('export-ics')
  const billingEnabled = AUTH_ENABLED && PAID_FEATURES_ENABLED && user?.plan === 'pro'
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false)
  const cancelUserSubscription = useCallback(async () => {
    if (!accessToken) return
    setIsCancellingSubscription(true)
    const succeeded = await cancelSubscription(accessToken)
    if (succeeded) updateUser({ cancelAtPeriodEnd: true })
    setIsCancellingSubscription(false)
  }, [accessToken, updateUser])
  // Free plan is capped to the current year everywhere history is read back
  // (History, Calendar, Health, cumulative overtime) — storage and sync
  // still keep every year, see useTimeTracker's unlimitedHistory param.
  // Unlike the additive flags above, this one *removes* something that
  // already works today, so — matching "nothing is paid-gated yet" — it
  // only takes effect once the paid-features system is actually switched on;
  // with it off, everyone keeps the unrestricted behavior they have now.
  const paidGatingActive = AUTH_ENABLED && PAID_FEATURES_ENABLED
  const unlimitedHistoryEnabled = !paidGatingActive || (user?.plan === 'pro' && enabledViews.has('unlimited-history'))
  // Null when paid gating isn't active at all (nothing to report — everyone's
  // unrestricted and there's no plan to contrast it with). Otherwise tells
  // History/Calendar/Health whether to surface the current-year cap or a
  // "you have full history" confirmation.
  const historyScope: 'limited' | 'unlimited' | null = paidGatingActive
    ? (unlimitedHistoryEnabled ? 'unlimited' : 'limited')
    : null
  const { isCheckedIn, checkIn, checkOut, todaySessions, todayKey, allDays, setDaySessions, days, daysOff, setDayOffType, setDaysOffTypeBulk, replaceAll, isTodayOff, todayTargetMs, personalDaysUsedThisYear, setMilestoneCallback, weekTargetMs, weekTotalOtherDaysMs, allPastWorkdayOvertimeMs, stats } = useTimeTracker(settings.dailyTargetHours, unlimitedHistoryEnabled)
  const { lastSyncedAt, isSyncing, syncNow } = useSync({
    enabled: syncEnabled,
    days,
    daysOff,
    settings,
    onRestore: restored => {
      replaceAll({ days: restored.days, daysOff: restored.daysOff })
      replaceSettings(restored.settings)
    },
  })
  // If the active tab's feature gets disabled out from under the user (e.g.
  // after sign-out drops an authenticated-only feature), fall back to the
  // first tab that's still enabled rather than rendering a dead tab. Settings
  // is always available regardless of the backend feature flags.
  const activeView = (view === 'settings' || enabledViews.has(view)) ? view : ((features[0]?.key as View | undefined) ?? view)

  useEffect(() => {
    setMilestoneCallback(type => setCelebrationMilestone(type))
    return () => setMilestoneCallback(null)
  }, [setMilestoneCallback])

  useEffect(() => {
    console.log('[features]', features)
  }, [features])

  // Applies the actual (non-preview) theme: check-in-driven light/dark mode,
  // plus custom theme colors (Pro "themes" feature) overriding the default
  // light/dark backgrounds via CSS custom properties consumed in index.css.
  // Shared by the effect below and by endThemePreview(), which needs to
  // restore exactly this after a hover preview ends.
  const applyRealTheme = useCallback(() => {
    document.documentElement.dataset.theme = isCheckedIn ? 'light' : 'dark'
    const root = document.documentElement.style
    if (settings.themeLightColor) root.setProperty('--bg-light-color', settings.themeLightColor)
    else root.removeProperty('--bg-light-color')
    if (settings.themeDarkColor) root.setProperty('--bg-dark-color', settings.themeDarkColor)
    else root.removeProperty('--bg-dark-color')
  }, [isCheckedIn, settings.themeLightColor, settings.themeDarkColor])

  useEffect(() => {
    applyRealTheme()
    const color = isCheckedIn ? (settings.themeLightColor || '#fffbf5') : (settings.themeDarkColor || '#1a1a2e')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  }, [applyRealTheme, isCheckedIn, settings.themeLightColor, settings.themeDarkColor])

  // Hovering a theme color dropdown option (Settings page) previews it by
  // forcing that mode and color directly onto <html>, regardless of the
  // user's actual check-in state, so they can see it even if that mode
  // isn't the one currently showing. endThemePreview() reverts to reality.
  function previewTheme(mode: 'light' | 'dark', color: string | null) {
    document.documentElement.dataset.theme = mode
    const prop = mode === 'light' ? '--bg-light-color' : '--bg-dark-color'
    if (color) document.documentElement.style.setProperty(prop, color)
    else document.documentElement.style.removeProperty(prop)
  }

  function endThemePreview() {
    applyRealTheme()
  }

  function toggleHoursFormat() {
    const next = hoursFormat === 'decimal' ? 'hhmm' : 'decimal'
    setHoursFormat(next)
    preferencesService.saveHoursFormat(next)
  }

  // Fetches a CSV/PDF/ICS export for the given date range from the backend
  // (Pro "export" feature) and triggers a browser download. Generation is
  // server-side; this just ships up the client-held days/daysOff data.
  // Returns whether it succeeded so CalendarView can show an error inline.
  async function exportRange(format: ExportFormat, startDate: string, endDate: string): Promise<boolean> {
    const accessToken = authService.loadAccessToken()
    if (!accessToken) return false
    const result = await requestExport(accessToken, {
      format,
      startDate,
      endDate,
      days,
      daysOff,
      dailyTargetHours: settings.dailyTargetHours,
    })
    if (!result) return false
    downloadExportFile(result)
    return true
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
        <p className="app-title">Clockflux{PAID_FEATURES_ENABLED && (user?.plan === 'pro' ? ' Pro ✦' : ' Free')}</p>
        {AUTH_ENABLED && PAID_FEATURES_ENABLED && user && <p className="app-greeting">{getGreeting(user.name)}</p>}
        {AUTH_ENABLED && PAID_FEATURES_ENABLED && !user && previouslySignedIn && (
          <p className="app-greeting app-signed-out-notice">
            You've signed in on this device before but aren't connected right now — if you're a Pro user, sign in to restore the full features.
          </p>
        )}
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
            <HistoryList allDays={allDays} todayKey={todayKey} hoursFormat={hoursFormat} daysOff={daysOff} dailyTargetHours={settings.dailyTargetHours} />
          </>
        )}
        {activeView === 'calendar' && (
          <CalendarView
            allDays={allDays}
            daysOff={daysOff}
            onDayClick={(key, dayData) => setSelectedDay({ dateKey: key, sessions: dayData?.sessions ?? [] })}
            onBulkSetDaysOffType={setDaysOffTypeBulk}
            dailyTargetHours={settings.dailyTargetHours}
            exportCsvEnabled={exportCsvEnabled}
            exportPdfEnabled={exportPdfEnabled}
            exportIcsEnabled={exportIcsEnabled}
            onExportRange={exportRange}
            historyScope={historyScope}
          />
        )}
        {activeView === 'holiday' && (
          <HolidayPage
            used={personalDaysUsedThisYear}
            daysOff={daysOff}
            allowance={settings.annualHolidayAllowance}
            startDate={settings.employmentStartDate}
            accrualMode={settings.holidayAccrualMode}
            carryoverEnabled={carryoverActive}
            carryoverAvailable={holidayCarryoverFeatureEnabled}
            planGatingActive={paidGatingActive}
          />
        )}
        {activeView === 'health' && (
          <HealthPage
            stats={stats}
            allDays={allDays}
            daysOff={daysOff}
            employmentStartDate={settings.employmentStartDate}
            historyScope={historyScope}
          />
        )}
        {activeView === 'settings' && (
          <SettingsPage
            allowance={settings.annualHolidayAllowance}
            onAllowanceChange={setAnnualHolidayAllowance}
            startDate={settings.employmentStartDate}
            onStartDateChange={setEmploymentStartDate}
            accrualMode={settings.holidayAccrualMode}
            onAccrualModeChange={setHolidayAccrualMode}
            showSync={syncEnabled}
            lastSyncedAt={lastSyncedAt}
            isSyncing={isSyncing}
            onSyncNow={() => syncNow(true)}
            showThemes={themesEnabled}
            themeLightColor={settings.themeLightColor}
            themeDarkColor={settings.themeDarkColor}
            onThemeLightColorChange={setThemeLightColor}
            onThemeDarkColorChange={setThemeDarkColor}
            onPreviewTheme={previewTheme}
            onPreviewThemeEnd={endThemePreview}
            showDailyTarget={dailyTargetEnabled}
            dailyTargetHours={settings.dailyTargetHours}
            onDailyTargetHoursChange={setDailyTargetHours}
            showHolidayCarryover={holidayCarryoverFeatureEnabled}
            holidayCarryoverEnabled={settings.holidayCarryoverEnabled}
            onHolidayCarryoverEnabledChange={setHolidayCarryoverEnabled}
            showBilling={billingEnabled}
            cancelAtPeriodEnd={user?.cancelAtPeriodEnd}
            isCancellingSubscription={isCancellingSubscription}
            onCancelSubscription={cancelUserSubscription}
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
        <button
          type="button"
          className={`tab-btn${activeView === 'settings' ? ' tab-btn--active' : ''}`}
          onClick={() => setView('settings')}
        >
          <span className="tab-icon">⚙️</span>
          <span className="tab-label">Settings</span>
        </button>
      </nav>
    </div>
    <Analytics />
    </>
  )
}
