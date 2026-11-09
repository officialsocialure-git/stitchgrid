import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      xs: "375px",
      sm: "480px",
      md: "768px",
      lg: "1024px",
      xl: "1440px",
      "2xl": "1920px",
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: "#5300b7",
          container: "#6d28d9",
          fixed: "#ebddff",
          "fixed-dim": "#d3bbff"
        },
        secondary: {
          DEFAULT: "#565e74",
          container: "#dae2fd",
          fixed: "#dae2fd"
        },
        surface: {
          DEFAULT: "#f8f9ff",
          dim: "#cbdbf5",
          bright: "#f8f9ff",
          container: "#e5eeff",
          "container-low": "#eff4ff",
          "container-high": "#dce9ff",
          "container-highest": "#d3e4fe",
          "container-lowest": "#ffffff"
        },
        on: {
          surface: "#0b1c30",
          "surface-variant": "#4a4455",
          primary: "#ffffff",
          "primary-container": "#dac5ff"
        },
        outline: {
          DEFAULT: "#7b7486",
          variant: "#ccc3d7"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        body: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        heading: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "1.5" }],
        sm: ["14px", { lineHeight: "1.4" }],
        base: ["16px", { lineHeight: "1.5" }],
        lg: ["18px", { lineHeight: "1.2" }],
        xl: ["20px", { lineHeight: "1.2" }],
        "2xl": ["clamp(22px, 1.2vw + 17px, 24px)", { lineHeight: "1.2" }],
        "3xl": ["clamp(28px, 1.8vw + 20px, 32px)", { lineHeight: "1.2" }],
        "4xl": ["clamp(32px, 2.5vw + 22px, 36px)", { lineHeight: "1.2" }],
      },
      fontWeight: {
        regular: "400",
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
      lineHeight: {
        heading: "1.2",
        body: "1.5",
        compact: "1.4",
        caption: "1.5",
      },
    },
  },
  plugins: [],
};
export default config;

