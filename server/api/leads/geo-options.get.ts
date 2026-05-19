// Proxy GET /api/leads/geo-options → Ariane Core
// Fallback hardcodé si l'API n'est pas accessible
import { createError } from 'h3'

const FALLBACK_OPTIONS = [
  { value: 0, label: 'Unknown' },
  { value: 1, label: 'Canada' },
  { value: 2, label: 'USA' },
  { value: 3, label: 'EU' },
  { value: 4, label: 'Other' },
]

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const baseUrl =
    config.arianeApiBaseUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  const url = `${baseUrl}/api/leads/geo-options`
  try {
    const data = await $fetch<{ ok?: boolean; options?: Array<{ value: number; label: string }> }>(url)
    const options = data?.options ?? data
    const arr = Array.isArray(options) ? options : FALLBACK_OPTIONS
    return { ok: true, options: arr.length ? arr : FALLBACK_OPTIONS }
  } catch {
    return { ok: true, options: FALLBACK_OPTIONS }
  }
})
