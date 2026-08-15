import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useFocusTrap } from './useFocusTrap'

/**
 * Both modals declared role="dialog"/aria-modal="true" and handled Escape, but
 * neither confined focus — so Tab walked straight out into the page behind,
 * which is still fully interactive. For a keyboard or screen reader user the
 * dialog is announced as modal and then simply isn't: you tab out of it into
 * content you can't see and can't get back from.
 */
function Dialog({ withDisabled = false }: { withDisabled?: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>()
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Test dialog">
      <button>first</button>
      {withDisabled && <button disabled>skipped</button>}
      <button>last</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('focuses the first control on open', () => {
    render(<Dialog />)
    expect(screen.getByText('first')).toHaveFocus()
  })

  it('wraps Tab from the last control back to the first', () => {
    render(<Dialog />)
    const last = screen.getByText('last')
    last.focus()

    fireEvent.keyDown(document, { key: 'Tab' })

    expect(screen.getByText('first')).toHaveFocus()
  })

  it('wraps Shift+Tab from the first control to the last', () => {
    render(<Dialog />)

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })

    expect(screen.getByText('last')).toHaveFocus()
  })

  it('pulls focus back in if it escaped some other way', () => {
    // A click on the page behind, say. Without this the trap only holds while
    // focus happens to already be inside.
    render(
      <>
        <button>outside</button>
        <Dialog />
      </>
    )
    screen.getByText('outside').focus()

    fireEvent.keyDown(document, { key: 'Tab' })

    expect(screen.getByText('first')).toHaveFocus()
  })

  it('skips a disabled control when wrapping', () => {
    // A disabled button still matches the tag selector but isn't tabbable, so
    // including it would wrap focus to a stop the user can't see.
    render(<Dialog withDisabled />)
    screen.getByText('last').focus()

    fireEvent.keyDown(document, { key: 'Tab' })

    expect(screen.getByText('first')).toHaveFocus()
  })

  it('restores focus to whatever had it before the dialog opened', () => {
    render(<button>opener</button>)
    const opener = screen.getByText('opener')
    opener.focus()

    const { unmount } = render(<Dialog />)
    expect(screen.getByText('first')).toHaveFocus()

    unmount()

    // Otherwise closing drops focus to <body> and a keyboard user restarts
    // from the top of the page.
    expect(opener).toHaveFocus()
  })

  it('leaves other keys alone', () => {
    render(<Dialog />)
    const last = screen.getByText('last')
    last.focus()

    fireEvent.keyDown(document, { key: 'a' })

    expect(last).toHaveFocus()
  })
})
