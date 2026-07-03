// Espejo TS de los tokens del design system (Doc D).
// Fuente única junto con globals.css y tailwind.config.ts.
// Úsalo donde Tailwind no llega: emails de Resend, charts, valores dinámicos en JS.
// Si cambia un color, cambia AQUÍ y en tailwind.config.ts. No en los dos lugares con valores distintos.

export const tokens = {
  color: {
    pine: {
      900: "#1F332E",
      700: "#2E4A44",
      600: "#3C6E63",
      400: "#6B9086",
      200: "#B8CFC8",
      50: "#E8F0ED",
    },
    cream: {
      0: "#FBFAF7",
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
    state: {
      successFg: "#3C6E63",
      successBg: "#E8F0ED",
      warningFg: "#B8863C",
      warningBg: "#F5EDDC",
      dangerFg: "#B5503C",
      dangerBg: "#F2E2DC",
    },
  },
  radius: { sm: "7px", md: "10px", lg: "14px", full: "999px" },
  font: {
    display: '"Fraunces", Georgia, serif',
    body: '"Inter", system-ui, sans-serif',
  },
} as const;

export type DesignTokens = typeof tokens;
