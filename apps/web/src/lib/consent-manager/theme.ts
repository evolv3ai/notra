import type { Theme } from "c15t/tanstack-start";

const colors = {
  primary: "var(--primary)",
  primaryHover: "var(--primary-hover)",
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
  colors: { ...colors, primary: "var(--primary-hover)" },
  dark: {
    ...colors,
    primary: "oklch(0.702 0.183 293.541)",
    primaryHover: "oklch(0.811 0.111 293.571)",
    textOnPrimary: "hsl(233 7% 8%)",
  },
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
