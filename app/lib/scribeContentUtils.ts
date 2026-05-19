/**
 * Utilitaires pour construire et parser le contenu markdown des réunions (Scribe).
 * Utilisé pour l'import meetings et l'extraction des insights depuis textContent.
 */

export interface ScribeResult {
  summary?: string
  key_points?: string[]
  client_goals?: string[]
  implicit_needs?: string[]
  risks?: string[]
  action_items?: string[]
  actions?: string[]
  open_questions?: string[]
  [key: string]: unknown
}

/** Construit le markdown complet pour l'import (Résumé + sections structurées + transcription) */
export function buildMeetingContentFromScribe(scribe: ScribeResult | null, transcript: string): string {
  const parts: string[] = []

  if (scribe?.summary) {
    parts.push(`## Résumé\n\n${scribe.summary}\n`)
  }
  if (scribe?.key_points?.length) {
    parts.push('## Points clés\n\n')
    scribe.key_points.forEach((p) => parts.push(`- ${p}\n`))
  }
  if (scribe?.client_goals?.length) {
    parts.push('## Objectifs client\n\n')
    scribe.client_goals.forEach((g) => parts.push(`- ${g}\n`))
  }
  if (scribe?.risks?.length) {
    parts.push('## Risques\n\n')
    scribe.risks.forEach((r) => parts.push(`- ${r}\n`))
  }
  if (scribe?.action_items?.length || scribe?.actions?.length) {
    const items = scribe.action_items ?? scribe.actions ?? []
    parts.push('## Actions\n\n')
    items.forEach((a) => parts.push(`- ${a}\n`))
  }
  if (transcript?.trim()) {
    parts.push('\n## Transcription brute\n\n')
    parts.push(transcript.trim())
  }

  return parts.length > 0 ? parts.join('\n') : transcript || ''
}

/** Extrait les items d'une section markdown (## Titre suivi de - item) */
function extractSectionItems(text: string, sectionTitle: string): string[] {
  const items: string[] = []
  const regex = new RegExp(`##\\s*${sectionTitle}\\s*\\n+([\\s\\S]*?)(?=##|$)`, 'im')
  const match = text.match(regex)
  if (!match) return items
  const block = match[1]
  const lines = block.split('\n')
  for (const line of lines) {
    const m = line.match(/^[-*]\s+(.+)/)
    if (m) items.push(m[1].trim())
  }
  return items.filter(Boolean)
}

/** Parse textContent d'un artifact et extrait points clés, risques, objectifs, actions */
export function parseMeetingContentFromMarkdown(text: string): {
  key_points: string[]
  risks: string[]
  client_goals: string[]
  action_items: string[]
} {
  const content = text || ''
  return {
    key_points: extractSectionItems(content, 'Points clés'),
    risks: extractSectionItems(content, 'Risques'),
    client_goals: extractSectionItems(content, 'Objectifs client'),
    action_items: extractSectionItems(content, 'Actions'),
  }
}
