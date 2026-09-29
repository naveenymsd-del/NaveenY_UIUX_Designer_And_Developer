import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { existsSync, readdirSync } from 'node:fs'

/** optional files actually present in /public (models, audio), so the app never requests missing ones */
function publicFiles() {
  const out: string[] = []
  for (const dir of ['models', 'audio']) {
    const abs = fileURLToPath(new URL(`./public/${dir}`, import.meta.url))
    if (existsSync(abs)) for (const f of readdirSync(abs)) out.push(`/${dir}/${f}`)
  }
  return out
}

export default defineConfig({
  plugins: [react()],
  define: { __PUBLIC_FILES__: JSON.stringify(publicFiles()) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // BASE_PATH is set by the GitHub Pages workflow; local dev and other hosts use '/'
  base: process.env.BASE_PATH || '/',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          physics: ['@react-three/rapier'],
          fx: ['@react-three/postprocessing', 'postprocessing'],
        },
      },
    },
  },
})
