// Tailwind ships a sparse opacity scale (5, 10, 20, 25...). The design leans on
// in-between values like /8 and /35, so the scale is widened to every integer.
const FULL_OPACITY = Object.fromEntries(
  Array.from({ length: 101 }, (_, i) => [String(i), String(i / 100)]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      opacity: FULL_OPACITY,
      colors: {
        bg: {
          base: "#07090F",
          panel: "#12131C",
          card: "#1A1C28",
        },
        accent: {
          from: "#10E0A0",
          to: "#22C7E0",
          DEFAULT: "#10E0A0",
        },
        text: {
          primary: "#F5F7FA",
          muted: "#8A90A6",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(100deg, #10E0A0 0%, #22C7E0 100%)",
        "aurora":
          "radial-gradient(60% 50% at 15% 0%, rgba(16,224,160,0.16) 0%, transparent 60%), radial-gradient(55% 45% at 85% 5%, rgba(34,199,224,0.14) 0%, transparent 60%)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(16,224,160,0.45), 0 0 28px -4px rgba(16,224,160,0.45)",
        "glow-soft": "0 0 40px -12px rgba(34,199,224,0.5)",
      },
      borderRadius: {
        "2xl": "1rem",
      },
      keyframes: {
        "pulse-marker": {
          "0%, 100%": { opacity: "0.85" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "pulse-marker": "pulse-marker 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
