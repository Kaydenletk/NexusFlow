import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./popup.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        aurora: "#0f766e",
        saffron: "#d4a017",
        coral: "#dc6b52",
        cloud: "#eff4f7",
      },
      boxShadow: {
        panel: "0 18px 40px rgba(15, 23, 42, 0.16)",
      },
    },
  },
  plugins: [],
};

export default config;
