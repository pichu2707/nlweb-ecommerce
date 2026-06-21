import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  server: {
    port: 5173,
    proxy: {
      '/search': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    }
  }
})
