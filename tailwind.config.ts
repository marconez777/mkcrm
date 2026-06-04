import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        site: {
          bg: "hsl(var(--site-bg))",
          surface: "hsl(var(--site-surface))",
          "surface-2": "hsl(var(--site-surface-2))",
          border: "hsl(var(--site-border))",
          text: "hsl(var(--site-text))",
          muted: "hsl(var(--site-muted))",
          primary: {
            DEFAULT: "hsl(var(--site-primary))",
            foreground: "hsl(var(--site-primary-foreground))",
            glow: "hsl(var(--site-primary-glow))",
          },
          accent: {
            DEFAULT: "hsl(var(--site-accent))",
            glow: "hsl(var(--site-accent-glow))",
          },
        },
        admin: {
          bg: "hsl(var(--admin-bg))",
          surface: "hsl(var(--admin-surface))",
          "surface-2": "hsl(var(--admin-surface-2))",
          "surface-elev": "hsl(var(--admin-surface-elev))",
          border: "hsl(var(--admin-border))",
          "border-strong": "hsl(var(--admin-border-strong))",
          text: "hsl(var(--admin-text))",
          "text-muted": "hsl(var(--admin-text-muted))",
          "text-subtle": "hsl(var(--admin-text-subtle))",
          primary: {
            DEFAULT: "hsl(var(--admin-primary))",
            foreground: "hsl(var(--admin-primary-foreground))",
            soft: "hsl(var(--admin-primary-soft))",
          },
          accent: {
            DEFAULT: "hsl(var(--admin-accent))",
            soft: "hsl(var(--admin-accent-soft))",
          },
          positive: { DEFAULT: "hsl(var(--admin-positive))", soft: "hsl(var(--admin-positive-soft))" },
          negative: { DEFAULT: "hsl(var(--admin-negative))", soft: "hsl(var(--admin-negative-soft))" },
          warning: { DEFAULT: "hsl(var(--admin-warning))", soft: "hsl(var(--admin-warning-soft))" },
          sidebar: {
            bg: "hsl(var(--admin-sidebar-bg))",
            surface: "hsl(var(--admin-sidebar-surface))",
            border: "hsl(var(--admin-sidebar-border))",
            text: "hsl(var(--admin-sidebar-text))",
            "text-active": "hsl(var(--admin-sidebar-text-active))",
            muted: "hsl(var(--admin-sidebar-muted))",
            "active-bg": "hsl(var(--admin-sidebar-active-bg))",
          },
        },
      },
      boxShadow: {
        "admin-card": "var(--admin-shadow-card)",
        "admin-elev": "var(--admin-shadow-elev)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
