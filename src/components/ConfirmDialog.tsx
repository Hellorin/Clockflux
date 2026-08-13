import { useEffect, useCallback } from 'react'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Renders the confirm button as a destructive (red) action. */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * A small "are you sure?" popup, styled after the app's existing modal
 * (see DayEditModal) rather than the browser's native window.confirm.
 */
export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancel()
  }, [onCancel])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="modal-backdrop">
      <button type="button" className="modal-backdrop__scrim" onClick={onCancel} aria-label="Close dialog" />
      <div className="modal" role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button type="button" className="modal-close-btn" onClick={onCancel} aria-label="Close">×</button>
        </div>

        <p className="modal-confirm-message">{message}</p>

        <div className="modal-actions modal-actions--split">
          <button type="button" className="modal-secondary-btn" onClick={onCancel}>{cancelLabel}</button>
          <button
            type="button"
            className={`modal-save-btn${danger ? ' modal-save-btn--danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
