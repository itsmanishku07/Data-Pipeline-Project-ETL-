import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use environment variable for backend API URL with localhost fallback
const API_TARGET = process.env.VITE_API_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
