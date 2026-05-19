// Proxy POST /api/leads/ingest/linkedin-urls → ARIANE_API_BASE_URL
// Accepts JSON body: { urls: string[] }
import { createError, readBody } from 'h3'
import type { IngestionResult } from '../../../../app/types/ariane'

export default defineEventHandler(async (event): Promise<IngestionResult> => {
  const config = useRuntimeConfig()
  const baseUrl =
    config.arianeApiBaseUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'
  const url = `${baseUrl}/api/leads/ingest/linkedin-urls`

  const body = await readBody<{ urls?: string[] }>(event)
  const urls = body?.urls
  if (!Array.isArray(urls) || urls.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Missing or empty urls array in request body',
    })
  }

  const filtered = urls
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter(Boolean)
  if (filtered.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No valid URLs provided',
    })
  }

  try {
    const result = await $fetch<IngestionResult>(url, {
      method: 'POST',
      body: { urls: filtered },
    })
    return result
  } catch (err: any) {
    const msg = err?.data?.message || err?.message || 'Erreur lors de l\'import URLs'
    throw createError({
      statusCode: err?.statusCode || 500,
      message: msg,
    })
  }
})
