import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this project from https://rahims01.github.io/Stickman-Action-Game/,
// so a production build needs that path as its base or every asset resolves to
// the domain root and 404s. Dev stays at '/' to keep localhost:3000 unchanged.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Stickman-Action-Game/' : '/',
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
}));
