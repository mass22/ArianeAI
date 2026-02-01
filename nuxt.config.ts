// https://nuxt.com/docs/api/configuration/nuxt-config
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
    public: {
      // Exposer aussi côté client si nécessaire
      arianeCoreUrl: process.env.NUXT_PUBLIC_ARIANE_CORE_URL || 'http://127.0.0.1:4000',
    },
  },
   routeRules: {
    '/': { ssr: false },
    '/meeting': { ssr: false },
    '/dashboard/core': { ssr: false },
    '/clients/**': { ssr: false },
  },
})

