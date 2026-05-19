/**
 * Types pour les insights mémoire Ariane (GET /memory/insights, GET /memory/search)
 */

/** Réponse brute de l'API /memory/insights */
export interface InsightsResponse {
  aggregated?: AggregatedInsights
  top_topics?: TopicItem[]
  recurring_risks?: RiskItem[]
  recurring_decisions?: DecisionItem[]
  activity_trend?: ActivityTrend
}

/** Agrégats globaux (cartes overview) */
export interface AggregatedInsights {
  total_meetings?: number
  decisions_count?: number
  action_items_count?: number
  last_meeting_date?: string
}

/** Élément de sujet récurrent */
export interface TopicItem {
  topic: string
  count?: number
}

/** Risque récurrent */
export interface RiskItem {
  risk: string
  occurrences?: number
}

/** Décision récurrente */
export interface DecisionItem {
  decision: string
  occurrences?: number
}

/** Tendances d'activité (stats textuelles) */
export interface ActivityTrend {
  meetings_last_7d?: number
  meetings_last_30d?: number
  summary?: string
}

/** Résultat de recherche mémoire */
export interface SearchResult {
  id?: string
  text?: string
  snippet?: string
  source?: string
  metadata?: Record<string, unknown>
}

/** Réponse API /memory/search */
export interface SearchResponse {
  results?: SearchResult[]
  total?: number
}
