import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["78c188d74732.ngrok-free.app" ]  // Allow this ngrok host
  }
});