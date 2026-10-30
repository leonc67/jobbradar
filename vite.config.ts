import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relativ base så siden fungerer på https://<bruker>.github.io/<repo>/
export default defineConfig({
  base: './',
  plugins: [react()],
});
