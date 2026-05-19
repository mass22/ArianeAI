/**
 * Structured console logging for API calls (development only)
 */

export function logApiRequest(method: string, endpoint: string) {
  if (import.meta.dev) {
    console.debug('[API]', method, endpoint, { timestamp: new Date().toISOString() })
  }
}

export function logApiResponse(endpoint: string, status: number, durationMs: number) {
  if (import.meta.dev) {
    console.debug('[API] response', { endpoint, status, duration_ms: durationMs })
  }
}

export function logApiError(endpoint: string, status: number | undefined, message: string) {
  if (import.meta.dev) {
    console.error('[API ERROR]', { endpoint, status, message })
  }
}
