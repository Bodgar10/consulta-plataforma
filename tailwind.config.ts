import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pine: {
          900: "#1F332E",
          700: "#2E4A44",
          600: "#3C6E63",
          400: "#6B9086",
          200: "#B8CFC8",
          50:  "#E8F0ED",
        },
        cream: {
          0:  "#FBFAF7",
          50: "#F4F1EA",
        },
        sand: {
          200: "#E4DDCF",
          300: "#D8D2C4",
          500: "#A89F8C",
          700: "#7A7161",
        },
        clay: {
          600: "#C96F4A",
          700: "#A85636",
          100: "#F2E0D6",
        },
        success: { 600: "#3C6E63", 50: "#E8F0ED" },
        warning: { 600: "#B8863C", 50: "#F5EDDC" },
        danger:  { 600: "#B5503C", 50: "#F2E2DC" },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      // Token de tamaño de texto de cuerpo, consumido por `.field` en globals.css
      // (A1 usa `text-body`; sin este token el build de Tailwind falla). 1rem = 16px,
      // tamaño idóneo para inputs (evita el zoom automático en iOS).
      fontSize: {
        body: ["1rem", { lineHeight: "1.5rem" }],
      },
      borderRadius: {
        sm: "7px",
        md: "10px",
        lg: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
