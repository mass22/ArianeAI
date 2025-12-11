// server/api/ariane/metrics.get.ts
export default defineEventHandler(async (event) => {
  // 1) On essaie de lire la config Nuxt
  const config = useRuntimeConfig()
  // 2) Fallback sur l’IP connue de ton Dell si pas défini
  const baseUrl =
    config?.arianeCoreUrl || 'http://192.168.2.110:4000'

  try {
    const snapshot = await $fetch(`${baseUrl}/metrics`)
    return snapshot
  } catch (err: any) {
    console.error('[api/ariane/metrics] error:', err)
    // On renvoie quelque chose de lisible côté client
    return {
      error: true,
      message: 'Impossible de joindre Ariane Core',
      details: err?.message || String(err),
    }
  }
})
