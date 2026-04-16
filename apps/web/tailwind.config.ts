import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base: "#F5F7FA",
          elevated: "#FFFFFF"
        },
        accent: {
          start: "#0F3C78",
          end: "#1C6ED5"
        }
      },
      borderRadius: {
        xl: "16px"
      },
      boxShadow: {
        glow: "0 0 0 3px rgba(95, 168, 255, 0.32)",
        glass: "0 16px 42px rgba(15, 23, 42, 0.18)"
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #0F3C78 0%, #1C6ED5 100%)"
      },
      animation: {
        "page-in":    "page-in 0.22s cubic-bezier(0.2,0.8,0.2,1) both",
        "flash-out":  "flash-out 0.25s ease-out both",
        "scale-in":   "scale-in 0.18s cubic-bezier(0.2,0.8,0.2,1) both",
        "fade-in":    "fade-in 0.2s ease both",
      },
      keyframes: {
        "page-in":   { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "flash-out": { from: { opacity: "0.9" }, to: { opacity: "0" } },
        "scale-in":  { from: { opacity: "0", transform: "scale(0)" }, to: { opacity: "1", transform: "scale(1)" } },
        "fade-in":   { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      }
    }
  },
  plugins: []
};

export default config;


