import { Analytics } from "@vercel/analytics/react"
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTimeTracker } from './hooks/useTimeTracker'
import { useAppSettings } from './hooks/useAppSettings'
import { useLandingPage } from './hooks/useLandingPage'
import { useAuth } from './hooks/useAuth'
import { useSync } from './hooks/useSync'
import { useStorageHealth } from './hooks/useStorageHealth'
import SlideToggle from './components/SlideToggle'
import LiveTimer from './components/LiveTimer'
import TodaySummary from './components/TodaySummary'
import HistoryList from './components/HistoryList'
import CalendarView from './components/CalendarView'
import DayEditModal from './components/DayEditModal'
import CelebrationOverlay from './components/CelebrationOverlay'
import InstallPrompt from './components/InstallPrompt'
import HealthPage from './components/HealthPage'
import HolidayPage from './components/HolidayPage'
import SettingsPage from './components/SettingsPage'
import { formatDateKey, getGreeting } from './utils/time'
import * as preferencesService from './services/preferencesService'
import * as authService from './services/authService'
import { requestExport, downloadExportFile } from './services/exportService'
import { cancelSubscription } from './services/billingService'
import { deleteAccount } from './services/accountService'
import { reconcileOwner } from './services/localDataOwnershipService'
import type { ExportFormat } from './services/exportService'
import type { Milestone } from './hooks/useTimeTracker'
import type { HoursFormat, Session } from './types'

type View = 'tracker' | 'calendar' | 'holiday' | 'health' | 'settings'

const AUTH_ENABLED = import.meta.env.VITE_ENABLE_AUTH === 'true'
// Master switch for paid-only functionality. Nothing is paid-gated yet, but
// this is the flag future paid tabs/features should check, and it's what
// login is gated on below — signing in only exists to unlock paid features.
const PAID_FEATURES_ENABLED = import.meta.env.VITE_ENABLE_PAID_FEATURES === 'true'
// Where the Settings page's "Upgrade to Pro" link sends a Free user.
const ACCOUNT_URL = import.meta.env.VITE_ACCOUNT_URL || 'https://account.clockflux.app'
// Where the header's "?" button sends people. It used to reopen the in-app
// landing splash instead; now that the fuller marketing/docs/legal content it
// summarized lives on its own site, linking straight there beats reopening a
// trimmed-down in-app copy.
const INFO_URL = import.meta.env.VITE_INFO_URL || 'https://info.clockflux.app'

interface SelectedDay {
  dateKey: string
  sessions: Session[]
}

