import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // GATEWAY_URL has no VITE_ prefix, so it stays in this Node process and never reaches the browser.
  const env = loadEnv(mode, process.cwd(), '');
  const gatewayUrl = env.GATEWAY_URL ?? 'http://localhost:3000';

  return {
    plugins: [react()],
    server: {
      // Same-origin API: the browser only calls /api and the dev server forwards it to the gateway.
      proxy: {
        '/api': { target: gatewayUrl, changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
