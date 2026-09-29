/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        board: "hsl(158 37% 14%)",
        "board-deep": "hsl(158 38% 9%)",
        chalk: "hsl(46 27% 94%)",
        gold: "hsl(41 76% 60%)",
        "gold-deep": "hsl(38 58% 37%)",
        rust: "hsl(17 59% 45%)",
        teal: "hsl(163 34% 36%)",
        ink: "hsl(148 37% 10%)",
        paper: "hsl(40 35% 87%)",
        "paper-edge": "hsl(40 35% 74%)",
        "muted-board": "hsl(158 15% 60%)",
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
