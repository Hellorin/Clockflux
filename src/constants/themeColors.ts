// Curated theme color swatches for the Pro "themes" feature. Deliberately a
// short, hand-picked list rather than a free-form color picker: every swatch
// here has been checked against the app's fixed --surface/--text colors (see
// index.css) so users can't accidentally pick a background that breaks
// contrast or clashes with the rest of the UI.
export interface ThemeColorOption {
  name: string
  /** Hex color, or null for "use the app default" (always the first option). */
  value: string | null
}

export const LIGHT_THEME_OPTIONS: ThemeColorOption[] = [
  { name: 'Default', value: null },
  { name: 'Cream', value: '#fffbf5' },
  { name: 'Soft White', value: '#f8fafc' },
  { name: 'Warm Sand', value: '#fdf6e3' },
  { name: 'Blush', value: '#fdf2f8' },
  { name: 'Mint', value: '#f0fdf4' },
  { name: 'Sky', value: '#f0f9ff' },
]

export const DARK_THEME_OPTIONS: ThemeColorOption[] = [
  { name: 'Default', value: null },
  { name: 'Midnight', value: '#1a1a2e' },
  { name: 'Charcoal', value: '#18181b' },
  { name: 'Slate', value: '#0f172a' },
  { name: 'Espresso', value: '#1c1410' },
  { name: 'Forest', value: '#0d1f1a' },
  { name: 'Plum', value: '#1e1330' },
]

export function isValidLightThemeColor(value: string | null): boolean {
  return LIGHT_THEME_OPTIONS.some(option => option.value === value)
}

export function isValidDarkThemeColor(value: string | null): boolean {
  return DARK_THEME_OPTIONS.some(option => option.value === value)
}
