import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('$fetch', mockFetch)
})

describe('useArianeApi', () => {
  it('ingestLinkedinCsv envoie le fichier vers /api/ingest/linkedin/csv', async () => {
    const mockResult = { created: 5, merged: 2, skipped: 0, errors: 0, duration_ms: 100 }
    mockFetch.mockResolvedValue(mockResult)

    const { useArianeApi } = await import('./useArianeApi')
    const api = useArianeApi()
    const file = new File(['a,b,c\n1,2,3'], 'test.csv', { type: 'text/csv' })

    const { data, error } = await api.ingestLinkedinCsv(file)

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ingest/linkedin/csv',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(data).toEqual(mockResult)
    expect(error).toBeNull()
  })

  it('ingestLinkedinUrls envoie les URLs vers /api/ingest/urls', async () => {
    const mockResult = { created: 3, merged: 0, skipped: 0, errors: 0, duration_ms: 80 }
    mockFetch.mockResolvedValue(mockResult)

    const { useArianeApi } = await import('./useArianeApi')
    const api = useArianeApi()
    const urls = [
      'https://linkedin.com/in/john',
      'https://linkedin.com/in/jane',
    ]

    const { data, error } = await api.ingestLinkedinUrls(urls)

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ingest/urls',
      expect.objectContaining({
        method: 'POST',
        body: { urls },
      }),
    )
    expect(data).toEqual(mockResult)
    expect(error).toBeNull()
  })

  it('ingestLinkedinUrls filtre les URLs non-LinkedIn et toast si vide', async () => {
    const { useArianeApi } = await import('./useArianeApi')
    const api = useArianeApi()

    const { data, error } = await api.ingestLinkedinUrls(['https://google.com', ''])

    expect(mockFetch).not.toHaveBeenCalled()
    expect(data).toBeNull()
    expect(error).toContain('Aucune URL LinkedIn valide')
  })

  it('ingestGenericCsv envoie le fichier vers /api/leads/ingest/csv', async () => {
    const mockResult = { created: 10, merged: 0, skipped: 2, errors: 0, duration_ms: 150 }
    mockFetch.mockResolvedValue(mockResult)

    const { useArianeApi } = await import('./useArianeApi')
    const api = useArianeApi()
    const file = new File(['col1,col2\nv1,v2'], 'leads.csv', { type: 'text/csv' })

    const { data, error } = await api.ingestGenericCsv(file)

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/leads/ingest/csv',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(data).toEqual(mockResult)
    expect(error).toBeNull()
  })

  it('ingestLinkedinCsv retourne error et toast en cas d\'échec API', async () => {
    mockFetch.mockRejectedValue(new Error('Server error'))

    const { useArianeApi } = await import('./useArianeApi')
    const api = useArianeApi()
    const file = new File(['a,b'], 'test.csv', { type: 'text/csv' })

    const { data, error } = await api.ingestLinkedinCsv(file)

    expect(data).toBeNull()
    expect(error).toBeDefined()
  })
})
