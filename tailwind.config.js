export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#206bc4',
        primaryHover: '#1a569d',
        pageLight: '#f4f6fa',
        surfaceLight: '#ffffff',
        borderLight: '#e6e8eb',
        textLight: '#1d273b',
        mutedLight: '#667382',
        pageDark: '#0e1926',
        surfaceDark: '#182433',
        borderDark: '#1f2d3d',
        textDark: '#f8f9fa',
        mutedDark: '#8a94a6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}