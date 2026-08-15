import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * GitHub Pages has no SPA rewrite rule: a hard load of /brain would 404 before
 * the router ever boots. Pages serves 404.html for unmatched paths, so shipping
 * a copy of index.html under that name lets the app start and route itself.
 */
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const index = join(outDir, 'index.html')
      if (existsSync(index)) copyFileSync(index, join(outDir, '404.html'))
    },
  }
}

// `base` matters when serving from a subpath. The Pages workflow sets
// BASE_PATH to /<repo>/; local dev and preview stay at the root.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), spaFallback()],
  build: {
    target: 'es2022',
  },
})
