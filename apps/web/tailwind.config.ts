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
      }
    }
  },
  plugins: []
};

export default config;


