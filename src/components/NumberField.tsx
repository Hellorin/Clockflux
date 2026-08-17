import { useState } from 'react'

interface NumberFieldProps {
  value: number
  /** Called with the raw text once the user is done editing. */
  onCommit: (value: string) => void
  /** 'decimal' shows a keypad with a decimal point on mobile; 'numeric' omits it. */
  inputMode?: 'numeric' | 'decimal'
  className?: string
  'aria-label': string
}

/**
 * A numeric input that keeps what the user is typing, rather than round-tripping
 * every keystroke through a parser.
 *
 * Two separate things conspired to make fractional values impossible to enter.
 *
 * The field was controlled and bound straight to the parsed number, so typing
 * "0." gave Number("0.") === 0, state became 0, and the input re-rendered as
 * "0" — eating the decimal point before the next keystroke. The draft state
 * below fixes that half.
 *
 * The other half is subtler and is why this is `type="text"` rather than
 * `type="number"`: HTML's value sanitization for a number input clears `.value`
 * to the empty string whenever the content isn't a *valid* floating-point
 * number, and "7." is not one — the grammar requires digits after the point. So
 * while the browser shows what was typed, `e.target.value` reads "" mid-entry.
 * Keeping a draft would not have helped; the draft would simply have been "".
 * `inputMode` keeps the numeric keypad on mobile, which is what `type="number"`
 * was really buying here.
 *
 * The draft is committed on blur (or Enter), so parsing happens once, when the
 * user has finished. A value arriving from outside — notably the server's
 * clamped response — still shows immediately, because the draft is cleared on
 * commit and is null whenever the field isn't being edited.
 */
export default function NumberField({
  value,
  onCommit,
  inputMode = 'decimal',
  className,
  'aria-label': ariaLabel,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    if (draft === null) return
    onCommit(draft)
    setDraft(null)
  }

  return (
    <input
      type="text"
      inputMode={inputMode}
      className={className}
      value={draft ?? String(value)}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        // Enter is how people finish a numeric field without clicking away.
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      aria-label={ariaLabel}
    />
  )
}
