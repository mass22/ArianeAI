// Proxy POST /api/leads/ingest/linkedin-csv → ARIANE_API_BASE_URL
// Accepts multipart/form-data with file field
import { createError, readMultipartFormData } from 'h3'
import type { IngestionResult } from '../../../../app/types/ariane'

export default defineEventHandler(async (event): Promise<IngestionResult> => {
  const config = useRuntimeConfig()
  const baseUrl =
    config.arianeApiBaseUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'
  const url = `${baseUrl}/api/leads/ingest/linkedin-csv`

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find((p) => p.name === 'file')
  if (!filePart?.data) {
    throw createError({
      statusCode: 400,
      message: 'Missing file in multipart form (field name: file)',
    })
  }

  const formData = new FormData()
  formData.append(
    'file',
    new Blob([filePart.data], { type: filePart.type || 'text/csv' }),
    filePart.filename || 'connections.csv',
  )

  try {
    const result = await $fetch<IngestionResult>(url, {
      method: 'POST',
      body: formData,
    })
    return result
  } catch (err: any) {
    const msg = err?.data?.message || err?.message || 'Erreur lors de l\'import CSV'
    throw createError({
      statusCode: err?.statusCode || 500,
      message: msg,
    })
  }
})
