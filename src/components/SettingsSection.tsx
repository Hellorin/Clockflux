import { useState, type ReactNode } from 'react'

interface SettingsSectionProps {
  title: ReactNode
  defaultOpen?: boolean
  /** When false, the section is always expanded and has no header toggle. */
  collapsible?: boolean
  children: ReactNode
}

/** A card used to group a set of related settings on the Settings page. Collapsible by default. */
export default function SettingsSection({ title, defaultOpen = false, collapsible = true, children }: SettingsSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  if (!collapsible) {
    return (
      <div className="settings-section">
        <div className="settings-section__header settings-section__header--static">
          <span className="settings-section__title">{title}</span>
        </div>
        <div className="settings-section__body">{children}</div>
      </div>
    )
  }

  return (
    <div className="settings-section">
      <button
        type="button"
        className="settings-section__header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="settings-section__title">{title}</span>
        <span className="settings-section__chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="settings-section__body">{children}</div>}
    </div>
  )
}
