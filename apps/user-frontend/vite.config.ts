import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    host: true,
    allowedHosts: ['poker.local', 'admin.poker.local'],
  },

  preview: {
    host: true,
    allowedHosts: ['poker.local', 'admin.poker.local'],
  },
});