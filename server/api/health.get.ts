// Health check: proxies to Ariane API /health (fallback: /)
// Returns { status, latency_ms } for API availability badge
export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const baseUrl =
    config.arianeApiBaseUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  const start = Date.now()
  for (const path of ['/health', '/']) {
    try {
      const data = await $fetch<{ status?: string }>(`${baseUrl}${path}`)
      const latency_ms = Date.now() - start
      const backendStatus = (path === '/health' && data?.status) ? data.status : 'ok'
      return { status: backendStatus, latency_ms }
    } catch {
      continue
    }
  }
  const latency_ms = Date.now() - start
  return { status: 'error', latency_ms }
})
