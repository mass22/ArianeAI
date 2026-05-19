import type {
  InsightsResponse,
  SearchResponse,
  SearchResult,
} from '~/types/insights'

export type InsightsStatus = 'idle' | 'loading' | 'success' | 'error'

export function useInsights() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const status = ref<InsightsStatus>('idle')

  const insights = ref<InsightsResponse | null>(null)
  const searchResults = ref<SearchResult[]>([])

  async function fetchInsights(clientId?: string, period?: string) {
    loading.value = true
    error.value = null
    status.value = 'loading'

    try {
      const query: Record<string, string> = {}
      if (clientId) query.clientId = clientId
      if (period) query.period = period

      const data = await $fetch<InsightsResponse>('/api/memory/insights', {
        query,
      })

      insights.value = data
      status.value = 'success'
      return { data, error: null }
    } catch (err: unknown) {
      const ex = err as { message?: string; statusCode?: number }
      const msg = ex?.message || 'Erreur lors de la récupération des insights'
      error.value = msg
      status.value = 'error'
      insights.value = null
      return { data: null, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function searchMemory(query: string, clientId?: string) {
    loading.value = true
    error.value = null
    status.value = 'loading'

    try {
      const params: Record<string, string> = { query }
      if (clientId) params.clientId = clientId

      const data = await $fetch<SearchResponse>('/api/memory/search', {
        query: params,
      })

      searchResults.value = data?.results ?? []
      status.value = 'success'
      return { data: searchResults.value, error: null }
    } catch (err: unknown) {
      const ex = err as { message?: string }
      const msg = ex?.message || 'Erreur lors de la recherche'
      error.value = msg
      status.value = 'error'
      searchResults.value = []
      return { data: [], error: msg }
    } finally {
      loading.value = false
    }
  }

  function reset() {
    loading.value = false
    error.value = null
    status.value = 'idle'
    insights.value = null
    searchResults.value = []
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    status: readonly(status),
    insights: readonly(insights),
    searchResults: readonly(searchResults),
    fetchInsights,
    searchMemory,
    reset,
  }
}
