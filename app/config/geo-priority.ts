// Mapping priorité géographique : 0 = Unknown, 1 = Canada, 2 = USA, 3 = EU, 4 = Other
export const GEO_PRIORITY_OPTIONS = [
  { value: 0, label: 'Unknown' },
  { value: 1, label: 'Canada' },
  { value: 2, label: 'USA' },
  { value: 3, label: 'EU' },
  { value: 4, label: 'Other' },
] as const

export const GEO_PRIORITY_LABELS: Record<number, string> = {
  0: 'Unknown',
  1: 'Canada',
  2: 'USA',
  3: 'EU',
  4: 'Other',
}

export function geoPriorityLabel(value: number | null | undefined): string {
  if (value == null) return '—'
  return GEO_PRIORITY_LABELS[value] ?? String(value)
}
