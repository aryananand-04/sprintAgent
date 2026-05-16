/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── shadcn standard tokens (CSS-variable-backed) ── */
        background:   'var(--background)',
        foreground:   'var(--foreground)',
        card:         { DEFAULT: 'var(--card)',        foreground: 'var(--card-foreground)'       },
        popover:      { DEFAULT: 'var(--popover)',     foreground: 'var(--popover-foreground)'    },
        primary:      { DEFAULT: 'var(--primary)',     foreground: 'var(--primary-foreground)'    },
        secondary:    { DEFAULT: 'var(--secondary)',   foreground: 'var(--secondary-foreground)'  },
        muted:        { DEFAULT: 'var(--muted)',       foreground: 'var(--muted-foreground)'      },
        accent:       { DEFAULT: 'var(--accent)',      foreground: 'var(--accent-foreground)'     },
        destructive:  { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)'},
        border:       'var(--border)',
        input:        'var(--input)',
        ring:         'var(--ring)',

        /* ── Product tokens (CSS-variable-backed, zinc palette) ── */
        ground:  'var(--bg)',
        surface: {
          0: 'var(--s0)',
          1: 'var(--s1)',
          2: 'var(--s2)',
          3: 'var(--s3)',
          4: 'var(--s4)',
        },

        /* ── Decision system ── */
        act: {
          solid:  'var(--act)',
          bg:     'var(--act-bg)',
          border: 'var(--act-bd)',
          text:   'var(--act-t)',
        },
        ask: {
          solid:  'var(--ask)',
          bg:     'var(--ask-bg)',
          border: 'var(--ask-bd)',
          text:   'var(--ask-t)',
        },
        esc: {
          solid:  'var(--esc)',
          bg:     'var(--esc-bg)',
          border: 'var(--esc-bd)',
          text:   'var(--esc-t)',
        },

        /* ── Health ── */
        ok:   'var(--ok)',
        warn: 'var(--warn)',
        crit: 'var(--crit)',
      },

      borderRadius: {
        lg:  'var(--radius)',
        md:  'calc(var(--radius) - 2px)',
        sm:  'calc(var(--radius) - 4px)',
      },

      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'monospace'],
      },

      animation: {
        'pulse-dot': 'pulseDot 2.4s ease-in-out infinite',
        'shimmer':   'shimmer 1.8s ease-in-out infinite',
      },

      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.25' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
