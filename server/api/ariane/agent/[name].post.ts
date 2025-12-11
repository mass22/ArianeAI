// server/api/ariane/agent/[name].post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig()
  const coreUrl = config.arianeCoreUrl

  const name = getRouterParam(event, 'name')

  const res = await $fetch(`${coreUrl}/agent/${name}`, {
    method: 'POST',
    body
  }).catch((err: any) => {
    throw createError({
      statusCode: err?.statusCode || 500,
      statusMessage: err?.statusMessage || 'Ariane Core agent error',
      data: err?.data || err?.message || String(err)
    })
  })

  return res
})
