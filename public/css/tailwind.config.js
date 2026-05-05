module.exports = {
  content: ["./index.html", "./js/**/*.js"],
  theme: {
    extend: {
      colors: {
        bg: "#F4EFE7",
        deep: "#1A1714",
        ink: "#2A2622",
        muted: "#8A8279",
        panel: "#FEFCF8",
        accent: "#E8572A",
        blue: "#4A90A4",
        green: "#5C9E50",
        purple: "#9B59B6",
      },
      borderRadius: {
        xl: "12px",
        "2xl": "20px",
      },
      boxShadow: {
        soft: "0 2px 18px rgba(26,23,20,.09)",
        modal: "0 24px 60px rgba(0,0,0,.35)",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        serif: ["Fraunces", "serif"],
      },
    },
  },
  plugins: [],
};