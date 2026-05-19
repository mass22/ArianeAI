// Types pour l'API ingestion leads Ariane

export interface IngestionErrorSample {
  row?: number
  message: string
  value?: string
}

export interface IngestionResult {
  status?: 'ok' | 'partial' | 'error'
  created: number
  merged: number
  skipped: number
  errors: number
  duration_ms: number
  error_samples?: IngestionErrorSample[]
  created_lead_keys?: string[]
  merged_lead_keys?: string[]
}
