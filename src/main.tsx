import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { installGlobalErrorHandlers, reportError } from './services/errorReportingService'

// Covers what the boundary below can't: throws from event handlers and timers,
// and unhandled promise rejections. Installed before the first render so an
// error during mount is still caught.
installGlobalErrorHandlers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outside App so it survives an error thrown by App's own top-level
        render — a boundary inside the tree it's meant to protect can't catch
        that. */}
    <ErrorBoundary onError={reportError}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
