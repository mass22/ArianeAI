// Proxy PATCH /api/leads/:lead_key
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const baseUrl =
    config.arianeApiBaseUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  const leadKey = getRouterParam(event, 'lead_key')
  if (!leadKey) {
    throw createError({ statusCode: 400, message: 'lead_key manquant' })
  }

  const body = await readBody(event)
  const url = `${baseUrl}/api/leads/${encodeURIComponent(leadKey)}`

  try {
    const data = await $fetch(url, {
      method: 'PATCH',
      body,
    })
    return data
  } catch (err: any) {
    const message = err?.message || 'Erreur lors de la mise à jour du lead'
    throw createError({ statusCode: err?.statusCode || 500, message })
  }
})
