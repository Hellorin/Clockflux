export interface ProFeature {
  key: string
  icon: string
  label: string
  description: string
}

// Mirrors the Pro-tier rows of clockflux-subscription-front's
// src/features.ts (FEATURE_ROWS filtered to tier === 'pro'), which itself
// mirrors clockflux-back's Feature/Plan model (internal/domain/feature.go).
// Intentionally duplicated here rather than shared via a package — same
// tradeoff as this app's auth code, see clockflux-subscription-front's
// README — so keep the two lists in sync by hand when a Pro feature is
// added, renamed, or its copy changes.
export const PRO_FEATURES: ProFeature[] = [
  {
    key: 'cloud-sync',
    icon: '☁️',
    label: 'Cloud sync',
    description: 'Keep your sessions, days off, and settings in sync across every device you use Clockflux on — start your day on your phone, finish it on your laptop.',
  },
  {
    key: 'themes',
    icon: '🎨',
    label: 'Custom themes',
    description: 'Pick your own light and dark background colors instead of the defaults, so Clockflux looks like yours.',
  },
  {
    key: 'custom-daily-target',
    icon: '🎯',
    label: 'Custom daily target',
    description: "Set your own expected work hours per day instead of the default 8, so your on-track signals actually match your schedule.",
  },
  {
    key: 'holiday-carryover',
    icon: '🔁',
    label: 'Holiday carryover',
    description: 'Carry unused holiday days over into the new year instead of losing them on January 1st.',
  },
  {
    key: 'export-csv',
    icon: '📊',
    label: 'CSV export',
    description: 'Export your raw time entries as CSV for your own spreadsheets, payroll, or invoicing tools.',
  },
  {
    key: 'export-pdf',
    icon: '📄',
    label: 'PDF export',
    description: 'Generate a clean, ready-to-send PDF report of your hours for any date range — perfect for timesheets.',
  },
  {
    key: 'export-ics',
    icon: '🗓️',
    label: 'Calendar export',
    description: 'Export your sessions as an .ics file to view alongside your other calendars in Google Calendar, Outlook, or Apple Calendar.',
  },
  {
    key: 'unlimited-history',
    icon: '📚',
    label: 'Unlimited history',
    description: 'Access your complete tracking history any time, with nothing archived, trimmed, or hidden away as it gets older.',
  },
]
