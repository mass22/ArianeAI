// server/api/ariane/logs.get.ts

// Cache pour limiter les logs d'erreur répétés
let lastErrorLogTime = 0
const ERROR_LOG_INTERVAL = 60000 // Logger l'erreur max 1 fois par minute

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const baseUrl =
    config.public?.arianeCoreUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  const query = getQuery(event)
  const limit = query.limit ?? 30

  try {
    const res: any = await $fetch(`${baseUrl}/logs/recent`, {
      query: { limit },
    })

    // Réinitialiser le cache d'erreur en cas de succès
    lastErrorLogTime = 0

    return {
      items: res?.events ?? [],
    }
  } catch (err: any) {
    const now = Date.now()
    const isConnectionError = err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED') || err?.cause?.code === 'ENOTFOUND'

    // Logger l'erreur seulement si :
    // - Ce n'est pas une erreur de connexion connue, OU
    // - On n'a pas loggé d'erreur depuis ERROR_LOG_INTERVAL ms
    if (!isConnectionError || (now - lastErrorLogTime) > ERROR_LOG_INTERVAL) {
      if (isConnectionError) {
        console.warn(`[api/ariane/logs] Serveur Ariane Core inaccessible sur ${baseUrl}. Vérifiez que le serveur est démarré.`)
      } else {
        console.error('[api/ariane/logs] error:', err)
      }
      lastErrorLogTime = now
    }

    return {
      error: true,
      message: 'Impossible de récupérer les logs',
      items: [],
      details: err?.message || String(err),
    }
  }
})
