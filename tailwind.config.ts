import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    fontFamily: {
      sans: ['var(--font-plus-jakarta)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
    },
    extend: {
      colors: {
        // Fine & Country Brand Colors
        brand: {
          white: '#FFFFFF',
          light: '#F9FAFB',
          gold: '#C5A059',
          black: '#1A1A1A',
          grey: '#6B7280',
          slate: '#334155',
          cream: '#FDFBF7',
          divider: '#E5E7EB',
          border: '#E5E7EB',
        },
        // Legacy Aliases (for compatibility)
        fcGold: '#C5A059',
        fcDivider: '#E5E7EB',
        fcText: '#1A1A1A',
        fcBorder: '#E5E7EB',
        // Shadcn UI Theme Colors (mapped to F&C brand)
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      boxShadow: {
        'forensic': '0 4px 30px rgba(0, 0, 0, 0.03)',
        'forensic-sm': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'forensic-lg': '0 10px 40px rgba(0, 0, 0, 0.08)',
      },
    }
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
