// server/api/ariane/metrics.get.ts

// Cache pour limiter les logs d'erreur répétés
let lastErrorLogTime = 0
const ERROR_LOG_INTERVAL = 60000 // Logger l'erreur max 1 fois par minute

// Fallback uptime : timestamp de la première réponse réussie d'Ariane (durée de vie apparente)
let arianeFirstSeenAt = 0

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const baseUrl =
    config.public?.arianeCoreUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  try {
    const raw = await $fetch<any>(`${baseUrl}/metrics`)
    lastErrorLogTime = 0

    let uptimeSeconds =
      raw?.uptime_seconds ??
      raw?.uptime ??
      raw?.process?.uptime ??
      raw?.data?.uptime ??
      (typeof raw?.uptime_ms === 'number' ? Math.floor(raw.uptime_ms / 1000) : undefined)

    // Fallback : si /metrics n'a pas d'uptime, essayer /health
    if (uptimeSeconds == null || uptimeSeconds <= 0) {
      try {
        const health = await $fetch<any>(`${baseUrl}/health`)
        uptimeSeconds =
          health?.uptime_seconds ??
          health?.uptime ??
          health?.process?.uptime ??
          (typeof health?.uptime_ms === 'number' ? Math.floor(health.uptime_ms / 1000) : undefined)
      } catch {
        // ignorer
      }
    }

    // Dernier recours : uptime depuis la première réponse réussie (proxy Nuxt → Ariane)
    if (uptimeSeconds == null || uptimeSeconds <= 0) {
      if (arianeFirstSeenAt === 0) arianeFirstSeenAt = Date.now()
      uptimeSeconds = Math.floor((Date.now() - arianeFirstSeenAt) / 1000)
    }

    const agentsRaw =
      raw?.agents ??
      raw?.endpoints ??
      raw?.routes ??
      raw?.services ??
      {}
    const agents =
      typeof agentsRaw === 'object' && agentsRaw !== null ? agentsRaw : {}

    return {
      ...raw,
      uptime_seconds: uptimeSeconds,
      agents,
    }
  } catch (err: any) {
    const now = Date.now()
    const isConnectionError = err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED') || err?.cause?.code === 'ENOTFOUND'

    // Logger l'erreur seulement si :
    // - Ce n'est pas une erreur de connexion connue, OU
    // - On n'a pas loggé d'erreur depuis ERROR_LOG_INTERVAL ms
    if (!isConnectionError || (now - lastErrorLogTime) > ERROR_LOG_INTERVAL) {
      if (isConnectionError) {
        console.warn(`[api/ariane/metrics] Serveur Ariane Core inaccessible sur ${baseUrl}. Vérifiez que le serveur est démarré.`)
      } else {
        console.error('[api/ariane/metrics] error:', err)
      }
      lastErrorLogTime = now
    }

    // On renvoie quelque chose de lisible côté client
    return {
      error: true,
      message: 'Impossible de joindre Ariane Core',
      details: err?.message || String(err),
    }
  }
})
