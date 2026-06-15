import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  server: { host: true, port: 5173 },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        preview: fileURLToPath(new URL('./preview.html', import.meta.url)),
      },
    },
  },
})
