// server/api/llm/chat.post.ts
import crypto from 'node:crypto'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig()
  
  const arianeCoreUrl = config.arianeCoreUrl || process.env.ARIANE_CORE_URL || 'http://127.0.0.1:4000'
  
  // Génération d'un trace_id côté client si fourni, sinon généré côté serveur
  const traceId = body.trace_id || getHeader(event, 'x-trace-id') || crypto.randomUUID()
  
  try {
    const response = await $fetch(`${arianeCoreUrl}/llm/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-trace-id': traceId
      },
      body: {
        model: body.model,
        system: body.system,
        messages: body.messages,
        temperature: body.temperature,
        maxTokens: body.maxTokens
      },
      timeout: 600_000, // 10 minutes timeout
    })
    
    // ✅ Return exactly what Ariane Core returns (no double-wrapping)
    return response
  } catch (error: any) {
    // Try to preserve Core error payload and trace id
    const data = error?.data ?? error?.message ?? String(error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'LLM request failed',
      data: {
        trace_id: traceId,
        error: data,
      },
    })
  }
})
