/**
 * Todolist « à contacter » par jour — max 5 leads/jour.
 * Non contactés au J-1 → reportés au J-2.
 * Stockage localStorage.
 */
import type { Lead } from '~/types/leads'
import { addDays } from '~/lib/dateUtils'

const STORAGE_KEY = 'ariane-daily-todos'
const INBOX_STAGES = ['inbox', 'new']

function isInbox(lead: Lead): boolean {
  return INBOX_STAGES.includes(lead.pipeline_stage ?? '') || lead.status === 'inbox'
}

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

/** Retourne les lead_keys restants pour une date (non contactés) */
function getRemainingForDate(date: string): string[] {
  const data = loadFromStorage()
  return [...(data[date] ?? [])]
}

/** Retire un lead de la liste du jour et sauvegarde */
function markContacted(date: string, leadKey: string) {
  const data = loadFromStorage()
  const keys = (data[date] ?? []).filter((k) => k !== leadKey)
  if (keys.length) data[date] = keys
  else delete data[date]
  saveToStorage(data)
}

/** Extrait le score de priorité (snake_case ou camelCase) */
function getPriorityScore(lead: Lead): number {
  const r = lead as Record<string, unknown>
  const score = r.priority_score ?? r.priorityScore
  return typeof score === 'number' && !Number.isNaN(score) ? score : 0
}

/** Construit la liste du jour : report J-1 + nouveaux jusqu'à 5 */
function buildListForDate(date: string, allLeads: Lead[]): string[] {
  const yesterday = addDays(date, -1)
  const carried = getRemainingForDate(yesterday).filter((key) => {
    const lead = allLeads.find((l) => l.lead_key === key)
    return !lead || isInbox(lead) // ne reporte que ceux encore inbox (non contactés ailleurs)
  })
  const carriedSet = new Set(carried)
  const inboxLeads = allLeads
    .filter(isInbox)
    .filter((l) => !carriedSet.has(l.lead_key))
    .sort((a, b) => getPriorityScore(b) - getPriorityScore(a))
  const toAdd = inboxLeads.slice(0, Math.max(0, 5 - carried.length)).map((l) => l.lead_key)
  return [...carried, ...toAdd]
}

/** Initialise la liste pour une date si vide */
function ensureListForDate(date: string, allLeads: Lead[]) {
  const data = loadFromStorage()
  if (data[date]?.length) return
  const keys = buildListForDate(date, allLeads)
  if (keys.length) {
    data[date] = keys
    saveToStorage(data)
  }
}

/** Vide la liste pour une date (et J-1) — appelé après rescore pour reconstruire avec les nouveaux scores */
function clearListsForRescore(date: string) {
  const yesterday = addDays(date, -1)
  const data = loadFromStorage()
  delete data[date]
  delete data[yesterday]
  saveToStorage(data)
}

/** Liste des leads à contacter pour une date (ordre, max 5). Purge les déjà contactés du stockage. */
function getLeadsToContact(date: string, allLeads: Lead[]): Lead[] {
  ensureListForDate(date, allLeads)
  const data = loadFromStorage()
  const keys = data[date] ?? []
  const leadByKey = new Map(allLeads.map((l) => [l.lead_key, l]))
  const validKeys = keys.filter((key) => {
    const lead = leadByKey.get(key)
    return lead != null && isInbox(lead)
  })
  if (validKeys.length !== keys.length) {
    if (validKeys.length) data[date] = validKeys
    else delete data[date]
    saveToStorage(data)
  }
  // Index dans allLeads = ordre API (déjà trié par score) — fallback si priority_score absent
  const rankByKey = new Map(allLeads.map((l, i) => [l.lead_key, i]))
  const leads = validKeys
    .map((k) => leadByKey.get(k))
    .filter((l): l is Lead => l != null)
  return leads
    .sort((a, b) => {
      const scoreA = getPriorityScore(a)
      const scoreB = getPriorityScore(b)
      if (scoreA !== scoreB) return scoreB - scoreA
      const rankA = rankByKey.get(a.lead_key) ?? 9999
      const rankB = rankByKey.get(b.lead_key) ?? 9999
      return rankA - rankB
    })
    .slice(0, 5)
}

const refreshTrigger = ref(0)

export function useDailyTodos() {
  function markAndRefresh(date: string, leadKey: string) {
    markContacted(date, leadKey)
    refreshTrigger.value++
  }
  return {
    getLeadsToContact,
    getRemainingForDate,
    markContacted: markAndRefresh,
    ensureListForDate,
    clearListsForRescore,
    refreshTrigger,
  }
}
