import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The build writes index.html and assets/ into public/, next to index.php, so the PHP server
// serves the app and the API from one origin. In development, Vite proxies /api to PHP.
// PHP runs on 8100 because 8000 is used by the Neulix project.
export default defineConfig({
  root: '.',
  base: '/',
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: false,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8100',
    },
  },
});
