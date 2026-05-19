// https://nuxt.com/docs/api/configuration/nuxt-config
import { createHash } from 'crypto'

// Polyfill pour crypto.hash() qui n'existe pas dans Node.js
// Vite 7+ essaie d'utiliser crypto.hash() mais Node.js utilise crypto.createHash()
// On patche l'objet crypto existant (globalThis.crypto est en lecture seule)
const cryptoObj = globalThis.crypto
if (cryptoObj && !cryptoObj.hash) {
  Object.defineProperty(cryptoObj, 'hash', {
    value: (algorithm: string) => createHash(algorithm),
    writable: true,
    configurable: true,
  })
}

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  modules: ['nuxt-mcp-dev', '@nuxt/ui', '@vueuse/nuxt', 'shadcn-nuxt'],
  css: ['~/assets/css/main.css'],
  shadcn: {
    componentDir: [
      '@/components/ui',
      { path: '@/components/ai-elements', prefix: '' },
    ],
  },
  runtimeConfig: {
    // Variable d'environnement pour le backend (côté serveur uniquement)
    arianeCoreUrl: process.env.NUXT_PUBLIC_ARIANE_CORE_URL || process.env.ARIANE_CORE_URL || 'http://127.0.0.1:4000',
    // API Ariane pour leads/daily (peut pointer vers le même serveur ou un autre)
    arianeApiBaseUrl: process.env.ARIANE_API_BASE_URL || process.env.NUXT_PUBLIC_ARIANE_CORE_URL || process.env.ARIANE_CORE_URL || 'http://127.0.0.1:4000',
    public: {
      // Exposer aussi côté client si nécessaire
      arianeCoreUrl: process.env.NUXT_PUBLIC_ARIANE_CORE_URL || 'http://127.0.0.1:4000',
    },
  },
   routeRules: {
    '/': { ssr: false },
    '/meeting': { ssr: false },
    '/observability/core': { ssr: false },
    '/clients/**': { ssr: false },
    '/leads/**': { ssr: false },
    '/daily': { ssr: false },
  },
})

