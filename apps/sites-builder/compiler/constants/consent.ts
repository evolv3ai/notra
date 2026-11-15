export const CONSENT_SITE_COLORS = {
  primary: "var(--primary-button)",
  primaryHover:
    "color-mix(in oklab, var(--primary-button) 88%, var(--foreground))",
  textOnPrimary: "var(--primary-foreground)",
  surface: "var(--card)",
  surfaceHover: "var(--muted)",
  border: "var(--border)",
  borderHover: "color-mix(in oklab, var(--foreground) 20%, var(--border))",
  text: "var(--foreground)",
  textMuted: "var(--muted-foreground)",
  overlay: "color-mix(in oklab, var(--background) 60%, transparent)",
  switchTrack: "color-mix(in oklab, var(--foreground) 15%, var(--muted))",
  switchTrackActive: "var(--primary-button)",
  switchThumb: "var(--card)",
} as const;

export const CONSENT_RADII = {
  none: { sm: "0", md: "0", lg: "0" },
  small: { sm: "0.25rem", md: "0.375rem", lg: "0.5rem" },
  medium: { sm: "0.375rem", md: "0.5rem", lg: "0.75rem" },
  large: { sm: "0.5rem", md: "0.75rem", lg: "1rem" },
} as const;

export const CONSENT_SHADOWS = {
  sm: "0 1px 2px color-mix(in oklab, black 6%, transparent)",
  md: "0 2px 8px color-mix(in oklab, black 8%, transparent)",
  lg: "0 8px 24px color-mix(in oklab, black 10%, transparent)",
} as const;

export const DATABUDDY_CONNECTION_KEYS = new Set([
  "clientId",
  "scriptUrl",
  "apiUrl",
  "replay",
]);
