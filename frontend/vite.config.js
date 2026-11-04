import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Nunca se actualiza a la fuerza: una recarga borraría lo que la persona está escribiendo.
      registerType: 'prompt',
      // Plan de retirada: desplegar con esta variable desinstala el service worker de quien lo tenga.
      selfDestroying: process.env.VITE_PWA_DESACTIVADA === 'true',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Directorio BIESS',
        short_name: 'BIESS',
        description: 'Registro y postulación al Concurso Público de Méritos y Oposición del Directorio del BIESS',
        id: '/',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        icons: [
          { src: '/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icono-adaptable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Con capturas, Chrome muestra un panel de instalación más completo.
        screenshots: [
          { src: '/capturas/acceso-ancho.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'Acceso de postulantes' },
          { src: '/capturas/administracion-ancho.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'Módulo de administración' },
          { src: '/capturas/acceso-telefono.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Acceso desde el teléfono' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png}'],
        // El sistema está en español: solo se guardan las letras latinas de la fuente.
        globIgnores: ['**/*-{cyrillic,cyrillic-ext,vietnamese}-*', 'capturas/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // Lista cerrada: el expediente, la sesión y la administración nunca quedan en el dispositivo.
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              /\/api\/catalogos\/(paises|provincias|cantones|parentescos|niveles|areas|sectores|inhabilidades)$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'catalogos',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  // React + Zod + React Hook Form ocupan ~160 kB gzip; el formulario ya se carga aparte.
  build: { chunkSizeWarningLimit: 600 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
})
