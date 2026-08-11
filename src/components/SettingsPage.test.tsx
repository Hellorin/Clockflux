import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsPage from './SettingsPage'

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

    // No collapse toggle: the section header isn't a button.
    expect(container.querySelector('.settings-section__header')?.tagName).toBe('DIV')
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
})
