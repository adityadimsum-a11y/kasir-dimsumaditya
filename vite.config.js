import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 🔥 SUNTIKAN ANTI BAWEL: Naikin batas warning ke 2000 KB (2 MB)
    chunkSizeWarningLimit: 2000,
  }
})
