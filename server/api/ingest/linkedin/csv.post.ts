// Proxy POST /api/ingest/linkedin/csv → ARIANE_API_BASE_URL
// Accepts multipart/form-data (field: file), forwards as JSON { csv: string }
// Spec: Option B — Content-Type: application/json, body: { "csv": "<contenu>" }
import { createError, readMultipartFormData } from 'h3'
import type { IngestionResult } from '../../../../app/types/ariane'

export default defineEventHandler(async (event): Promise<IngestionResult> => {
  const config = useRuntimeConfig()
  const baseUrl =
    config.arianeApiBaseUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'
  const url = `${baseUrl}/api/ingest/linkedin/csv`

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find((p) => p.name === 'file')
  if (!filePart?.data) {
    throw createError({
      statusCode: 400,
      message: 'Missing file in multipart form (field name: file)',
    })
  }

  const csvContent = Buffer.from(filePart.data).toString('utf-8')
  if (!csvContent?.trim()) {
    throw createError({
      statusCode: 400,
      message: 'Fichier CSV vide',
    })
  }

  try {
    const result = await $fetch<IngestionResult>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { csv: csvContent },
    })
    return result
  } catch (err: any) {
    const d = err?.data
    const msg =
      (typeof d === 'object' && (d?.message || d?.error || d?.detail)) ||
      (typeof d === 'string' && d) ||
      err?.message ||
      'Erreur lors de l\'import CSV'
    throw createError({
      statusCode: err?.statusCode ?? err?.status ?? 500,
      message: String(msg),
    })
  }
})
