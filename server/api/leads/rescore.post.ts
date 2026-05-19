// Proxy POST /api/leads/rescore → Ariane Core
// Déclenche le recalcul des priority_score de tous les leads
import { createError } from 'h3'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const baseUrl =
    config.arianeApiBaseUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  const url = `${baseUrl}/api/leads/rescore`
  try {
    const data = await $fetch<unknown>(url, {
      method: 'POST',
      timeout: 60_000, // jusqu'à 1 min pour recalcul batch
    })
    return data ?? { ok: true }
  } catch (err: any) {
    const statusCode = err?.statusCode ?? err?.status ?? 500
    const message =
      statusCode === 404
        ? "Le backend Ariane Core n'expose pas POST /api/leads/rescore. Ajoutez cet endpoint pour recalculer les scores."
        : err?.message || 'Erreur lors du recalcul du scoring'
    throw createError({ statusCode, message })
  }
})
