import { useState, type ReactNode } from 'react'

interface SettingsSectionProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

/** A collapsible card used to group a set of related settings on the Settings page. */
export default function SettingsSection({ title, defaultOpen = false, children }: SettingsSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

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
