import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  safelist: [
    // Classes responsive critiques pour le module Tâches
    'hidden', 'block', 'flex', 'grid',
    'sm:hidden', 'sm:block', 'sm:flex', 'sm:grid', 
    'md:hidden', 'md:block', 'md:flex', 'md:grid',
    'lg:hidden', 'lg:block', 'lg:flex', 'lg:grid',
    'grid-cols-1', 'sm:grid-cols-2', 'sm:grid-cols-3', 'lg:grid-cols-4',
    'min-h-[44px]', 'text-base', 'text-sm', 'text-xs',
    'p-3', 'p-4', 'px-3', 'px-4', 'py-2', 'py-3',
    'gap-2', 'gap-3', 'gap-4', 'sm:gap-4',
    'order-1', 'order-2', 'sm:order-1', 'sm:order-2',
    'flex-col', 'sm:flex-row', 'justify-stretch', 'sm:justify-end',
    // Classes pour alertes appels clients (production-safe)
    'bg-orange-50', 'border-orange-200', 'text-orange-700', 'bg-orange-600', 'hover:bg-orange-700',
    'bg-green-600', 'hover:bg-green-700', 'bg-blue-600', 'hover:bg-blue-700',
    'sticky', 'top-0', 'z-50', 'cursor-pointer',
    'max-w-2xl', 'w-full', 'mx-4', 'max-h-[80vh]', 'overflow-y-auto'
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
