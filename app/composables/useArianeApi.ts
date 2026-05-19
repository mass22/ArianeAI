import type {
  Lead,
  LeadDetail,
  LeadsResponse,
  DailyBrief,
  LeadPatchPayload,
} from '~/types/leads'
import type { IngestionResult } from '~/types/ariane'
import type {
  MeetingWorkflowResult,
  MeetingWorkflowImportPayload,
} from '~/types/meeting'
import { logApiRequest, logApiResponse, logApiError } from '~/lib/apiLogger'
import { normalizeLinkedinUrls, normalizeIngestionError } from '~/lib/ingestionUtils'

export interface LeadsQuery {
  type?: string
  status?: string
  pipeline_stage?: string
  minScore?: number
  sort?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
  /** Filtre par date de prochain suivi (YYYY-MM-DD) — transmis au backend si supporté */
  next_followup_at?: string
  /** Recherche par nom (contact, entreprise) — filtre côté client uniquement */
  search?: string
}

import { todayMontreal, addDays } from '~/lib/dateUtils'

// Shared state for API status (used by ApiStatusBadge + latency indicator)
const apiLatencyMs = useState<number | null>('api-latency-ms', () => null)
const apiUp = useState<boolean>('api-up', () => true)

/** Timestamp mis à jour après rescore → déclenche le rafraîchissement des vues Daily Brief */
const leadsInvalidatedAt = useState<number>('leads-invalidated-at', () => 0)

