// server/api/clients/[id]/reactivate.post.ts
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID client requis' })
  }

  const config = useRuntimeConfig()
  const baseUrl = config.public?.arianeCoreUrl || config.arianeCoreUrl || 'http://127.0.0.1:4000'

  try {
    const response = await $fetch<{ ok: boolean; data?: any }>(`${baseUrl}/crm/clients/${id}/reactivate`, {
      method: 'POST',
    })
    if (!response.ok) {
      throw createError({ statusCode: 500, message: 'Erreur lors de la réactivation' })
    }
    return response
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      message: err?.data?.message ?? err.message ?? 'Erreur lors de la réactivation',
    })
  }
})
