/**
 * Lightweight composable for API status (latency, availability).
 * Use this when you only need apiLatencyMs/apiUp without full useArianeApi.
 */
export function useApiStatus() {
  const apiLatencyMs = useState<number | null>('api-latency-ms', () => null)
  const apiUp = useState<boolean>('api-up', () => true)
  return { apiLatencyMs, apiUp }
}
