/**
 * Utilitaires pour l'ingestion de leads (normalisation URLs, messages d'erreur)
 */

/** Parse URLs from text (splits by newlines, commas, semicolons; trims; filters empty) */
export function parseUrlsFromText(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter(Boolean)
}

/** Normalize raw string or string[] into validated LinkedIn profile URLs */
export function normalizeLinkedinUrls(raw: string | string[]): string[] {
  const lines = Array.isArray(raw)
    ? raw
    : raw.split(/[\n,;]+/)
  const urls = lines
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter(Boolean)
  return urls.filter((u) => u.includes('linkedin.com/in/'))
}

/** Extract user-friendly error message from fetch/API errors */
export function normalizeIngestionError(err: unknown): string {
  if (!err) return 'Erreur inconnue'
  const anyErr = err as Record<string, unknown>
  const msg = (anyErr?.data as Record<string, unknown>)?.message ?? anyErr?.message ?? String(err)
  const code = anyErr?.statusCode ?? anyErr?.status
  if (code === 408 || String(msg).toLowerCase().includes('timeout')) {
    return 'Délai d\'attente dépassé. Réessayez.'
  }
  if (
    String(msg).toLowerCase().includes('fetch') ||
    String(msg).toLowerCase().includes('network') ||
    String(msg).toLowerCase().includes('failed to fetch') ||
    code === 0
  ) {
    return 'Serveur inaccessible. Vérifiez votre connexion.'
  }
  const msgStr = String(msg ?? '')
  if (msgStr && msgStr !== '[object Object]') return msgStr
  return 'Erreur lors de l\'import'
}
