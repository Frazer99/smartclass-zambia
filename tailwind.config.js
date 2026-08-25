/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf3",
          100: "#d6f8e1",
          200: "#aeefc7",
          300: "#78e0a8",
          400: "#43c887",
          500: "#20ab6c",
          600: "#148a57",
          700: "#126e48",
          800: "#12573b",
          900: "#0f4832",
        },
        accent: {
          500: "#f2a922",
          600: "#d98d0f",
        },
      },
    },
  },
  plugins: [],
};
