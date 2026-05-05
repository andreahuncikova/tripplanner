/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.html", "./views/**/*.ejs", "./public/**/*.js", "./*.html"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#F4EFE7",
          deep: "#1A1714",
          ink: "#2A2622",
          muted: "#8A8279",
          border: "rgba(42,38,34,0.12)",
          panel: "#FEFCF8",
          accent: "#E8572A",
          "accent-dark": "#C44A22",
          blue: "#4A90A4",
          green: "#5C9E50",
          purple: "#9B59B6",
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', "sans-serif"],
        serif: ['"Fraunces"', "serif"],
      },
      borderRadius: {
        brand: "12px",
      },
      boxShadow: {
        brand: "0 2px 18px rgba(26,23,20,0.09)",
        auth: "0 24px 60px rgba(0,0,0,0.35)",
      },
      keyframes: {
        liveping: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(92,158,80,0.5)" },
          "50%": { boxShadow: "0 0 0 5px rgba(92,158,80,0)" },
        },
        up: {
          "from": { opacity: "0", transform: "translateY(7px)" },
          "to": { opacity: "1", transform: "none" },
        },
        bounce: {
          "0%, 60%, 100%": { transform: "none" },
          "30%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        liveping: "liveping 1.8s infinite",
        up: "up 0.25s ease both",
      },
    },
  },
  plugins: [],
};