import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The build writes index.html and assets/ into public/, next to index.php, so the PHP server
// serves the app and the API from one origin. In development, Vite proxies /api to PHP.
// PHP runs on 8100 because 8000 is used by the Neulix project.
//
// "vite build --mode ionos" makes the build for a subfolder of shared hosting: addresses are relative, so the same
// files work in any folder, and the result goes to ../deploy/dist for deploy/deploy.ps1.
export default defineConfig(({ mode }) => {
  const hosted = mode === 'ionos';
  return {
    root: '.',
    base: hosted ? './' : '/',
    plugins: [react()],
    build: {
      outDir: hosted ? '../deploy/dist' : '../public',
      emptyOutDir: hosted,
    },
    server: {
      proxy: {
        '/api': 'http://localhost:8100',
      },
    },
  };
});
