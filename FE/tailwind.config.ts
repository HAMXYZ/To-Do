import type { Config } from "tailwindcss"

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#22c55e",
          hover: "#16a34a",
          light: "#dcfce7",
          dark: "#14532d",
        },
      },
    },
  },
  plugins: [],
} satisfies Config
