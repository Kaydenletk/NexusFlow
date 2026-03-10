import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#e2e8f0",
        glow: "#f8fafc",
        aurora: "#0f766e",
        coral: "#dc6b52",
        saffron: "#d4a017",
        cloud: "#f3f6f9",
      },
      boxShadow: {
        panel: "0 18px 40px rgba(15, 23, 42, 0.10)",
      },
      backgroundImage: {
        haze:
          "radial-gradient(circle at top left, rgba(212, 160, 23, 0.18), transparent 38%), radial-gradient(circle at top right, rgba(15, 118, 110, 0.16), transparent 32%), linear-gradient(180deg, #fcfbf7 0%, #f5f7fb 100%)",
      },
      fontFamily: {
        sans: ["var(--font-manrope)"],
        mono: ["var(--font-ibm-plex-mono)"],
      },
    },
  },
  plugins: [],
};

export default config;
