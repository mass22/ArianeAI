// server/api/ariane/workflows/meeting/import.post.ts
// Proxy vers Ariane-Core POST /workflows/meeting/import

import { createError, defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const start = Date.now()

  try {
    const body = await readBody<{
      audio_base64?: string
      format?: string
      language?: string
      meta?: Record<string, unknown>
    }>(event)

    if (!body?.audio_base64) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'Missing "audio_base64" in request body'
      })
    }

    const config = useRuntimeConfig()
    const coreUrl =
      config.public?.arianeCoreUrl ||
      config.arianeCoreUrl ||
      'http://127.0.0.1:4000'

    const workflowUrl = `${coreUrl}/workflows/meeting/import`
    console.log('[Nuxt/api/ariane/workflows/meeting/import] →', workflowUrl)
    console.log('[Nuxt/api/ariane/workflows/meeting/import] Audio size:', body.audio_base64?.length ?? 0, 'chars')

    const result = await $fetch(workflowUrl, {
      method: 'POST',
      body: {
        audio_base64: body.audio_base64,
        format: body.format || 'webm',
        language: body.language || 'fr',
        meta: body.meta || { source: 'meeting', label: 'capture depuis Nuxt' }
      },
      timeout: 600_000, // 10 min pour workflow complet
    })

    const durationMs = Date.now() - start
    const res = result as { workflow_id?: string; status?: string }
    console.log(
      '[Nuxt/api/ariane/workflows/meeting/import] OK',
      `(${durationMs} ms, workflow_id=${res.workflow_id ?? '?'}, status=${res.status ?? '?'})`
    )

    return result
  } catch (err: unknown) {
    const durationMs = Date.now() - start
    const e = err as { statusCode?: number; statusMessage?: string; message?: string; stack?: string }
    console.error('[Nuxt/api/ariane/workflows/meeting/import] ERROR', {
      durationMs,
      message: e?.message || String(err),
      stack: e?.stack
    })

    throw createError({
      statusCode: e?.statusCode || 500,
      statusMessage: 'Meeting workflow proxy failed',
      message: e?.message || String(err)
    })
  }
})
