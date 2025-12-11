// server/api/ariane/transcribe.post.ts
import { createError, defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const start = Date.now()

  try {
    const body = await readBody<{
      audio_base64?: string
      format?: string
      language?: string
      meta?: Record<string, any>
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

    console.log('[Nuxt/api/ariane/transcribe] →', coreUrl + '/transcribe')

    // Proxy vers Ariane Core (Dell)
    const result = await $fetch<{
      transcript: string
      duration_seconds: number | null
      meta: any
    }>(coreUrl + '/transcribe', {
      method: 'POST',
      body: {
        audio_base64: body.audio_base64,
        format: body.format || 'webm',
        language: body.language || 'fr',
        meta: body.meta || { source: 'meeting', label: 'capture depuis Nuxt' }
      }
    })

    const durationMs = Date.now() - start
    console.log(
      '[Nuxt/api/ariane/transcribe] OK',
      `(${durationMs} ms, transcript length=${result.transcript?.length || 0})`
    )

    return result
  } catch (err: any) {
    const durationMs = Date.now() - start
    console.error('[Nuxt/api/ariane/transcribe] ERROR', {
      durationMs,
      message: err?.message || String(err),
      stack: err?.stack
    })

    // On renvoie une erreur bien claire au front
    throw createError({
      statusCode: err?.statusCode || 500,
      statusMessage: 'Transcription proxy failed',
      message: err?.message || String(err)
    })
  }
})
