import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { APP_NAME } from './src/config.ts'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'app-name',
      transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP_NAME),
    },
  ],
})
