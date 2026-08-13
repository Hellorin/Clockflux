import { useInstallPrompt } from '../hooks/useInstallPrompt'

/**
 * Floating "Install Clockflux" banner. Renders nothing until the browser has
 * offered an install (via `beforeinstallprompt`) and the offer hasn't
 * already been accepted or dismissed on this device — see useInstallPrompt.
 */
export default function InstallPrompt() {
  const { canInstall, promptInstall, dismiss } = useInstallPrompt()

  if (!canInstall) return null

  return (
    <div className="install-prompt" role="complementary" aria-label="Install Clockflux">
      <span className="install-prompt-icon" aria-hidden="true">⏱️</span>
      <div className="install-prompt-body">
        <p className="install-prompt-title">Install Clockflux</p>
        <p className="install-prompt-text">Add it to your home screen for one-tap check-ins, even offline.</p>
      </div>
      <div className="install-prompt-actions">
        <button type="button" className="install-prompt-dismiss-btn" onClick={dismiss}>Not now</button>
        <button type="button" className="install-prompt-install-btn" onClick={promptInstall}>Install</button>
      </div>
    </div>
  )
}
