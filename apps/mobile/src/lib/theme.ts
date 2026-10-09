// Hyntor design tokens - mirrors the web palette
// (apps/web/tailwind.config.ts) so both platforms feel like one product.
// TODO: migrate styling to NativeWind for full Tailwind parity.
export const colors = {
  brand950: "#10233f",
  brand900: "#063b72",
  brand700: "#005bb8",
  brand600: "#0071e3",
  brand500: "#0a84ff",
  brand300: "#98c9ff",
  brand100: "#e5f1ff",
  brand50: "#f2f8ff",
  ember500: "#ff9f0a",
  ember400: "#ffd60a",
  paper: "#f5f5f7",
  ink: "#1d1d1f",
  slate400: "#8e8e93",
  slate500: "#6e6e73",
  slate600: "#424245",
  slate200: "#d2d2d7",
  white: "#ffffff",
  rose50: "#fff2f2",
  rose700: "#d70015",
  emerald100: "#eafbea",
  emerald800: "#248a3d",
  amber50: "#fff8e1",
  amber800: "#a86400",
};

export const radius = { md: 10, lg: 14, xl: 20 };

export const TIER_LABELS: Record<number, string> = {
  0: "Full explanation",
  1: "Nudge",
  2: "Guiding question",
  3: "Concept + example",
  4: "Walkthrough",
};
