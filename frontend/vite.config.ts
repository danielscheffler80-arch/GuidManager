import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/auth': {
        target: 'https://guild-manager-backend.onrender.com',
        changeOrigin: true,
      },
    },
  }
});
