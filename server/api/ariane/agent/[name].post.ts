// server/api/ariane/agent/[name].post.ts
import crypto from 'node:crypto'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig()
  const coreUrl = config.arianeCoreUrl
  const name = getRouterParam(event, 'name')

  const traceId = getHeader(event, 'x-trace-id') || crypto.randomUUID()

  try {
    // ✅ Pass-through to Ariane Core agent endpoint
    // We propagate x-trace-id for log correlation.
    const res = await $fetch(`${coreUrl}/agent/${name}`, {
      method: 'POST',
      body,
      headers: { 'x-trace-id': traceId },
      timeout: 600_000, // 10 minutes timeout
    })

    // ✅ Return exactly what Ariane Core returns (no double-wrapping)
    return res
  } catch (err: any) {
    // Try to preserve Core error payload and trace id
    const data = err?.data ?? err?.message ?? String(err)
    throw createError({
      statusCode: err?.statusCode || 500,
      statusMessage: err?.statusMessage || 'Ariane Core agent error',
      data: {
        trace_id: traceId,
        error: data,
      },
    })
  }
})
