// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  modules: ['nuxt-mcp-dev', '@nuxt/ui', '@vueuse/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    arianeCoreUrl: process.env.ARIANE_CORE_URL || 'http://192.168.2.110:4000',
  },
   routeRules: {
    '/meeting': { ssr: false },
    '/dashboard/core': { ssr: false },
  },
})

