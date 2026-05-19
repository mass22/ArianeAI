import { vi } from 'vitest'

vi.stubGlobal('useState', (key: string, init?: () => unknown) => {
  const val = init ? init() : null
  return { value: val }
})
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
