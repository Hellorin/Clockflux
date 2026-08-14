import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsPage from './SettingsPage'
import type { AuthUser } from '../types'

describe('SettingsPage', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates allowance, start date, and accrual mode', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    const onAllowanceChange = vi.fn()
    const onStartDateChange = vi.fn()
    const onAccrualModeChange = vi.fn()
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={onAllowanceChange}
        startDate="2024-03-01"
        onStartDateChange={onStartDateChange}
        accrualMode="gradual"
        onAccrualModeChange={onAccrualModeChange}
      />
    )

    fireEvent.click(screen.getByText('Holiday'))

    fireEvent.change(screen.getByLabelText('Annual holiday allowance'), { target: { value: '30' } })
    expect(onAllowanceChange).toHaveBeenCalledWith('30')

    fireEvent.change(screen.getByLabelText('Employment start date'), { target: { value: '2024-04-01' } })
    expect(onStartDateChange).toHaveBeenCalledWith('2024-04-01')

    fireEvent.click(screen.getByText('All at once'))
    expect(onAccrualModeChange).toHaveBeenCalledWith('immediate')

    fireEvent.click(screen.getByText('Gradually'))
    expect(onAccrualModeChange).toHaveBeenCalledWith('gradual')

    expect(screen.getByText(/Prorated from/)).toBeInTheDocument()
  })

  it('does not show the prorated note when hired before the year started', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate="2020-01-01"
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
      />
    )
    fireEvent.click(screen.getByText('Holiday'))
    expect(screen.queryByText(/Prorated from/)).not.toBeInTheDocument()
  })

  it('hides the Sync section by default', () => {
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
      />
    )
    expect(screen.queryByLabelText('Sync now')).not.toBeInTheDocument()
  })

  it('shows the Sync section already expanded, with no toggle, when showSync is true', () => {
    const onSyncNow = vi.fn()
    const { container } = render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
        showSync
        lastSyncedAt={new Date('2026-08-11T10:30:00')}
        isSyncing={false}
        onSyncNow={onSyncNow}
      />
    )

    // No collapse toggle: the Sync section header isn't a button (Holiday, the
    // first section, still is one).
    expect(container.querySelectorAll('.settings-section__header')[1]?.tagName).toBe('DIV')
    expect(screen.getByText(/Last synced/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))
    expect(onSyncNow).toHaveBeenCalled()
  })

  it('shows a syncing state and disables the button while a sync is in flight', () => {
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
        showSync
        lastSyncedAt={null}
        isSyncing
        onSyncNow={() => {}}
      />
    )

    expect(screen.getByText('Syncing…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled()
  })

  it('hides the Theme section by default', () => {
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
      />
    )
    expect(screen.queryByRole('button', { name: 'Light theme color' })).not.toBeInTheDocument()
  })

  it('shows the current pick on each dropdown trigger, defaulting to "Default" when unset', () => {
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
        showThemes
        themeLightColor="#f0f9ff"
        themeDarkColor={null}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Theme' }))
    expect(screen.getByRole('button', { name: 'Light theme color' })).toHaveTextContent('Sky')
    expect(screen.getByRole('button', { name: 'Dark theme color' })).toHaveTextContent('Default')
  })

  it('opens on click, previews an option on hover, and commits it on click', () => {
    const onThemeLightColorChange = vi.fn()
    const onPreviewTheme = vi.fn()
    const onPreviewThemeEnd = vi.fn()
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
        showThemes
        themeLightColor={null}
        themeDarkColor={null}
        onThemeLightColorChange={onThemeLightColorChange}
        onThemeDarkColorChange={() => {}}
        onPreviewTheme={onPreviewTheme}
        onPreviewThemeEnd={onPreviewThemeEnd}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Theme' }))
    fireEvent.click(screen.getByRole('button', { name: 'Light theme color' }))
    const list = screen.getByRole('listbox', { name: 'Light theme color' })
    const creamOption = screen.getByRole('option', { name: 'Cream' })

    fireEvent.mouseEnter(creamOption)
    expect(onPreviewTheme).toHaveBeenCalledWith('light', '#fffbf5')

    fireEvent.mouseLeave(list)
    expect(onPreviewThemeEnd).toHaveBeenCalledTimes(1)

    fireEvent.click(creamOption)
    expect(onThemeLightColorChange).toHaveBeenCalledWith('#fffbf5')
    // Committing a pick closes the dropdown, which also ends the preview.
    expect(onPreviewThemeEnd).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('listbox', { name: 'Light theme color' })).not.toBeInTheDocument()
  })

  it('closes the dropdown and ends the preview on outside click', () => {
    const onPreviewThemeEnd = vi.fn()
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
        showThemes
        themeLightColor={null}
        themeDarkColor={null}
        onPreviewThemeEnd={onPreviewThemeEnd}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Theme' }))
    fireEvent.click(screen.getByRole('button', { name: 'Light theme color' }))
    expect(screen.getByRole('listbox', { name: 'Light theme color' })).toBeInTheDocument()

    fireEvent.pointerDown(document.body)
    expect(onPreviewThemeEnd).toHaveBeenCalled()
    expect(screen.queryByRole('listbox', { name: 'Light theme color' })).not.toBeInTheDocument()
  })

  it('hides the holiday carryover toggle by default', () => {
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
      />
    )
    fireEvent.click(screen.getByText('Holiday'))
    expect(screen.queryByLabelText('Carry over unused holiday days into the new year')).not.toBeInTheDocument()
  })

  it('shows and toggles the holiday carryover setting when showHolidayCarryover is true', () => {
    const onHolidayCarryoverEnabledChange = vi.fn()
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
        showHolidayCarryover
        holidayCarryoverEnabled={false}
        onHolidayCarryoverEnabledChange={onHolidayCarryoverEnabledChange}
      />
    )
    fireEvent.click(screen.getByText('Holiday'))
    const checkbox = screen.getByLabelText('Carry over unused holiday days into the new year')
    expect(checkbox).not.toBeChecked()

    fireEvent.click(checkbox)
    expect(onHolidayCarryoverEnabledChange).toHaveBeenCalledWith(true)
  })

  it('hides the Billing section by default', () => {
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
      />
    )
    expect(screen.queryByText('Account')).not.toBeInTheDocument()
  })

  it('cancels the subscription only after the user confirms in the popup', () => {
    const onCancelSubscription = vi.fn()
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
        showBilling
        onCancelSubscription={onCancelSubscription}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Cancel subscription/ }))

    // The confirmation popup is now open; dismissing it should not cancel.
    fireEvent.click(screen.getByRole('button', { name: 'Keep subscription' }))
    expect(onCancelSubscription).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Cancel subscription/ }))
    // Two "Cancel subscription" buttons now exist: the settings one and the popup's confirm button.
    const confirmButtons = screen.getAllByRole('button', { name: /Cancel subscription/ })
    fireEvent.click(confirmButtons[confirmButtons.length - 1])
    expect(onCancelSubscription).toHaveBeenCalled()
  })

  it('shows a cancelling state and, once cancelled, a status message instead of the button', () => {
    const { rerender } = render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
        showBilling
        isCancellingSubscription
      />
    )
    expect(screen.getByRole('button', { name: 'Cancelling…' })).toBeDisabled()

    rerender(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
        showBilling
        cancelAtPeriodEnd
      />
    )
    expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument()
    expect(screen.getByText('Cancels at the end of your current billing period')).toBeInTheDocument()
  })

  it('shows the billing interval and renewal date when both are known', () => {
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
        showBilling
        currentPeriodEnd="2026-09-13T00:00:00Z"
        subscriptionInterval="month"
      />
    )
    expect(screen.getByText('Billing period')).toBeInTheDocument()
    expect(screen.getByText(/^Billed monthly · Renews /)).toBeInTheDocument()
  })

  it('shows the end date instead of a renewal date once cancellation is scheduled', () => {
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
        showBilling
        cancelAtPeriodEnd
        currentPeriodEnd="2026-09-13T00:00:00Z"
        subscriptionInterval="year"
      />
    )
    expect(screen.getByText(/^Billed yearly · Ends /)).toBeInTheDocument()
  })

  it('hides the billing period field when neither interval nor renewal date is known', () => {
    render(
      <SettingsPage
        allowance={24}
        onAllowanceChange={() => {}}
        startDate={null}
        onStartDateChange={() => {}}
        accrualMode="gradual"
        onAccrualModeChange={() => {}}
        showBilling
      />
    )
    expect(screen.queryByText('Billing period')).not.toBeInTheDocument()
  })
  const proUser: AuthUser = { name: 'A', email: 'a@example.com', picture: '', plan: 'pro', cancelAtPeriodEnd: false }

  const deletableProps = {
    allowance: 24,
    onAllowanceChange: () => {},
    startDate: null,
    onStartDateChange: () => {},
    accrualMode: 'gradual' as const,
    onAccrualModeChange: () => {},
    showAccount: true,
    user: proUser,
  }

  it('requires confirmation before deleting the account', () => {
    const onDeleteAccount = vi.fn()
    render(<SettingsPage {...deletableProps} onDeleteAccount={onDeleteAccount} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    // Backing out of the confirmation must not delete anything.
    fireEvent.click(screen.getByRole('button', { name: 'Keep my account' }))
    expect(onDeleteAccount).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }))
    expect(onDeleteAccount).toHaveBeenCalled()
  })

  it('warns a Pro user that deleting also cancels their subscription', () => {
    render(<SettingsPage {...deletableProps} onDeleteAccount={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))

    expect(screen.getByRole('alertdialog')).toHaveTextContent(/cancels your subscription/)
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/cannot be undone/)
  })

  it('hides the delete control when nobody is signed in', () => {
    render(<SettingsPage {...deletableProps} user={null} onDeleteAccount={() => {}} />)

    expect(screen.queryByRole('button', { name: 'Delete my account' })).not.toBeInTheDocument()
  })

  it('shows a deleting state while the request is in flight', () => {
    render(<SettingsPage {...deletableProps} onDeleteAccount={() => {}} isDeletingAccount />)

    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
  })

  // A silent failure here would read as a successful deletion, which is the
  // one outcome that must never be ambiguous.
  it('surfaces a deletion failure instead of failing silently', () => {
    render(
      <SettingsPage
        {...deletableProps}
        onDeleteAccount={() => {}}
        deleteAccountError="We couldn’t delete your account."
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t delete your account.')
  })
  const syncProps = {
    allowance: 24,
    onAllowanceChange: () => {},
    startDate: null,
    onStartDateChange: () => {},
    accrualMode: 'gradual' as const,
    onAccrualModeChange: () => {},
    showSync: true,
  }

  // A silently failed sync used to render as a reassuring "Last synced ..." —
  // the paid feature looked healthy while nothing was reaching the server.
  it('replaces the last-synced line with a failure when a push fails', () => {
    render(<SettingsPage {...syncProps} lastSyncedAt={new Date('2026-08-11T10:00:00Z')} syncError="push" />)

    expect(screen.getByText('Last sync failed')).toBeInTheDocument()
    expect(screen.queryByText(/^Last synced/)).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/still only on this device/)
  })

  it('explains a failed pull differently, since the risk is stale data not lost data', () => {
    render(<SettingsPage {...syncProps} syncError="pull" />)

    expect(screen.getByText('Couldn’t check for updates')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/other devices may be missing/)
  })

  it('prefers the in-flight state over a previous failure', () => {
    render(<SettingsPage {...syncProps} syncError="push" isSyncing />)

    expect(screen.getByText('Syncing…')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the normal last-synced line when there is no error', () => {
    render(<SettingsPage {...syncProps} lastSyncedAt={new Date('2026-08-11T10:00:00Z')} />)

    expect(screen.getByText(/^Last synced/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
