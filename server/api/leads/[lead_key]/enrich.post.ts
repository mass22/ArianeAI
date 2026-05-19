// Proxy POST /api/leads/:lead_key/enrich → Ariane Core
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const leadKey = getRouterParam(event, 'lead_key')
  if (!leadKey) {
    throw createError({ statusCode: 400, message: 'lead_key requis' })
  }

  const config = useRuntimeConfig()
  const arianeCoreUrl = (
    config.arianeApiBaseUrl ||
    config.arianeCoreUrl ||
    process.env.ARIANE_CORE_URL ||
    'http://127.0.0.1:4000'
  ).replace(/\/$/, '')

  const url = `${arianeCoreUrl}/api/leads/${encodeURIComponent(leadKey)}/enrich`

  try {
    const response = await $fetch(url, {
      method: 'POST',
      timeout: 120_000, // 2 min (génération LLM longue)
    })
    return response
  } catch (error: any) {
    const statusCode = error?.statusCode ?? error?.response?.status ?? 500
    const backendBody = error?.data ?? {}
    let message = backendBody?.error ?? error?.message ?? 'Erreur lors de l\'enrichissement du lead'

    if (statusCode === 404) {
      message = 'Lead introuvable ou endpoint enrich absent sur le backend Ariane. Vérifiez que POST /api/leads/:lead_key/enrich est implémenté.'
    } else if (statusCode === 503) {
      message = 'Timeout du LLM. Augmentez OLLAMA_TIMEOUT_MS ou utilisez un modèle plus léger.'
    }

    throw createError({
      statusCode,
      statusMessage: message,
      message,
      data: {
        ...backendBody,
        code: backendBody?.code ?? 'LEADS_ENRICH_ERROR',
      },
    })
  }
})
