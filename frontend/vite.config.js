
import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'
import { resolve } from 'path'

import react from '@vitejs/plugin-react'

// Pytron Enforced Config (react)
export default defineConfig({
  base: './', // Critical for file:// protocol
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
