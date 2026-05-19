/**
 * Todos issus des réunions (action items) — stockage par jour.
 * Complément des daily todos leads : tâches libres à faire.
 */
const STORAGE_KEY = 'ariane-meeting-todos'

function loadFromStorage(): Record<string, string[]> {
  if (import.meta.client && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as Record<string, string[]>
    } catch (_) {}
  }
  return {}
}

function saveToStorage(data: Record<string, string[]>) {
  if (import.meta.client && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (_) {}
  }
}

/** Récupère les todos meeting pour une date */
export function getMeetingTodos(date: string): string[] {
  const data = loadFromStorage()
  return [...(data[date] ?? [])]
}

/** Ajoute des todos pour une date (évite les doublons exacts) */
export function addMeetingTodos(date: string, items: string[]) {
  const data = loadFromStorage()
  const existing = new Set(data[date] ?? [])
  let added = 0
  for (const item of items) {
    const t = String(item).trim()
    if (t && !existing.has(t)) {
      existing.add(t)
      added++
    }
  }
  data[date] = Array.from(existing)
  saveToStorage(data)
  return added
}

/** Supprime un todo par index */
export function removeMeetingTodo(date: string, index: number) {
  const data = loadFromStorage()
  const list = data[date] ?? []
  if (index >= 0 && index < list.length) {
    list.splice(index, 1)
    if (list.length) data[date] = list
    else delete data[date]
    saveToStorage(data)
    return true
  }
  return false
}

/** Marque un todo comme fait (le retire de la liste) */
export function markMeetingTodoDone(date: string, index: number) {
  return removeMeetingTodo(date, index)
}

// Ref partagée pour forcer le rafraîchissement du Brief quand on ajoute/supprime des todos
const refreshTrigger = ref(0)

export function useMeetingTodos() {
  function addAndRefresh(date: string, items: string[]) {
    const n = addMeetingTodos(date, items)
    if (n > 0) refreshTrigger.value++
    return n
  }

  function removeAndRefresh(date: string, index: number) {
    const ok = removeMeetingTodo(date, index)
    if (ok) refreshTrigger.value++
    return ok
  }

  return {
    getMeetingTodos,
    addMeetingTodos: addAndRefresh,
    removeMeetingTodo: removeAndRefresh,
    markMeetingTodoDone: removeAndRefresh,
    refreshTrigger,
  }
}
