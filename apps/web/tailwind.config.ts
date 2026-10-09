import type { Config } from "tailwindcss";

const systemFont = [
  "-apple-system",
  "BlinkMacSystemFont",
  "SF Pro Display",
  "SF Pro Text",
  "Inter",
  "Segoe UI",
  "system-ui",
  "sans-serif",
];

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f8ff",
          100: "#e5f1ff",
          200: "#c9e3ff",
          300: "#98c9ff",
          400: "#57a8ff",
          500: "#0a84ff",
          600: "#0071e3",
          700: "#005bb8",
          800: "#00498f",
          900: "#063b72",
          950: "#10233f",
        },
        aqua: {
          50: "#eefcff",
          100: "#d8f7ff",
          200: "#b9efff",
          300: "#7ee2ff",
          400: "#32d2ff",
          500: "#00b8d9",
          600: "#008fad",
        },
        lime: {
          100: "#eefbea",
          300: "#b8ed9a",
          400: "#63da38",
          500: "#30d158",
        },
        coral: {
          50: "#fff2f2",
          100: "#ffe2e2",
          400: "#ff6b6b",
          500: "#ff3b30",
        },
        ember: {
          400: "#ffd60a",
          500: "#ffb340",
          600: "#ff9f0a",
        },
        paper: "#f5f5f7",
        ink: "#1d1d1f",
      },
      fontFamily: {
        sans: systemFont,
        display: systemFont,
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 18px 44px -34px rgba(0,0,0,0.32)",
        lift: "0 18px 42px -28px rgba(0,113,227,0.42)",
      },
    },
  },
  plugins: [],
} satisfies Config;