export default function App() {
  const [view, setView] = useState<View>('tracker')
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null)
  const [hoursFormat, setHoursFormat] = useState<HoursFormat>(() => (preferencesService.loadHoursFormat() as HoursFormat) || 'decimal')
  const [celebrationMilestone, setCelebrationMilestone] = useState<Milestone | null>(null)
  // Still an HTMLElement ref even though the "?" control below is now an <a>,
  // not a <button>: useLandingPage falls back to focusing this when the
  // splash auto-opens on a first visit (i.e. with no prior click to return
  // focus to), which has nothing to do with the "?" control's own click
  // handler below.
  const aboutBtnRef = useRef<HTMLAnchorElement>(null)
  const { isLandingOpen } = useLandingPage({ returnFocusRef: aboutBtnRef })
  const { user, features, accessToken, signIn, signOut, updateUser, previouslySignedIn } = useAuth()
  // Settings round-trip through the server-validated /api/v1/settings
  // endpoint whenever signed in (see useAppSettings), which is what actually
  // enforces the Pro-only fields below against the caller's real plan.
  const { settings, setAnnualHolidayAllowance, setEmploymentStartDate, setHolidayAccrualMode, setDailyTargetHours, setHolidayCarryoverEnabled, setThemeLightColor, setThemeDarkColor, replaceSettings } = useAppSettings(accessToken, user?.email)
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
  // Whether to show the Settings page's Pro feature showcase/upsell: only
  // once gating is actually live, and only to callers who don't already
  // have Pro (an already-Pro user has nothing left to be sold).
  const showUpgrade = paidGatingActive && user?.plan !== 'pro'
  const unlimitedHistoryEnabled = !paidGatingActive || (user?.plan === 'pro' && enabledViews.has('unlimited-history'))
  // Null when paid gating isn't active at all (nothing to report — everyone's
  // unrestricted and there's no plan to contrast it with). Otherwise tells
  // History/Calendar/Health whether to surface the current-year cap or a
  // "you have full history" confirmation.
  const historyScope: 'limited' | 'unlimited' | null = paidGatingActive
    ? (unlimitedHistoryEnabled ? 'unlimited' : 'limited')
    : null
  const { isCheckedIn, checkIn, checkOut, todaySessions, todayKey, allDays, setDaySessions, days, daysOff, setDayOffType, setDaysOffTypeBulk, replaceAll, isTodayOff, todayTargetMs, personalDaysUsedThisYear, setMilestoneCallback, weekTargetMs, weekTotalOtherDaysMs, allPastWorkdayOvertimeMs, stats } = useTimeTracker(settings.dailyTargetHours, unlimitedHistoryEnabled)

  // Local storage has no built-in owner, so a second, different account
  // signing in on this browser could otherwise inherit — and then overwrite
  // — whatever's already here (see localDataOwnershipService.ts). Runs
  // ahead of useSync/useAppSettings' own sign-in effects (declared below)
  // so any mismatched data gets set aside before anything tries to push it.
  const currentLocalDataRef = useRef({ days, daysOff, settings })
  currentLocalDataRef.current = { days, daysOff, settings }
  const reconciledOwnerRef = useRef<string | null>(null)
  useEffect(() => {
    if (!user?.email || reconciledOwnerRef.current === user.email) return
    reconciledOwnerRef.current = user.email
    const result = reconcileOwner(user.email, currentLocalDataRef.current)
    if (result.data) {
      replaceAll({ days: result.data.days, daysOff: result.data.daysOff })
      replaceSettings(result.data.settings)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the signed-in identity changes; the local data read via currentLocalDataRef is checked at that moment, not tracked as a dep (mirrors useSync's latestDataRef pattern)
  }, [user?.email])

  const { lastSyncedAt, isSyncing, isDirty, syncError, syncNow } = useSync({
    enabled: syncEnabled,
    days,
    daysOff,
    settings,
    onRestore: restored => {
      replaceAll({ days: restored.days, daysOff: restored.daysOff })
      replaceSettings(restored.settings)
    },
  })
  const storageWriteFailing = useStorageHealth()
  // Gives sign-out a chance to confirm the cloud copy is current before
  // authService risks wiping local Pro data (see authService.signOut's
  // safeToWipe param): if there's anything unsynced, attempt one last
  // forced push and only report it safe if that push actually succeeded.
  // An offline/failed flush correctly leaves safeToWipe false, which keeps
  // the local copy around exactly like a free user's.
  const handleSignOut = useCallback(async () => {
    const safeToWipe = syncEnabled && isDirty ? await syncNow(true) : true
    signOut(safeToWipe)
  }, [syncEnabled, isDirty, syncNow, signOut])

  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null)
  const handleDeleteAccount = useCallback(async () => {
    if (!accessToken) return
    setIsDeletingAccount(true)
    setDeleteAccountError(null)
    const succeeded = await deleteAccount(accessToken)
    setIsDeletingAccount(false)
    if (!succeeded) {
      // Never fall through to signing them out on failure — that would look
      // exactly like a successful deletion while the account still exists.
      setDeleteAccountError('We couldn’t delete your account. Please try again, or email info@clockflux.app.')
      return
    }
    // safeToWipe: false deliberately. Deletion just removed the cloud copy,
    // so for a Pro user the local one is now their only copy — wiping it here
    // would destroy data they never asked to lose. The next sign-in by a
    // different account is still guarded by localDataOwnershipService.
    signOut(false)
  }, [accessToken, signOut])

  // The dot used to reflect only whether `user` was set, so a Pro user whose
  // every sync was failing still saw a reassuring green "Signed in". Sync
  // health is the thing the dot is actually being read for, so let a failure
  // show through.
  const connectionStatus = syncEnabled && syncError
    ? {
        className: 'app-connection-dot--degraded',
        label: 'Signed in, sync failing',
        title: 'Signed in, but syncing is failing — see Settings',
      }
    : user
      ? { className: 'app-connection-dot--online', label: 'Signed in', title: 'Signed in' }
      : { className: 'app-connection-dot--offline', label: 'Not signed in', title: 'Not signed in — sign in from Settings' }

  // If the active tab's feature gets disabled out from under the user (e.g.
  // after sign-out drops an authenticated-only feature), fall back to the
  // first tab that's still enabled rather than rendering a dead tab. Settings
  // is always available regardless of the backend feature flags.
  const activeView = (view === 'settings' || enabledViews.has(view)) ? view : ((features[0]?.key as View | undefined) ?? view)

  useEffect(() => {
    setMilestoneCallback(type => setCelebrationMilestone(type))
    return () => setMilestoneCallback(null)
  }, [setMilestoneCallback])

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
            You've signed in on this device before but aren't connected right now — if you're a Pro user, sign in from Settings to restore the full features.
          </p>
        )}
        <p className="app-date">{formatDateKey(todayKey)}</p>
        <a
          ref={aboutBtnRef}
          className="app-about-btn"
          href={INFO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="About Clockflux"
          title="About Clockflux"
        >
          ?
        </a>
        {AUTH_ENABLED && PAID_FEATURES_ENABLED && (
          <span
            className={`app-connection-dot ${connectionStatus.className}`}
            role="status"
            aria-label={connectionStatus.label}
            title={connectionStatus.title}
          />
        )}
      </header>

      {/* The repositories swallow a rejected localStorage write so a full quota
          or a storage-blocking privacy setting can't crash the app mid-render.
          Without this banner that fix would trade a crash for something worse:
          the user keeps checking in and out, sees every session on screen, and
          loses all of it on reload with no idea anything went wrong. */}
      {storageWriteFailing && (
        <p className="app-storage-warning" role="alert">
          This browser is refusing to save data — your hours are only in this tab and
          will be lost if you reload. Free up storage space, or turn off private/
          restricted browsing for this site.
        </p>
      )}

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
            syncError={syncError}
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
            currentPeriodEnd={user?.currentPeriodEnd}
            subscriptionInterval={user?.subscriptionInterval}
            isCancellingSubscription={isCancellingSubscription}
            onCancelSubscription={cancelUserSubscription}
            showAccount={paidGatingActive}
            user={user}
            onSignIn={signIn}
            onSignOut={handleSignOut}
            onDeleteAccount={handleDeleteAccount}
            isDeletingAccount={isDeletingAccount}
            deleteAccountError={deleteAccountError}
            showUpgrade={showUpgrade}
            accountUrl={ACCOUNT_URL}
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

      <InstallPrompt />
    </div>
    <Analytics />
    </>
  )
}
