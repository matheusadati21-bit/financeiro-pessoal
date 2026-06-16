/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 22px 60px rgba(15, 23, 42, 0.12)',
        glow: '0 0 40px rgba(37, 99, 235, 0.18)'
      },
      colors: {
        ink: '#07111f',
        brand: '#0f6bff',
        mist: '#f6f8fc'
      }
    }
  },
  plugins: []
};
