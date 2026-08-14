import { useMemo, useState } from 'react'
import { getProratedAllowance } from '../services/ptoService'
import { formatHolidayDays } from '../utils/holidays'
import SettingsSection from './SettingsSection'
import ThemeColorDropdown from './ThemeColorDropdown'
import ConfirmDialog from './ConfirmDialog'
import GoogleSignInButton from './GoogleSignInButton'
import { DARK_THEME_OPTIONS, LIGHT_THEME_OPTIONS } from '../constants/themeColors'
import { PRO_FEATURES } from '../constants/proFeatures'
import type { SyncError } from '../hooks/useSync'
import type { AuthUser, HolidayAccrualMode } from '../types'

// Short label for the sync status line; the fuller explanation of what to do
// about it goes in the note below it.
const SYNC_ERROR_LABEL: Record<SyncError, string> = {
  push: 'Last sync failed',
  pull: 'Couldn’t check for updates',
}

interface SettingsPageProps {
  allowance: number
  onAllowanceChange: (value: number | string) => void
  startDate: string | null
  onStartDateChange: (value: string | null) => void
  accrualMode: HolidayAccrualMode
  onAccrualModeChange: (value: string) => void
  showSync?: boolean
  lastSyncedAt?: Date | null
  isSyncing?: boolean
  /** Set when the last sync attempt failed, so a silent failure isn't shown as a healthy "Last synced …". */
  syncError?: SyncError | null
  onSyncNow?: () => void
  showThemes?: boolean
  themeLightColor?: string | null
  themeDarkColor?: string | null
  onThemeLightColorChange?: (value: string | null) => void
  onThemeDarkColorChange?: (value: string | null) => void
  /** Live-previews the app in the given mode with the given color as the user hovers a dropdown option. */
  onPreviewTheme?: (mode: 'light' | 'dark', color: string | null) => void
  /** Ends a preview, reverting to the actually-selected theme. */
  onPreviewThemeEnd?: () => void
  /** Custom daily target (Pro "custom-daily-target" feature). */
  showDailyTarget?: boolean
  dailyTargetHours?: number
  onDailyTargetHoursChange?: (value: number | string) => void
  /** Carry over unused days into the new year (Pro "holiday-carryover" feature). */
  showHolidayCarryover?: boolean
  holidayCarryoverEnabled?: boolean
  onHolidayCarryoverEnabledChange?: (value: boolean) => void
  /** Cancel-subscription control, shown only to Pro users. */
  showBilling?: boolean
  cancelAtPeriodEnd?: boolean
  /** ISO 8601 timestamp of when the current billing period ends (renewal, or cancellation takes effect). */
  currentPeriodEnd?: string | null
  /** Billing interval of the active subscription ("month", "year", ...). */
  subscriptionInterval?: string | null
  isCancellingSubscription?: boolean
  onCancelSubscription?: () => void
  /** Sign in/out control, shown when auth is enabled. */
  showAccount?: boolean
  user?: AuthUser | null
  onSignIn?: (credential: string) => void
  onSignOut?: () => void
  /** Permanently deletes the account. Shown only while signed in. */
  onDeleteAccount?: () => void
  isDeletingAccount?: boolean
  /** Set when the last deletion attempt failed, so the user isn't left thinking it worked. */
  deleteAccountError?: string | null
  /** Pro feature showcase: shown to signed-out/Free callers once paid gating is live, to explain what they're missing. */
  showUpgrade?: boolean
  /** Where the "Upgrade to Pro" link sends the user (clockflux-account-front). */
  accountUrl?: string
}

