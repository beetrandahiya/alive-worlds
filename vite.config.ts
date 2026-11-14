import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

let sha = 'dev';
try {
  sha = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  /* not a git checkout */
}
const stamp = new Date().toISOString().slice(5, 16).replace('T', ' ');

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(`${sha} · ${stamp} UTC`) },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
