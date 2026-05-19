// Proxy GET /api/memory/insights → Ariane-Core GET /memory/insights
// Fallback: si memory/insights absent ou vide, agrège depuis CRM artifacts
// Extrait les insights depuis metadata.scribeResult OU en parsant textContent (markdown ## sections)
import { createError } from 'h3'

const baseUrlFromConfig = (config: ReturnType<typeof useRuntimeConfig>) =>
  config.arianeApiBaseUrl || config.arianeCoreUrl || 'http://127.0.0.1:4000'

function normalizeInsightsResponse(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {}
  const obj = raw as Record<string, unknown>
  if (obj.data && typeof obj.data === 'object') {
    return obj.data as Record<string, unknown>
  }
  return obj
}

function hasUsefulInsights(normalized: Record<string, unknown>): boolean {
  const agg = normalized.aggregated as Record<string, unknown> | undefined
  const total = (agg?.total_meetings as number) ?? 0
  const topics = (normalized.top_topics as unknown[])?.length ?? 0
  const risks = (normalized.recurring_risks as unknown[])?.length ?? 0
  const decisions = (normalized.recurring_decisions as unknown[])?.length ?? 0
  return total > 0 || topics > 0 || risks > 0 || decisions > 0
}

/** Extrait scribeResult d'un artifact (metadata.scribeResult, scribeResult, metadata) */
function getScribeResult(artifact: any): Record<string, any> | null {
  const meta = artifact?.metadata
  if (!meta || typeof meta !== 'object') return null
  const scribe = meta.scribeResult ?? meta.scribe ?? artifact.scribeResult
  return scribe && typeof scribe === 'object' ? scribe : null
}

/** Normalise un scribeResult (camelCase → snake_case pour compat) */
function normalizeScribeKeys(scribe: Record<string, any>): Record<string, any> {
  return {
    key_points: scribe.key_points ?? scribe.keyPoints ?? [],
    client_goals: scribe.client_goals ?? scribe.clientGoals ?? [],
    risks: scribe.risks ?? [],
    action_items: scribe.action_items ?? scribe.actionItems ?? scribe.actions ?? [],
  }
}

/** Parse textContent markdown : ## Section\n\n- item */
function extractSectionItems(text: string, sectionTitle: string): string[] {
  const items: string[] = []
  const regex = new RegExp(`##\\s*${sectionTitle}\\s*\\n+([\\s\\S]*?)(?=##|$)`, 'im')
  const match = (text || '').match(regex)
  if (!match) return items
  const block = match[1]
  const lines = block.split('\n')
  for (const line of lines) {
    const m = line.match(/^[-*]\s+(.+)/)
    if (m) items.push(m[1].trim())
  }
  return items.filter(Boolean)
}

/** Parse textContent d'un artifact pour extraire points clés, risques, objectifs, actions */
function parseMeetingContent(text: string): {
  key_points: string[]
  risks: string[]
  client_goals: string[]
  action_items: string[]
} {
  const t = text || ''
  return {
    key_points: extractSectionItems(t, 'Points clés'),
    risks: extractSectionItems(t, 'Risques'),
    client_goals: extractSectionItems(t, 'Objectifs client'),
    action_items: extractSectionItems(t, 'Actions'),
  }
}

