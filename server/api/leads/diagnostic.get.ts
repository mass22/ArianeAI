// Proxy GET /api/leads/diagnostic → ARIANE_API_BASE_URL/api/leads/diagnostic
// Retourne storage_path et leads_count pour vérifier l'intégration ingest ↔ leads
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const baseUrl =
    config.arianeApiBaseUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  const url = `${baseUrl}/api/leads/diagnostic`

  try {
    const data = await $fetch(url)
    return data
  } catch (err: any) {
    const message = err?.message || 'Erreur lors du diagnostic leads'
    throw createError({ statusCode: err?.statusCode || 500, message })
  }
})
