import type { Theme } from "c15t/tanstack-start";

const colors = {
  primary: "var(--primary)",
  primaryHover: "color-mix(in oklab, var(--primary) 90%, transparent)",
  surface: "var(--card)",
  surfaceHover: "var(--secondary)",
  border: "var(--border)",
  borderHover: "var(--ring)",
  text: "var(--foreground)",
  textMuted: "var(--muted-foreground)",
  textOnPrimary: "var(--primary-foreground)",
  overlay: "hsl(0 0% 0% / 0.5)",
  switchTrack: "var(--input)",
  switchTrackActive: "var(--primary)",
  switchThumb: "var(--card)",
};

const radius = {
  sm: "calc(0.625rem - 4px)",
  md: "calc(0.625rem - 2px)",
  lg: "0.625rem",
};

export const consentTheme = {
  colors,
  dark: colors,
  typography: {
    fontFamily: "var(--font-inter)",
  },
  radius,
} satisfies Theme;

const smoothingStyle = {
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
} as const;

export const consentComponents = {
  banner: {
    root: { style: smoothingStyle },
    card: { style: smoothingStyle },
  },
  dialog: { root: { style: smoothingStyle }, card: { style: smoothingStyle } },
};
