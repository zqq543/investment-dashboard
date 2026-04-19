/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    'ring-1', 'ring-accent/20', 'ring-accent/30',
    'bg-gradient-to-br', 'from-card', 'to-accent/5',
    'text-positive', 'text-negative', 'text-accent',
    'text-muted-foreground',
    'bg-blue-500/15', 'text-blue-500',
    'bg-green-600/15', 'text-green-600',
    'bg-positive/15', 'bg-negative/15', 'bg-accent/15',
    'animate-spin', 'animate-fade-in',
    'divide-y', 'divide-border', 'hover:bg-muted/40',
    'tabular-nums', 'num-truncate',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-geist-sans)',
          '"Noto Sans TC"',
          '"PingFang TC"',
          '"Microsoft JhengHei"',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'var(--font-geist-mono)',
          '"Noto Sans Mono"',
          'monospace',
        ],
      },
      colors: {
        border:     'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        positive: 'hsl(var(--positive))',
        negative:  'hsl(var(--negative))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}
