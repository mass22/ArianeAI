// Diagnostic : retourne les artifacts bruts pour un client (debug insights vides)
// GET /api/memory/insights/diagnostic?clientId=xxx

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const clientId = (query.clientId ?? query.client_id) as string | undefined

  if (!clientId) {
    return { error: 'clientId requis', artifacts: [] }
  }

  const config = useRuntimeConfig()
  const baseUrl =
    config.arianeApiBaseUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  try {
    const res = await $fetch<any>(`${baseUrl}/crm/artifacts?clientId=${encodeURIComponent(clientId)}&limit=50`, {
      timeout: 10_000,
    })

    const raw = res
    const artifacts = Array.isArray(res) ? res : res?.data ?? res?.items ?? []

    const summary = artifacts.map((a: any) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      hasMetadata: !!a.metadata,
      hasScribeResult: !!(a.metadata?.scribeResult ?? a.metadata?.scribe ?? a.scribeResult),
      hasTextContent: !!(a.textContent ?? a.content),
      textContentLength: (a.textContent ?? a.content ?? '').length,
      metadataKeys: a.metadata ? Object.keys(a.metadata) : [],
      scribeKeys: a.metadata?.scribeResult ? Object.keys(a.metadata.scribeResult) : [],
    }))

    return {
      clientId,
      totalArtifacts: artifacts.length,
      rawResponseKeys: typeof raw === 'object' ? Object.keys(raw) : [],
      artifactsSummary: summary,
      firstArtifactSample: artifacts[0]
        ? {
            id: artifacts[0].id,
            type: artifacts[0].type,
            hasMetadata: !!artifacts[0].metadata,
            hasTextContent: !!(artifacts[0].textContent ?? artifacts[0].content),
            metadataScribeResult: artifacts[0].metadata?.scribeResult
              ? { keys: Object.keys(artifacts[0].metadata.scribeResult) }
              : null,
            textContentPreview: (artifacts[0].textContent ?? artifacts[0].content ?? '').slice(0, 500),
          }
        : null,
    }
  } catch (err: any) {
    return {
      error: err?.message ?? String(err),
      statusCode: err?.statusCode,
    }
  }
})
