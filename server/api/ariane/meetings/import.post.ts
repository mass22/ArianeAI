// server/api/ariane/meetings/import.post.ts
import { createError, defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const start = Date.now()

  try {
    const body = await readBody<{
      content?: string
      transcript?: string
      scribeResult?: Record<string, any>
      meta?: Record<string, any>
    }>(event)

    if (!body?.content) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'Missing "content" in request body'
      })
    }

    const config = useRuntimeConfig()

    const coreUrl =
      config.public?.arianeCoreUrl ||
      config.arianeCoreUrl ||
      'http://127.0.0.1:4000'

    console.log('[Nuxt/api/ariane/meetings/import] →', coreUrl + '/meetings/import')
    console.log('[Nuxt/api/ariane/meetings/import] Content length:', body.content?.length || 0)
    console.log('[Nuxt/api/ariane/meetings/import] Transcript length:', body.transcript?.length || 0)

    // Proxy vers Ariane Core
    const result = await $fetch(coreUrl + '/meetings/import', {
      method: 'POST',
      body: {
        content: body.content,
        transcript: body.transcript, // ⚠️ IMPORTANT : la transcription brute
        scribeResult: body.scribeResult, // Optionnel mais recommandé
        meta: body.meta || { source: 'meeting', label: 'import depuis Nuxt' }
      }
    })

    const durationMs = Date.now() - start
    console.log(
      '[Nuxt/api/ariane/meetings/import] OK',
      `(${durationMs} ms)`
    )

    return result
  } catch (err: any) {
    const durationMs = Date.now() - start
    console.error('[Nuxt/api/ariane/meetings/import] ERROR', {
      durationMs,
      message: err?.message || String(err),
      stack: err?.stack
    })

    // On renvoie une erreur bien claire au front
    throw createError({
      statusCode: err?.statusCode || 500,
      statusMessage: 'Meetings import proxy failed',
      message: err?.message || String(err)
    })
  }
})

