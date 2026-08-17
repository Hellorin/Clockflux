import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NumberField from './NumberField'

/**
 * These fields were controlled inputs bound straight to the parsed number, so
 * every keystroke round-tripped through Number(). Typing "0." gave
 * Number("0.") === 0, the input re-rendered as "0", and the decimal point was
 * eaten before the next keystroke — making 0.5 and 7.5 impossible to enter on a
 * field whose own step is 0.5.
 */
describe('NumberField', () => {
  it('lets a decimal be typed one character at a time', () => {
    const onCommit = vi.fn()
    render(<NumberField value={8} onCommit={onCommit} aria-label="Daily target hours" />)
    const input = screen.getByLabelText('Daily target hours')

    fireEvent.change(input, { target: { value: '7' } })
    fireEvent.change(input, { target: { value: '7.' } })
    // The intermediate state has to survive, or the next keystroke appends to
    // "7" instead of "7." and the user gets 75.
    // Asserted on the raw string. This is the crux: with type="number" the
    // browser's value sanitization clears .value to "" for "7." because it is
    // not a valid floating-point number, so the draft would have been "" and
    // the next keystroke would have produced 5 rather than 7.5.
    expect(input).toHaveValue('7.')
    fireEvent.change(input, { target: { value: '7.5' } })
    fireEvent.blur(input)

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('7.5')
  })

  it('does not commit on every keystroke', () => {
    const onCommit = vi.fn()
    render(<NumberField value={8} onCommit={onCommit} aria-label="Daily target hours" />)

    fireEvent.change(screen.getByLabelText('Daily target hours'), { target: { value: '6' } })

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('lets the field be cleared without snapping to zero mid-edit', () => {
    render(<NumberField value={25} onCommit={vi.fn()} aria-label="Annual holiday allowance" />)
    const input = screen.getByLabelText('Annual holiday allowance')

    fireEvent.change(input, { target: { value: '' } })

    expect(input).toHaveValue('')
  })

  it('commits on Enter', () => {
    const onCommit = vi.fn()
    render(<NumberField value={8} onCommit={onCommit} aria-label="Daily target hours" />)
    const input = screen.getByLabelText('Daily target hours')

    fireEvent.change(input, { target: { value: '6' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)

    expect(onCommit).toHaveBeenCalledWith('6')
  })

  it('shows a value that arrives from outside once editing has finished', () => {
    // The server clamps Pro-only values for a caller whose plan doesn't unlock
    // them, and that clamped response has to be what the user ends up seeing.
    const { rerender } = render(<NumberField value={6} onCommit={vi.fn()} aria-label="Daily target hours" />)
    const input = screen.getByLabelText('Daily target hours')
    fireEvent.change(input, { target: { value: '6' } })
    fireEvent.blur(input)

    rerender(<NumberField value={8} onCommit={vi.fn()} aria-label="Daily target hours" />)

    expect(input).toHaveValue('8')
  })
})