/** Agrège des chaînes en { item, count } et trie par count décroissant */
function aggregateStrings(items: string[]): { item: string; count: number }[] {
  const map = new Map<string, number>()
  for (const s of items) {
    const t = String(s || '').trim()
    if (!t) continue
    map.set(t, (map.get(t) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([item, count]) => ({ item, count }))
    .sort((a, b) => b.count - a.count)
}

function buildInsightsFromArtifacts(artifacts: any[]): Record<string, unknown> {
  const meetings = artifacts.filter((a) => a.type === 'meeting' || !a.type)
  const sorted = [...meetings].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  )
  const lastMeeting = sorted[0]
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const meetingsLast7d = meetings.filter((a) => new Date(a.createdAt || 0) >= sevenDaysAgo).length
  const meetingsLast30d = meetings.filter((a) => new Date(a.createdAt || 0) >= thirtyDaysAgo).length

  let totalActions = 0
  let totalDecisions = 0
  const allTopics: string[] = []
  const allRisks: string[] = []
  const allDecisions: string[] = []

  for (const a of meetings) {
    const scribe = getScribeResult(a)
    const textContent = a.textContent ?? a.content ?? ''

    if (scribe) {
      const n = normalizeScribeKeys(scribe)
      const actions = n.action_items
      const risks = n.risks
      const topics = n.key_points
      const decisions = n.client_goals
      if (Array.isArray(actions)) totalActions += actions.length
      if (Array.isArray(decisions)) {
        totalDecisions += decisions.length
        allDecisions.push(...decisions.map(String))
      }
      if (Array.isArray(risks)) allRisks.push(...risks.map(String))
      if (Array.isArray(topics)) allTopics.push(...topics.map(String))
    } else if (textContent) {
      const parsed = parseMeetingContent(textContent)
      totalActions += parsed.action_items.length
      totalDecisions += parsed.client_goals.length
      allTopics.push(...parsed.key_points)
      allRisks.push(...parsed.risks)
      allDecisions.push(...parsed.client_goals)
      // Actions -> action_items_count ; client_goals -> decisions
    }
  }

  const topTopics = aggregateStrings(allTopics).map(({ item, count }) => ({ topic: item, count }))
  const recurringRisks = aggregateStrings(allRisks).map(({ item, count }) => ({ risk: item, occurrences: count }))
  const recurringDecisions = aggregateStrings(allDecisions).map(({ item, count }) => ({ decision: item, occurrences: count }))

  return {
    aggregated: {
      total_meetings: meetings.length,
      decisions_count: totalDecisions,
      action_items_count: totalActions,
      last_meeting_date: lastMeeting?.createdAt ?? null,
    },
    top_topics: topTopics,
    recurring_risks: recurringRisks,
    recurring_decisions: recurringDecisions,
    activity_trend: {
      meetings_last_7d: meetingsLast7d,
      meetings_last_30d: meetingsLast30d,
      summary:
        meetings.length > 0
          ? `${meetings.length} réunion(s) importée(s) pour ce client.`
          : 'Aucune réunion importée.',
    },
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const baseUrl = baseUrlFromConfig(config)

  const query = getQuery(event)
  const clientId = (query.clientId ?? query.client_id) as string | undefined
  const period = query.period as string | undefined

  const params: Record<string, string> = {}
  if (clientId) params.clientId = clientId
  if (period) params.period = period

  const qs = new URLSearchParams(params).toString()
  const memoryUrl = `${baseUrl}/memory/insights${qs ? `?${qs}` : ''}`

  let normalized: Record<string, unknown> = {}
  try {
    const raw = await $fetch(memoryUrl, { timeout: 15_000 })
    normalized = normalizeInsightsResponse(raw)
    if (hasUsefulInsights(normalized)) {
      // Ariane Core peut ne pas inclure activity_trend → on le complète depuis les artifacts
      const hasActivityTrend = (normalized.activity_trend as Record<string, unknown>)?.meetings_last_7d != null
        || (normalized.activity_trend as Record<string, unknown>)?.meetingsLast7d != null
      if (!hasActivityTrend && clientId) {
        try {
          const artifactsRes = await $fetch<any>(
            `${baseUrl}/crm/artifacts?clientId=${encodeURIComponent(clientId)}&limit=200`,
            { timeout: 10_000 },
          )
          const artifacts =
            Array.isArray(artifactsRes) ? artifactsRes : artifactsRes?.data ?? artifactsRes?.items ?? []
          const fromArtifacts = buildInsightsFromArtifacts(artifacts)
          normalized.activity_trend = fromArtifacts.activity_trend
        } catch {
          // Ignorer si artifacts échoue, garder la réponse memory/insights
        }
      }
      return normalized
    }
  } catch (err: any) {
    if (err?.statusCode !== 404 && err?.cause?.code !== 'ECONNREFUSED') {
      const message = err?.message || 'Erreur lors de la récupération des insights'
      throw createError({ statusCode: err?.statusCode || 500, message })
    }
  }

  // Fallback: agrégation depuis CRM artifacts
  if (!clientId) {
    return {
      aggregated: { total_meetings: 0, decisions_count: 0, action_items_count: 0, last_meeting_date: null },
      top_topics: [],
      recurring_risks: [],
      recurring_decisions: [],
      activity_trend: { meetings_last_7d: 0, meetings_last_30d: 0, summary: 'Sélectionnez un client.' },
    }
  }

  try {
    const artifactsRes = await $fetch<any>(
      `${baseUrl}/crm/artifacts?clientId=${encodeURIComponent(clientId)}&limit=200`,
      { timeout: 10_000 },
    )
    const artifacts =
      Array.isArray(artifactsRes) ? artifactsRes : artifactsRes?.data ?? artifactsRes?.items ?? []
    return buildInsightsFromArtifacts(artifacts)
  } catch (err: any) {
    return buildInsightsFromArtifacts([])
  }
})
