// server/api/ariane/logs.get.ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const baseUrl =
    config?.arianeCoreUrl || 'http://192.168.2.110:4000'

  const query = getQuery(event)
  const limit = query.limit ?? 30

  try {
    const res: any = await $fetch(`${baseUrl}/logs/recent`, {
      query: { limit },
    })

    return {
      items: res?.events ?? [],
    }
  } catch (err: any) {
    console.error('[api/ariane/logs] error:', err)
    return {
      error: true,
      message: 'Impossible de récupérer les logs',
      items: [],
      details: err?.message || String(err),
    }
  }
})