export function useArianeApi() {
  const toast = useToast()

  async function apiCall<T>(
    method: string,
    endpoint: string,
    options: Parameters<typeof $fetch>[1] = {},
  ): Promise<T> {
    logApiRequest(method, endpoint)
    const start = Date.now()
    try {
      const data = await $fetch<T>(endpoint, options)
      const duration = Date.now() - start
      logApiResponse(endpoint, 200, duration)
      apiLatencyMs.value = duration
      apiUp.value = true
      return data
    } catch (err: any) {
      const duration = Date.now() - start
      logApiError(endpoint, err?.statusCode ?? err?.status, err?.message ?? String(err))
      apiUp.value = false
      throw err
    }
  }

  async function fetchLeads(query?: LeadsQuery) {
    try {
      const params: Record<string, string | number> = {}
      if (query?.type) params.type = query.type
      if (query?.status) params.status = query.status
      if (query?.pipeline_stage) params.pipeline_stage = query.pipeline_stage
      if (query?.minScore != null) params.minScore = query.minScore
      if (query?.limit != null) params.limit = query.limit
      if (query?.offset != null) params.offset = query.offset
      if (query?.next_followup_at) params.next_followup_at = query.next_followup_at
      params.sort = query?.sort ?? 'priority_score'
      params.order = query?.order ?? 'desc'

      const data = await apiCall<LeadsResponse>('GET', '/api/leads', { query: params })
      return { data, error: null }
    } catch (err: any) {
      const msg = err?.message || 'Erreur lors de la récupération des leads'
      toast.add({ title: 'Erreur', description: msg, color: 'error' })
      return { data: null, error: msg }
    }
  }

  async function fetchGeoOptions() {
    try {
      const data = await apiCall<{ ok?: boolean; options?: Array<{ value: number; label: string }> }>(
        'GET',
        '/api/leads/geo-options',
      )
      const options = data?.options ?? []
      return { data: Array.isArray(options) ? options : [], error: null }
    } catch {
      return { data: [], error: null }
    }
  }

  async function rescoreLeads() {
    try {
      await apiCall<{ ok?: boolean }>('POST', '/api/leads/rescore', {
        method: 'POST',
        timeout: 60_000,
      })
      leadsInvalidatedAt.value = Date.now()
      toast.add({ title: 'Succès', description: 'Scoring recalculé', color: 'success' })
      return { error: null }
    } catch (err: any) {
      const msg = err?.data?.message ?? err?.message ?? 'Erreur lors du recalcul du scoring'
      toast.add({ title: 'Erreur', description: msg, color: 'error' })
      return { error: msg }
    }
  }

  async function fetchLeadsDiagnostic() {
    try {
      const data = await apiCall<{ storage_path?: string; leads_count?: number }>(
        'GET',
        '/api/leads/diagnostic',
      )
      return { data, error: null }
    } catch (err: any) {
      const msg = err?.message || 'Erreur lors du diagnostic'
      return { data: null, error: msg }
    }
  }

  async function fetchLead(leadKey: string) {
    try {
      const endpoint = `/api/leads/${encodeURIComponent(leadKey)}`
      const data = await apiCall<LeadDetail>('GET', endpoint)
      return { data, error: null }
    } catch (err: any) {
      const msg = err?.message || 'Erreur lors de la récupération du lead'
      toast.add({ title: 'Erreur', description: msg, color: 'error' })
      return { data: null, error: msg }
    }
  }

  async function patchLead(leadKey: string, payload: LeadPatchPayload) {
    try {
      const endpoint = `/api/leads/${encodeURIComponent(leadKey)}`
      const data = await apiCall<Lead>('PATCH', endpoint, {
        method: 'PATCH',
        body: payload,
      })
      toast.add({ title: 'Succès', description: 'Lead mis à jour', color: 'success' })
      return { data, error: null }
    } catch (err: any) {
      const msg = err?.message || 'Erreur lors de la mise à jour'
      toast.add({ title: 'Erreur', description: msg, color: 'error' })
      return { data: null, error: msg }
    }
  }

  async function markAsMessaged(leadKey: string) {
    const today = todayMontreal()
    const j4 = addDays(today, 4)
    return patchLead(leadKey, {
      pipeline_stage: 'messaged',
      last_touch_at: today,
      next_followup_at: j4,
    })
  }

  /** Marquer la relance J+4 comme envoyée → prochain suivi à J+10 */
  async function markJ4Sent(leadKey: string) {
    const today = todayMontreal()
    const j10 = addDays(today, 6)
    return patchLead(leadKey, {
      last_touch_at: today,
      next_followup_at: j10,
    })
  }

  /** Marquer la relance J+10 comme envoyée → plus de relance planifiée */
  async function markJ10Sent(leadKey: string) {
    const today = todayMontreal()
    return patchLead(leadKey, {
      last_touch_at: today,
      next_followup_at: null,
    })
  }

  /** Planifier la relance J+4 → prochain suivi dans 4 jours */
  async function scheduleJ4(leadKey: string) {
    const today = todayMontreal()
    const j4 = addDays(today, 4)
    return patchLead(leadKey, {
      last_touch_at: today,
      next_followup_at: j4,
    })
  }

  /** Planifier la relance J+10 → prochain suivi dans 6 jours (J+10 = 6j après J+4) */
  async function scheduleJ10(leadKey: string) {
    const today = todayMontreal()
    const j10 = addDays(today, 6)
    return patchLead(leadKey, {
      last_touch_at: today,
      next_followup_at: j10,
    })
  }

  async function markReplied(leadKey: string) {
    return patchLead(leadKey, { pipeline_stage: 'replied' })
  }

  async function scheduleCall(leadKey: string) {
    return patchLead(leadKey, { pipeline_stage: 'scheduled' })
  }

  async function markProposal(leadKey: string) {
    return patchLead(leadKey, { pipeline_stage: 'proposal' })
  }

  async function markWon(leadKey: string) {
    return patchLead(leadKey, { pipeline_stage: 'won' })
  }

  async function markLost(leadKey: string) {
    return patchLead(leadKey, { pipeline_stage: 'lost' })
  }

  async function enrichLead(leadKey: string) {
    try {
      const endpoint = `/api/leads/${encodeURIComponent(leadKey)}/enrich`
      const data = await apiCall<{ ok?: boolean; lead?: LeadDetail; data?: { lead?: LeadDetail } }>('POST', endpoint, {
        method: 'POST',
        timeout: 120_000, // 2 min pour la génération LLM
      })
      const raw = data as Record<string, unknown>
      const lead = (raw?.lead ?? raw?.data?.lead) as LeadDetail | undefined
      if (lead) {
        toast.add({ title: 'Succès', description: 'Messages générés', color: 'success' })
        return { data: lead, error: null }
      }
      return { data: null, error: 'Réponse invalide du serveur' }
    } catch (err: any) {
      const msg =
        err?.data?.error ??
        err?.data?.message ??
        err?.message ??
        'Erreur lors de la génération des messages'
      toast.add({ title: 'Erreur', description: String(msg), color: 'error' })
      return { data: null, error: String(msg) }
    }
  }

  async function fetchDaily(date?: string) {
    const d = date || todayMontreal()
    try {
      const data = await apiCall<DailyBrief>('GET', '/api/daily', {
        query: { date: d },
      })
      return { data, error: null }
    } catch (err: any) {
      const msg = err?.message || 'Erreur lors de la récupération du brief'
      toast.add({ title: 'Erreur', description: msg, color: 'error' })
      return { data: null, error: msg }
    }
  }

  async function ingestLinkedinCsv(file: File) {
    const endpoint = '/api/ingest/linkedin/csv'
    try {
      const formData = new FormData()
      formData.append('file', file)
      const data = await apiCall<IngestionResult>('POST', endpoint, {
        method: 'POST',
        body: formData,
      })
      if (import.meta.dev) {
        console.debug('[ingest] CSV', { result: data })
      }
      return { data, error: null }
    } catch (err: any) {
      const msg = normalizeIngestionError(err)
      toast.add({ title: 'Erreur', description: msg, color: 'error' })
      return { data: null, error: msg }
    }
  }

  async function ingestLinkedinUrls(raw: string | string[]) {
    const urls = normalizeLinkedinUrls(raw)
    if (urls.length === 0) {
      const msg = 'Aucune URL LinkedIn valide (format attendu: linkedin.com/in/...)'
      toast.add({ title: 'Erreur', description: msg, color: 'error' })
      return { data: null, error: msg }
    }
    const endpoint = '/api/leads/ingest/linkedin-urls'
    try {
      const data = await apiCall<IngestionResult>('POST', endpoint, {
        method: 'POST',
        body: { urls },
      })
      if (import.meta.dev) {
        console.debug('[ingest] URLs', { count: urls.length, result: data })
      }
      return { data, error: null }
    } catch (err: any) {
      const msg = normalizeIngestionError(err)
      toast.add({ title: 'Erreur', description: msg, color: 'error' })
      return { data: null, error: msg }
    }
  }

  async function health() {
    const endpoint = '/api/health'
    const start = Date.now()
    try {
      logApiRequest('GET', endpoint)
      const data = await $fetch<{ status?: string; latency_ms?: number }>(endpoint)
      const duration = Date.now() - start
      logApiResponse(endpoint, 200, duration)
      apiLatencyMs.value = data?.latency_ms ?? duration
      apiUp.value = (data?.status ?? 'ok') !== 'error'
      return { ok: true, status: data?.status ?? 'ok', latency_ms: apiLatencyMs.value }
    } catch (err: any) {
      const duration = Date.now() - start
      logApiError(endpoint, err?.statusCode ?? err?.status, err?.message ?? String(err))
      apiUp.value = false
      return { ok: false, status: 'error', latency_ms: duration }
    }
  }

  async function ingestGenericCsv(file: File) {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const data = await apiCall<IngestionResult>(
        'POST',
        '/api/leads/ingest/csv',
        { method: 'POST', body: formData },
      )
      return { data, error: null }
    } catch (err: any) {
      const msg = normalizeIngestionError(err)
      toast.add({ title: 'Erreur', description: msg, color: 'error' })
      return { data: null, error: msg }
    }
  }

  async function runMeetingWorkflow(payload: MeetingWorkflowImportPayload) {
    const endpoint = '/api/ariane/workflows/meeting/import'
    try {
      const data = await apiCall<MeetingWorkflowResult>('POST', endpoint, {
        method: 'POST',
        body: payload,
        timeout: 600_000,
      })
      return { data, error: null }
    } catch (err: any) {
      const msg = err?.data?.message ?? err?.message ?? 'Erreur lors du workflow meeting'
      return { data: null, error: msg }
    }
  }

  return {
    fetchLeads,
    fetchGeoOptions,
    rescoreLeads,
    fetchLeadsDiagnostic,
    fetchLead,
    patchLead,
    enrichLead,
    markAsMessaged,
    markJ4Sent,
    markJ10Sent,
    scheduleJ4,
    scheduleJ10,
    health,
    ingestLinkedinCsv,
    ingestLinkedinUrls,
    ingestGenericCsv,
    runMeetingWorkflow,
    markReplied,
    scheduleCall,
    markProposal,
    markWon,
    markLost,
    fetchDaily,
    todayMontreal: () => todayMontreal(),
    addDays: (dateStr: string, days: number) => addDays(dateStr, days),
    apiLatencyMs,
    apiUp,
    leadsInvalidatedAt,
  }
}
