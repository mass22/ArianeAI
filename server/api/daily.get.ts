// Proxy GET /api/daily?date=YYYY-MM-DD
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const baseUrl =
    config.arianeApiBaseUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  const query = getQuery(event)
  const date = query.date as string | undefined
  const qs = date ? `?date=${encodeURIComponent(date)}` : ''
  const url = `${baseUrl}/api/daily${qs}`

  try {
    const data = await $fetch(url)
    return data
  } catch (err: any) {
    const message = err?.message || 'Erreur lors de la récupération du brief quotidien'
    throw createError({ statusCode: err?.statusCode || 500, message })
  }
})
