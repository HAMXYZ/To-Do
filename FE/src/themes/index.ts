export const THEME_COLORS = {
  primary: {
    DEFAULT: "#22c55e",
    hover: "#16a34a",
    light: "#dcfce7",
    dark: "#14532d",
  },
  accent: {
    orange: "#ea580c",
    amber: "#f59e0b",
    blue: "#3b82f6",
    purple: "#8b5cf6",
  },
  neutral: {
    bgLight: "#faf8f5",
    bgDark: "#121b14",
    surfaceLight: "#ffffff",
    surfaceDark: "#19261c",
    textLight: "#1c2e22",
    textDark: "#e4efe6",
    mutedLight: "#8b9a8e",
    mutedDark: "#526d57",
  },
} as const

export type ThemeMode = "light" | "dark" | "system"

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  const isDark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  if (isDark) {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
}
