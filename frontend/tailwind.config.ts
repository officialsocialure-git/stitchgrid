import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
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
        sans: ["var(--font-plus-jakarta)", "Plus Jakarta Sans", "Inter", "sans-serif"],
        body: ["var(--font-inter)", "Inter", "sans-serif"]
      }
    },
  },
  plugins: [],
};
export default config;

