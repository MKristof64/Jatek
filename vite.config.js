import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const productionCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://0.peerjs.com wss://0.peerjs.com https://*.workers.dev https://*.pages.dev",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "manifest-src 'self'",
  "worker-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

function productionSecurityMeta() {
  return {
    name: 'production-security-meta',
    transformIndexHtml(html, context) {
      if (context.server) return html;

      return html.replace(
        '<meta name="theme-color" content="#090018" />',
        `<meta name="theme-color" content="#090018" />\n    <meta http-equiv="Content-Security-Policy" content="${productionCsp}" />`,
      );
    },
  };
}

export default defineConfig({
  base: '/Jatek/',
  plugins: [react(), productionSecurityMeta()],
});
