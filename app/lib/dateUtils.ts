/**
 * Utilitaires de date pour le fuseau America/Montreal
 */

export function todayMontreal(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Montreal',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/** Normalise une valeur de date en YYYY-MM-DD pour comparaison */
export function normalizeToYMD(value: string | number | Date | null | undefined): string | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const s = value.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10)
    }
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  if (typeof value === 'number') {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  return null
}

/**
 * Formate une date (YYYY-MM-DD ou ISO) pour l'affichage en fr-CA.
 * Pour les chaînes date seule, évite le décalage UTC en les traitant comme dates calendaires.
 */
export function formatDateDisplay(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  const s = String(value).trim()
  if (s === '') return '—'
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))
  if (dateOnly) {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    return date.toLocaleDateString('fr-CA', {
      timeZone: 'America/Montreal',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }
  try {
    return new Date(s).toLocaleDateString('fr-CA', {
      timeZone: 'America/Montreal',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return s
  }
}

/** Vérifie si une date (YYYY-MM-DD ou ISO) est dans la semaine courante (lundi–dimanche, Montréal) */
export function isInCurrentWeek(value: string | null | undefined): boolean {
  const ymd = normalizeToYMD(value)
  if (!ymd) return false
  const today = todayMontreal()
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const dayOfWeek = date.getUTCDay()
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStartDate = new Date(Date.UTC(y, m - 1, d - mondayOffset, 12, 0, 0))
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6)
  const [wsY, wsM, wsD] = [weekStartDate.getUTCFullYear(), weekStartDate.getUTCMonth() + 1, weekStartDate.getUTCDate()]
  const [weY, weM, weD] = [weekEndDate.getUTCFullYear(), weekEndDate.getUTCMonth() + 1, weekEndDate.getUTCDate()]
  const weekStart = `${wsY}-${String(wsM).padStart(2, '0')}-${String(wsD).padStart(2, '0')}`
  const weekEnd = `${weY}-${String(weM).padStart(2, '0')}-${String(weD).padStart(2, '0')}`
  return ymd >= weekStart && ymd <= weekEnd
}

/** Vérifie si une date (YYYY-MM-DD ou ISO) est dans le mois courant (America/Montreal) */
export function isInCurrentMonth(value: string | null | undefined): boolean {
  const ymd = normalizeToYMD(value)
  if (!ymd) return false
  const today = todayMontreal()
  const [ty, tm] = today.split('-').map(Number)
  const [yy, ym] = ymd.split('-').map(Number)
  return ty === yy && tm === ym
}

/** Jour du mois (1–31) et nombre de jours dans le mois courant (America/Montreal) */
export function currentMonthProgress(): { dayOfMonth: number; daysInMonth: number } {
  const today = todayMontreal()
  const [y, m] = today.split('-').map(Number)
  const dayOfMonth = Number(today.slice(8, 10))
  const lastDay = new Date(Date.UTC(y, m, 0, 12, 0, 0))
  const daysInMonth = lastDay.getUTCDate()
  return { dayOfMonth, daysInMonth }
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toLocaleDateString('en-CA', {
    timeZone: 'America/Montreal',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/** Nombre de jours entre deux dates (from - to, positif si from > to) */
export function diffInDays(from: string, to: string): number {
  const f = normalizeToYMD(from)
  const t = normalizeToYMD(to)
  if (!f || !t) return NaN
  const [fy, fm, fd] = f.split('-').map(Number)
  const [ty, tm, td] = t.split('-').map(Number)
  const fromDate = Date.UTC(fy, fm - 1, fd, 12, 0, 0)
  const toDate = Date.UTC(ty, tm - 1, td, 12, 0, 0)
  return Math.round((fromDate - toDate) / (24 * 60 * 60 * 1000))
}

/** J+4 : 4 jours après le premier message ; J+10 : 6 jours après J+4 (relance envoyée à J+4) */
export function getFollowupType(
  lastTouchAt: string | null | undefined,
  nextFollowupAt: string | null | undefined,
  targetDate: string,
): 'j4' | 'j10' | null {
  const next = normalizeToYMD(nextFollowupAt)
  const target = normalizeToYMD(targetDate) ?? targetDate.slice(0, 10)
  if (!next || next !== target) return null
  return getScheduledFollowupType(lastTouchAt, nextFollowupAt)
}

/** Infère le type de relance (J+4 ou J+10) à partir de l'intervalle last_touch → next_followup. Utilisable même pour des dates futures. */
export function getScheduledFollowupType(
  lastTouchAt: string | null | undefined,
  nextFollowupAt: string | null | undefined,
): 'j4' | 'j10' | null {
  const next = normalizeToYMD(nextFollowupAt)
  const last = normalizeToYMD(lastTouchAt)
  if (!next || !last) return null
  const daysBetween = diffInDays(next, last)
  if (daysBetween >= 3 && daysBetween <= 5) return 'j4'
  if (daysBetween >= 5 && daysBetween <= 8) return 'j10'
  return null
}
