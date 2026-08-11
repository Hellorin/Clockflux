import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ThemeColorOption } from '../constants/themeColors'

interface ThemeColorDropdownProps {
  groupLabel: string
  options: ThemeColorOption[]
  selected: string | null
  onSelect: (value: string | null) => void
  /** Called as the user hovers/focuses an option, before committing it. */
  onPreview: (value: string | null) => void
  /** Called when the preview should end: pointer leaves the list, or it closes. */
  onPreviewEnd: () => void
}

interface ListPosition {
  top: number
  right: number
}

/**
 * A custom (non-native) dropdown for picking a theme color. A native
 * <select> can't fire hover events on its options in most browsers (the
 * option list is OS-rendered), and previewing the app visibly change theme
 * as you hover an option is the whole point of this control.
 *
 * The option list is portaled to <body> and positioned by the trigger's
 * bounding rect rather than nested in normal flow: the Settings page's
 * cards clip their contents (rounded-corner backgrounds), which would
 * otherwise crop the list instead of letting it float above everything.
 */
export default function ThemeColorDropdown({ groupLabel, options, selected, onSelect, onPreview, onPreviewEnd }: ThemeColorDropdownProps) {
  const [open, setOpen] = useState(false)
  const [listPos, setListPos] = useState<ListPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const current = options.find(option => option.value === selected) ?? options[0]

  const close = useCallback(() => {
    setOpen(false)
    onPreviewEnd()
  }, [onPreviewEnd])

  // Keep the portaled list glued under the trigger while open (window
  // resize, or the settings page itself scrolling).
  useEffect(() => {
    if (!open) return
    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setListPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return
      close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, close])

  function choose(value: string | null) {
    onSelect(value)
    close()
  }

  return (
    <>
      <button
          ref={triggerRef}
          type="button"
          className="settings-theme-dropdown__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={groupLabel}
          onClick={() => (open ? close() : setOpen(true))}
      >
        <ThemeSwatch option={current} />
        <span>{current.name}</span>
        <span className="settings-theme-dropdown__caret" aria-hidden="true">▾</span>
      </button>
      {open && listPos && createPortal(
        <ul
            ref={listRef}
            className="settings-theme-dropdown__list"
            role="listbox"
            aria-label={groupLabel}
            style={{ top: listPos.top, right: listPos.right }}
            onMouseLeave={onPreviewEnd}
        >
          {options.map(option => (
            <li key={option.name} role="presentation">
              <button
                  type="button"
                  role="option"
                  aria-selected={option.value === selected}
                  className={`settings-theme-dropdown__option${option.value === selected ? ' settings-theme-dropdown__option--selected' : ''}`}
                  onMouseEnter={() => onPreview(option.value)}
                  onFocus={() => onPreview(option.value)}
                  onClick={() => choose(option.value)}
                  onKeyDown={e => { if (e.key === 'Escape') close() }}
              >
                <ThemeSwatch option={option} />
                <span>{option.name}</span>
              </button>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </>
  )
}

function ThemeSwatch({ option }: { option: ThemeColorOption }) {
  return (
    <span
        className={`settings-swatch${option.value === null ? ' settings-swatch--default' : ''}`}
        style={option.value ? { backgroundColor: option.value } : undefined}
        aria-hidden="true"
    />
  )
}
