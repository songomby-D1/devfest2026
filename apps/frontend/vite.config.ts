import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Candidate policy from ADR 0001 for the self-hosted Draco decoder, checked in preview only.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  'worker-src blob:',
  // GLTFLoader fetches GLB-embedded textures through blob: URLs.
  "connect-src 'self' blob:",
  "img-src 'self' blob: data:",
  // model-viewer 4.4.0 ships an inline <style> in its shadow template.
  "style-src 'self' 'unsafe-inline'",
].join('; ');

export default defineConfig({
  plugins: [react()],
  preview: {
    headers: { 'Content-Security-Policy': contentSecurityPolicy },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
