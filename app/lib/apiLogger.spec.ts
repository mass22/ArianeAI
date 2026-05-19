import { describe, it, expect } from 'vitest'
import { logApiRequest, logApiResponse, logApiError } from './apiLogger'

describe('apiLogger', () => {
  it('logApiRequest ne lance pas d\'exception', () => {
    expect(() => logApiRequest('GET', '/api/leads')).not.toThrow()
  })

  it('logApiResponse ne lance pas d\'exception', () => {
    expect(() => logApiResponse('/api/leads', 200, 42)).not.toThrow()
  })

  it('logApiError ne lance pas d\'exception', () => {
    expect(() => logApiError('/api/ingest', 500, 'Internal Server Error')).not.toThrow()
  })
})
