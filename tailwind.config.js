/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        paper: "#EEF0E7",
        ink: "#1B2A2E",
        teal: "#1F5C57",
        gold: "#C9971C",
        brand: "#1F5C57",
        brandlight: "#E3ECE9",
        navy: "#122326",
      },
    },
  },
  plugins: [],
};
