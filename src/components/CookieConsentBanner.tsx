interface CookieConsentBannerProps {
  onAccept: () => void
  onRefuse: () => void
}

// Static markup only — App decides whether to mount this (consent not yet
// given, landing page not open) so it stays simple and easy to test in
// isolation. The "Read more" link reuses the #privacy deep link that
// useLandingPage already listens for, so it opens the full notice rather
// than duplicating it here.
export default function CookieConsentBanner({ onAccept, onRefuse }: CookieConsentBannerProps) {
  return (
    <div className="cookie-consent" role="region" aria-label="Cookie preferences">
      <p className="cookie-consent__text">
        Clockflux would like to use privacy-friendly analytics (Vercel Web Analytics) to
        see how the app gets used. It sets no cookies and cannot identify you across
        visits. If you refuse, analytics simply does not load — the hours you track stay
        local either way. <a href="#privacy">Read more</a>.
      </p>
      <div className="cookie-consent__actions">
        <button
          type="button"
          className="cookie-consent__btn cookie-consent__btn--refuse"
          onClick={onRefuse}
        >
          Refuse
        </button>
        <button
          type="button"
          className="cookie-consent__btn cookie-consent__btn--accept"
          onClick={onAccept}
        >
          Accept
        </button>
      </div>
    </div>
  )
}
