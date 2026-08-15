import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` matters if this is ever served from a subpath (e.g. GitHub Pages
// project site). Override with BASE_PATH=/home/ at build time.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  build: {
    target: 'es2022',
  },
})
