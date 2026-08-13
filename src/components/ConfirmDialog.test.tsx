import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmDialog from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders the title, message, and custom button labels', () => {
    render(
      <ConfirmDialog
        title="Cancel subscription?"
        message="You'll keep access until the period ends."
        confirmLabel="Cancel subscription"
        cancelLabel="Keep subscription"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText('Cancel subscription?')).toBeInTheDocument()
    expect(screen.getByText("You'll keep access until the period ends.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep subscription' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel subscription' })).toBeInTheDocument()
  })

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog title="t" message="m" onConfirm={onConfirm} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when the cancel button, close button, scrim, or Escape is used', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog title="t" message="m" onConfirm={() => {}} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onCancel).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(onCancel).toHaveBeenCalledTimes(3)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(4)
  })
})
