/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Barlow Condensed'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
        body: ["'DM Sans'", "sans-serif"],
      },
      colors: {
        // Brand palette — deep court dark with electric accents
        court: {
          950: "#040610",
          900: "#080d1a",
          850: "#0c1221",
          800: "#101828",
          750: "#141f30",
          700: "#1a2640",
        },
        electric: {
          400: "#00e5ff",
          500: "#00bcd4",
          600: "#0097a7",
        },
        gold: {
          400: "#ffd700",
          500: "#ffb300",
          600: "#f57c00",
        },
        edge: {
          positive: "#00e676",
          negative: "#ff1744",
          neutral: "#90a4ae",
        },
        // Semantic
        surface: {
          1: "#0c1221",
          2: "#101828",
          3: "#141f30",
          4: "#1a2640",
        },
      },
      backgroundImage: {
        "court-gradient": "linear-gradient(135deg, #040610 0%, #0c1221 50%, #08101e 100%)",
        "card-shimmer": "linear-gradient(90deg, transparent, rgba(0,229,255,0.04), transparent)",
        "edge-glow": "linear-gradient(135deg, rgba(0,230,118,0.08), rgba(0,229,255,0.04))",
      },
      boxShadow: {
        "electric": "0 0 20px rgba(0,229,255,0.15), 0 0 60px rgba(0,229,255,0.05)",
        "gold": "0 0 20px rgba(255,215,0,0.15), 0 0 60px rgba(255,215,0,0.05)",
        "card": "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)",
        "card-hover": "0 4px 24px rgba(0,0,0,0.6), 0 0 40px rgba(0,229,255,0.08)",
        "edge-pos": "0 0 30px rgba(0,230,118,0.2)",
        "edge-neg": "0 0 30px rgba(255,23,68,0.2)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2.5s linear infinite",
        "slide-up": "slideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        "fade-in": "fadeIn 0.3s ease",
        "live-dot": "liveDot 1.5s ease-in-out infinite",
        "count-up": "countUp 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        slideUp: {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        liveDot: {
          "0%, 100%": { opacity: 1, transform: "scale(1)" },
          "50%": { opacity: 0.4, transform: "scale(0.8)" },
        },
        countUp: {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