export default function SettingsPage({ allowance, onAllowanceChange, startDate, onStartDateChange, accrualMode, onAccrualModeChange, showSync = false, lastSyncedAt = null, isSyncing = false, syncError = null, onSyncNow, showThemes = false, themeLightColor = null, themeDarkColor = null, onThemeLightColorChange, onThemeDarkColorChange, onPreviewTheme, onPreviewThemeEnd, showDailyTarget = false, dailyTargetHours = 8, onDailyTargetHoursChange, showHolidayCarryover = false, holidayCarryoverEnabled = false, onHolidayCarryoverEnabledChange, showBilling = false, cancelAtPeriodEnd = false, currentPeriodEnd = null, subscriptionInterval = null, isCancellingSubscription = false, onCancelSubscription, showAccount = false, user = null, onSignIn, onSignOut, onDeleteAccount, isDeletingAccount = false, deleteAccountError = null, showUpgrade = false, accountUrl }: SettingsPageProps) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const year = useMemo(() => new Date().getFullYear(), [])
  const proratedAllowance = getProratedAllowance(startDate, allowance, year)
  const isProrated = startDate && proratedAllowance !== allowance

  return (
    <section className="settings-page">
      {(showAccount || showBilling) && (
        <SettingsSection title="Account" collapsible={false}>
          {showAccount && (
            <div className="settings-field settings-account-row">
              <span className="settings-field-label">
                {user ? `Signed in as ${user.email}` : 'Not signed in'}
              </span>
              <GoogleSignInButton user={user} onSignIn={onSignIn ?? (() => {})} onSignOut={onSignOut ?? (() => {})} />
            </div>
          )}
          {showBilling && (
            <div className="settings-field">
              <span className="settings-field-label">Subscription</span>
              {cancelAtPeriodEnd ? (
                <span className="settings-note">Cancels at the end of your current billing period</span>
              ) : (
                <button
                  type="button"
                  className="settings-cancel-btn"
                  disabled={isCancellingSubscription}
                  onClick={() => setShowCancelConfirm(true)}
                >
                  {isCancellingSubscription ? 'Cancelling…' : <>😢 Cancel subscription</>}
                </button>
              )}
            </div>
          )}
          {showBilling && (subscriptionInterval || currentPeriodEnd) && (
            <div className="settings-field">
              <span className="settings-field-label">Billing period</span>
              <span className="settings-note">
                {[
                  subscriptionInterval ? `Billed ${formatInterval(subscriptionInterval)}` : null,
                  currentPeriodEnd ? `${cancelAtPeriodEnd ? 'Ends' : 'Renews'} ${formatPeriodEndDate(currentPeriodEnd)}` : null,
                ].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}
          {showAccount && user && onDeleteAccount && (
            <div className="settings-field">
              <span className="settings-field-label">Delete account</span>
              <span className="settings-field-control settings-field-control--stacked">
                <button
                  type="button"
                  className="settings-danger-btn"
                  disabled={isDeletingAccount}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  {isDeletingAccount ? 'Deleting…' : 'Delete my account'}
                </button>
                {deleteAccountError && (
                  <span className="settings-note settings-note--error" role="alert">{deleteAccountError}</span>
                )}
              </span>
            </div>
          )}
        </SettingsSection>
      )}

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
        {showHolidayCarryover && (
          <label className="settings-field">
            <span className="settings-field-label">
              <span className="settings-sync-star" aria-hidden="true">✦</span> Carry over unused days
            </span>
            <input
                type="checkbox"
                checked={holidayCarryoverEnabled}
                onChange={e => onHolidayCarryoverEnabledChange?.(e.target.checked)}
                aria-label="Carry over unused holiday days into the new year"
            />
          </label>
        )}
      </SettingsSection>

      {showUpgrade && (
        <SettingsSection
          title={<><span className="settings-sync-star" aria-hidden="true">✦</span> Go Pro</>}
          defaultOpen
        >
          <p className="settings-note settings-upgrade-intro">Unlock these with Clockflux Pro:</p>
          <ul className="settings-upgrade-list">
            {PRO_FEATURES.map(feature => (
              <li key={feature.key} className="settings-upgrade-item">
                <span className="settings-upgrade-icon" aria-hidden="true">{feature.icon}</span>
                <span className="settings-upgrade-text">
                  <span className="settings-upgrade-label">{feature.label}</span>
                  <span className="settings-upgrade-desc">{feature.description}</span>
                </span>
              </li>
            ))}
          </ul>
          <a
            className="settings-upgrade-cta"
            href={accountUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Upgrade to Pro
          </a>
        </SettingsSection>
      )}

      {showSync && (
        <SettingsSection title={<><span className="settings-sync-star" aria-hidden="true">✦</span> Sync</>} collapsible={false}>
          <div className="settings-field settings-sync-row">
            <span className={`settings-field-label${syncError && !isSyncing ? ' settings-field-label--error' : ''}`}>
              {isSyncing
                ? 'Syncing…'
                : syncError
                  ? SYNC_ERROR_LABEL[syncError]
                  : lastSyncedAt
                    ? `Last synced ${formatSyncTime(lastSyncedAt)}`
                    : 'Never synced yet'}
            </span>
            <button
              type="button"
              className="settings-sync-btn"
              onClick={onSyncNow}
              disabled={isSyncing}
              aria-label="Sync now"
              title="Sync now"
            >
              <svg
                className={`settings-sync-icon${isSyncing ? ' settings-sync-icon--spinning' : ''}`}
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M12 5V2L7 7l5 5V8c2.76 0 5 2.24 5 5a5 5 0 0 1-5 5 5 5 0 0 1-5-5H5a7 7 0 0 0 7 7 7 7 0 0 0 7-7 7 7 0 0 0-7-7Z"
                />
              </svg>
            </button>
          </div>
          {syncError && !isSyncing && (
            <p className="settings-note settings-note--error" role="alert">
              {syncError === 'push'
                ? 'Your latest changes are still only on this device. They’ll be sent again automatically — or press the button above to retry now.'
                : 'We couldn’t reach the server, so changes made on your other devices may be missing here. Press the button above to retry.'}
            </p>
          )}
        </SettingsSection>
      )}

      {showThemes && (
        <SettingsSection title={<><span className="settings-sync-star" aria-hidden="true">✦</span> Theme</>}>
          <div className="settings-field">
            <span className="settings-field-label">Light color</span>
            <ThemeColorDropdown
                groupLabel="Light theme color"
                options={LIGHT_THEME_OPTIONS}
                selected={themeLightColor}
                onSelect={value => onThemeLightColorChange?.(value)}
                onPreview={value => onPreviewTheme?.('light', value)}
                onPreviewEnd={() => onPreviewThemeEnd?.()}
            />
          </div>
          <div className="settings-field">
            <span className="settings-field-label">Dark color</span>
            <ThemeColorDropdown
                groupLabel="Dark theme color"
                options={DARK_THEME_OPTIONS}
                selected={themeDarkColor}
                onSelect={value => onThemeDarkColorChange?.(value)}
                onPreview={value => onPreviewTheme?.('dark', value)}
                onPreviewEnd={() => onPreviewThemeEnd?.()}
            />
          </div>
        </SettingsSection>
      )}

      {showDailyTarget && (
        <SettingsSection title={<><span className="settings-sync-star" aria-hidden="true">✦</span> Daily target</>}>
          <label className="settings-field">
            <span className="settings-field-label">Hours per day</span>
            <span className="settings-field-control">
              <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="settings-field-input"
                  value={dailyTargetHours}
                  onChange={e => onDailyTargetHoursChange?.(e.target.value)}
                  aria-label="Daily target hours"
              />
              <span className="settings-field-suffix">hrs/day</span>
            </span>
          </label>
        </SettingsSection>
      )}

      {showCancelConfirm && (
        <ConfirmDialog
          title="Cancel subscription?"
          message="You’ll keep Pro access until the end of your current billing period, then your plan will drop to Free."
          confirmLabel="Cancel subscription"
          cancelLabel="Keep subscription"
          danger
          onConfirm={() => { setShowCancelConfirm(false); onCancelSubscription?.() }}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete your account?"
          message={
            (user?.plan === 'pro'
              ? 'This cancels your subscription and permanently erases your synced history, settings and account. '
              : 'This permanently erases your account, along with any settings and history stored with it. ') +
            'It cannot be undone. Export your data first if you want to keep a copy.'
          }
          confirmLabel="Delete everything"
          cancelLabel="Keep my account"
          danger
          onConfirm={() => { setShowDeleteConfirm(false); onDeleteAccount?.() }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </section>
  )
}

function formatStartDate(key: string | null): string {
  if (!key) return ''
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatPeriodEndDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatInterval(interval: string): string {
  if (interval === 'month') return 'monthly'
  if (interval === 'year') return 'yearly'
  return interval
}

function formatSyncTime(date: Date): string {
  const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const timePart = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${datePart} at ${timePart}`
}
