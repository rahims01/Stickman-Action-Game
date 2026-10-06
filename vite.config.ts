import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cloudflare Workers Static Assets serves the build at the root of its domain
// (<name>.<subdomain>.workers.dev, or a custom domain), so base is '/'
// everywhere and dev and production agree for the first time.
//
// This used to be '/Stickman-Action-Game/' for GitHub Pages, which is why
// src/world/assetPath.ts exists: Vite rewrites asset URLs in HTML and CSS but
// never inside JS string literals, so every runtime-loaded path had to be
// routed through import.meta.env.BASE_URL by hand. That helper still earns its
// place - it keeps the paths correct whatever base is - but with base at '/'
// it is now a no-op in practice.
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
});
