import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DayEditModal from './DayEditModal'

describe('DayEditModal', () => {
  it('renders default session rows when there are no existing sessions', () => {
    render(
      <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={() => {}} onClose={() => {}} onSetDayOffType={() => {}} />
    )
    const checkInInputs = screen.getAllByLabelText('Check-in time')
    expect(checkInInputs).toHaveLength(2)
    expect(checkInInputs[0]).toHaveValue('08:00')
  })

  it('renders existing sessions converted to HH:MM', () => {
    const sessions = [{ checkIn: '2024-01-10T09:30:00', checkOut: '2024-01-10T12:15:00' }]
    render(
      <DayEditModal dateKey="2024-01-10" sessions={sessions} onSave={() => {}} onClose={() => {}} onSetDayOffType={() => {}} />
    )
    expect(screen.getByLabelText('Check-in time')).toHaveValue('09:30')
    expect(screen.getByLabelText('Check-out time')).toHaveValue('12:15')
  })

  it('calls onClose when the backdrop or close button is clicked, but not for clicks inside the modal', () => {
    const onClose = vi.fn()
    const { container } = render(
      <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={() => {}} onClose={onClose} onSetDayOffType={() => {}} />
    )
    fireEvent.click(container.querySelector('.modal')!)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(container.querySelector('.modal-backdrop__scrim')!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('closes on Escape key press', () => {
    const onClose = vi.fn()
    render(
      <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={() => {}} onClose={onClose} onSetDayOffType={() => {}} />
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('adds and deletes session rows', () => {
    render(
      <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={() => {}} onClose={() => {}} onSetDayOffType={() => {}} />
    )
    fireEvent.click(screen.getByText('+ Add Session'))
    expect(screen.getAllByLabelText('Check-in time')).toHaveLength(3)
    fireEvent.click(screen.getAllByLabelText('Delete session')[0])
    expect(screen.getAllByLabelText('Check-in time')).toHaveLength(2)
  })

  it('shows the empty state when all sessions are removed', () => {
    render(
      <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={() => {}} onClose={() => {}} onSetDayOffType={() => {}} />
    )
    while (screen.queryAllByLabelText('Delete session').length > 0) {
      fireEvent.click(screen.getAllByLabelText('Delete session')[0])
    }
    expect(screen.getByText('No sessions. Add one below.')).toBeInTheDocument()
  })

  it('updates row times and saves converted ISO sessions', () => {
    const onSave = vi.fn()
    render(
      <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={onSave} onClose={() => {}} onSetDayOffType={() => {}} />
    )
    const checkIns = screen.getAllByLabelText('Check-in time')
    fireEvent.change(checkIns[0], { target: { value: '07:00' } })
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledTimes(1)
    const [dateKey, sessions] = onSave.mock.calls[0]
    expect(dateKey).toBe('2024-01-10')
    expect(sessions[0].checkIn).toBe(new Date(2024, 0, 10, 7, 0).toISOString())
    expect(sessions[0].checkOut).toBe(new Date(2024, 0, 10, 12, 0).toISOString())
  })

  it('filters out fully cleared rows on save', () => {
    const onSave = vi.fn()
    render(
      <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={onSave} onClose={() => {}} onSetDayOffType={() => {}} />
    )
    // Clearing *both* times is an unambiguous "remove this row", so it still
    // saves silently — only a half-filled row is treated as a mistake.
    fireEvent.change(screen.getAllByLabelText('Check-in time')[1], { target: { value: '' } })
    fireEvent.change(screen.getAllByLabelText('Check-out time')[1], { target: { value: '' } })
    fireEvent.click(screen.getByText('Save'))
    const [, sessions] = onSave.mock.calls[0]
    expect(sessions).toHaveLength(1)
  })

  it('refuses to save a check-out with no check-in instead of dropping it', () => {
    const onSave = vi.fn()
    render(
      <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={onSave} onClose={() => {}} onSetDayOffType={() => {}} />
    )
    // This used to be filtered out on save, so the user watched the modal close
    // believing the session had been recorded when it had simply been discarded.
    fireEvent.change(screen.getAllByLabelText('Check-in time')[1], { target: { value: '' } })
    fireEvent.click(screen.getByText('Save'))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Every session needs a check-in time.')
  })

  it('renders a static "Weekend" marker and dims sessions for weekend dates', () => {
    const { container } = render(
      <DayEditModal dateKey="2024-01-13" sessions={[]} onSave={() => {}} onClose={() => {}} onSetDayOffType={() => {}} />
    )
    expect(screen.getByText('Weekend')).toBeInTheDocument()
    expect(container.querySelector('.modal-sessions--dimmed')).not.toBeNull()
    expect(screen.getByText('+ Add Session')).toBeDisabled()
  })

  it('selects a day-off type and calls onSetDayOffType, toggling off when re-selected', () => {
    const onSetDayOffType = vi.fn()
    render(
      <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={() => {}} onClose={() => {}} onSetDayOffType={onSetDayOffType} />
    )
    fireEvent.click(screen.getByText('Personal'))
    expect(onSetDayOffType).toHaveBeenCalledWith('personal')
  })

  it('deselects an active day-off type when clicked again', () => {
    const onSetDayOffType = vi.fn()
    render(
      <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={() => {}} onClose={() => {}} dayOffType="personal" onSetDayOffType={onSetDayOffType} />
    )
    fireEvent.click(screen.getByText('Personal'))
    expect(onSetDayOffType).toHaveBeenCalledWith(null)
  })

  it('toggles half-day for a type that supports it', () => {
    const onSetDayOffType = vi.fn()
    render(
      <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={() => {}} onClose={() => {}} dayOffType="personal" onSetDayOffType={onSetDayOffType} />
    )
    fireEvent.click(screen.getByTitle('Toggle half day'))
    expect(onSetDayOffType).toHaveBeenCalledWith('personal-half')
  })

  it('disables the half-day toggle for a type that does not support it', () => {
    render(
      <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={() => {}} onClose={() => {}} dayOffType="official" onSetDayOffType={() => {}} />
    )
    expect(screen.getByTitle('Toggle half day')).toBeDisabled()
  })

  it('switches base type while preserving half-day state when the new type allows it', () => {
    const onSetDayOffType = vi.fn()
    render(
      <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={() => {}} onClose={() => {}} dayOffType="personal-half" onSetDayOffType={onSetDayOffType} />
    )
    fireEvent.click(screen.getByText('Sick'))
    expect(onSetDayOffType).toHaveBeenCalledWith('sick-half')
  })

  it('treats a half day off as not fully off, keeping sessions editable', () => {
    const { container } = render(
      <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={() => {}} onClose={() => {}} dayOffType="personal-half" onSetDayOffType={() => {}} />
    )
    expect(container.querySelector('.modal-sessions--dimmed')).toBeNull()
    expect(screen.getByText('+ Add Session')).not.toBeDisabled()
  })

  // handleSave used to do no validation whatsoever, so this whole group of
  // inputs was accepted and quietly produced wrong totals.
  describe('validation', () => {
    function renderWithOneRow(checkIn: string, checkOut: string, onSave = vi.fn()) {
      render(
        <DayEditModal
          dateKey="2024-01-10"
          sessions={[{ checkIn: new Date(2024, 0, 10, 9, 0).toISOString(), checkOut: new Date(2024, 0, 10, 17, 0).toISOString() }]}
          onSave={onSave}
          onClose={() => {}}
          onSetDayOffType={() => {}}
        />
      )
      fireEvent.change(screen.getByLabelText('Check-in time'), { target: { value: checkIn } })
      fireEvent.change(screen.getByLabelText('Check-out time'), { target: { value: checkOut } })
      return onSave
    }

    it('records an overnight shift instead of silently totalling 0h', () => {
      // Both ends used to be pinned to the edited date, so 23:00 -> 01:00 was a
      // negative span that sumSessionsMs clamped to zero. A night shift was
      // structurally impossible to enter.
      const onSave = renderWithOneRow('23:00', '01:00')
      fireEvent.click(screen.getByText('Save'))

      const [, sessions] = onSave.mock.calls[0]
      expect(sessions[0].checkIn).toBe(new Date(2024, 0, 10, 23, 0).toISOString())
      expect(sessions[0].checkOut).toBe(new Date(2024, 0, 11, 1, 0).toISOString())
    })

    it('shows the computed duration and a next-day marker while editing', () => {
      renderWithOneRow('23:00', '01:00')
      expect(screen.getByText('+1d')).toBeInTheDocument()
      expect(screen.getByText('2h')).toBeInTheDocument()
    })

    it('shows the duration for an ordinary same-day session', () => {
      renderWithOneRow('09:00', '17:30')
      expect(screen.queryByText('+1d')).toBeNull()
      expect(screen.getByText('8h 30m')).toBeInTheDocument()
    })

    it('blocks overlapping sessions rather than double-counting them', () => {
      const onSave = vi.fn()
      render(
        <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={onSave} onClose={() => {}} onSetDayOffType={() => {}} />
      )
      // Defaults are 08:00-12:00 and 13:00-17:00; drag the second back over the first.
      fireEvent.change(screen.getAllByLabelText('Check-in time')[1], { target: { value: '11:00' } })
      fireEvent.click(screen.getByText('Save'))

      expect(onSave).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('Sessions overlap')
    })

    it('blocks more than one running session', () => {
      const onSave = vi.fn()
      render(
        <DayEditModal dateKey="2024-01-10" sessions={[]} onSave={onSave} onClose={() => {}} onSetDayOffType={() => {}} />
      )
      fireEvent.change(screen.getAllByLabelText('Check-out time')[0], { target: { value: '' } })
      fireEvent.change(screen.getAllByLabelText('Check-out time')[1], { target: { value: '' } })
      fireEvent.click(screen.getByText('Save'))

      expect(onSave).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('Only one session can be left running.')
    })

    it('disables Save while the entry is invalid', () => {
      renderWithOneRow('', '17:00')
      expect(screen.getByText('Save')).toBeDisabled()
    })

    it('still saves a valid day with no error shown', () => {
      const onSave = renderWithOneRow('09:00', '17:00')
      expect(screen.queryByRole('alert')).toBeNull()
      fireEvent.click(screen.getByText('Save'))
      expect(onSave).toHaveBeenCalled()
    })
  })
})
