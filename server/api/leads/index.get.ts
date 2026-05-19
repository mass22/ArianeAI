// Proxy GET /api/leads → ARIANE_API_BASE_URL/api/leads
// Contourne la limite 100 de l'API : fait des requêtes chunkées (limit=100, offset=0,100,200...)
// et fusionne les résultats. Si l'API ne respecte pas offset, on s'arrête après le 1er chunk.
import { createError } from 'h3'

const CHUNK_SIZE = 100

function toItems(data: unknown): unknown[] {
  if (!data || typeof data !== 'object') return []
  const d = data as Record<string, unknown>
  const arr = d.leads ?? d.items ?? d.data
  return Array.isArray(arr) ? arr : []
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const baseUrl =
    config.arianeApiBaseUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  const query = getQuery(event) as Record<string, string | number | undefined>
  const requestedLimit = Math.min(
    Math.max(1, Number(query.limit) || CHUNK_SIZE),
    10000,
  )

  const baseParams = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (k === 'limit' || k === 'offset') continue
    if (v != null && v !== '') baseParams.set(k, String(v))
  }

  const allItems: unknown[] = []
  let offset = 0

  try {
    while (allItems.length < requestedLimit) {
      const params = new URLSearchParams(baseParams)
      params.set('limit', String(CHUNK_SIZE))
      params.set('offset', String(offset))
      params.set('skip', String(offset))
      params.set('page', String(Math.floor(offset / CHUNK_SIZE) + 1))
      const url = `${baseUrl}/api/leads?${params.toString()}`
      const data = await $fetch<unknown>(url)
      const items = toItems(data)
      if (items.length === 0) break

      // Détection : si l'API ne respecte pas offset, on reçoit les mêmes items
      const firstKey = items[0] && typeof items[0] === 'object' && items[0] !== null
        ? (items[0] as Record<string, unknown>).lead_key
        : null
      const isDuplicate = offset > 0 && firstKey && allItems.some(
        (x) => x && typeof x === 'object' && (x as Record<string, unknown>).lead_key === firstKey,
      )
      if (isDuplicate) break

      allItems.push(...items)
      if (items.length < CHUNK_SIZE) break
      offset += CHUNK_SIZE
    }

    const leads = allItems.slice(0, requestedLimit)
    const d = { leads, total: allItems.length }
    return d
  } catch (err: any) {
    const message = err?.message || 'Erreur lors de la récupération des leads'
    throw createError({ statusCode: err?.statusCode || 500, message })
  }
})
