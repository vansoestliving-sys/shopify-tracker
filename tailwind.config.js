/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#fff4ed',
          100: '#ffe4d4',
          200: '#ffc8a8',
          300: '#ffa571',
          400: '#ff914d', // Main brand orange
          500: '#ff7a2e',
          600: '#e8651a',
          700: '#c14f16',
          800: '#9a4018',
          900: '#7c3517',
        },
        logo: {
          50: '#f5ede6',
          100: '#e8d5c7',
          200: '#d4b5a0',
          300: '#c4885e', // Logo color
          400: '#b8754a',
          500: '#a8653d',
          600: '#8d5333',
          700: '#72432a',
          800: '#5d3622',
          900: '#4d2d1d',
        },
        accent: {
          50: '#f7f5f3',
          100: '#ede8e3',
          200: '#d2c6b8', // Secondary brand color
          300: '#b8a896',
          400: '#9d8a75',
          500: '#826c54',
        },
        white: '#FFFFFF',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['0.9375rem', { lineHeight: '1.5rem' }], // Slightly smaller base
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      },
    },
  },
  plugins: [],
}

