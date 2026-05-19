// Proxy GET /api/memory/search → Ariane-Core GET /memory/search
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const baseUrl =
    config.arianeApiBaseUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  const query = getQuery(event)
  const qParam = query.query || query.q
  if (!qParam || typeof qParam !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Paramètre de recherche requis (query ou q)',
    })
  }

  const params: Record<string, string> = { query: qParam }
  if (query.clientId && typeof query.clientId === 'string') {
    params.clientId = query.clientId
  }

  const qs = new URLSearchParams(params).toString()
  const url = `${baseUrl}/memory/search?${qs}`

  try {
    const data = await $fetch(url)
    return data
  } catch (err: any) {
    const message = err?.message || 'Erreur lors de la recherche mémoire'
    throw createError({ statusCode: err?.statusCode || 500, message })
  }
})
