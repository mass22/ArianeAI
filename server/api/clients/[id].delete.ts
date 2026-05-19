// server/api/clients/[id].delete.ts
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const query = getQuery(event)
  const confirm = query.confirm === 'true' || query.confirm === true

  if (!id) {
    throw createError({ statusCode: 400, message: 'ID client requis' })
  }

  if (!confirm) {
    throw createError({
      statusCode: 400,
      message: 'La suppression requiert une confirmation (paramètre confirm=true)',
    })
  }

  const config = useRuntimeConfig()
  const baseUrl = config.public?.arianeCoreUrl || config.arianeCoreUrl || 'http://127.0.0.1:4000'

  try {
    const response = await $fetch<{ ok: boolean }>(`${baseUrl}/crm/clients/${id}`, {
      method: 'DELETE',
      query: { confirm: 'true' },
    })
    return response
  } catch (err: any) {
    const statusCode = err?.statusCode ?? err?.status ?? 500
    const message = err?.data?.message ?? err?.data?.error ?? err.message ?? 'Erreur lors de la suppression'
    throw createError({
      statusCode,
      message: String(message),
      data: err?.data,
    })
  }
})
