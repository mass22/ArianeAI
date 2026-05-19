import type { Lead } from '~/types/leads'

const STORAGE_KEY = 'leads-lang-preference'

export type LeadMessagesLang = 'fr' | 'en'

const MESSAGE_KEYS: Record<LeadMessagesLang, { outreach: string; j4: string; j10: string }> = {
  fr: {
    outreach: 'generated_outreach',
    j4: 'followup_j4',
    j10: 'followup_j10',
  },
  en: {
    outreach: 'generated_outreach_en',
    j4: 'followup_j4_en',
    j10: 'followup_j10_en',
  },
}

/** Variantes de clés supportées par l'API (snake_case, camelCase, etc.) */
const OUTREACH_FALLBACK_KEYS = ['outreach', 'outreach_message', 'draft_message']
const J4_FALLBACK_KEYS = ['followup_J4', 'followupJ4', 'followup_message_j4', 'followupMessageJ4']
const J10_FALLBACK_KEYS = ['followup_J10', 'followupJ10', 'followup_message_j10', 'followupMessageJ10']

function getField(lead: Lead | null, keys: string[]): string {
  if (!lead) return ''
  const r = lead as Record<string, unknown>
  for (const k of keys) {
    const v = r[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

/** Récupère la préférence stockée (utilisable SSR-safe via onMounted) */
export function getStoredLeadMessagesLang(): LeadMessagesLang {
  if (import.meta.server) return 'fr'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'en' ? 'en' : 'fr'
  } catch {
    return 'fr'
  }
}

/** Composable pour le switcher de langue des messages de prospection (outreach, J+4, J+10) */
export function useLeadMessagesLang() {
  const messageLang = ref<LeadMessagesLang>('fr')

  onMounted(() => {
    messageLang.value = getStoredLeadMessagesLang()
  })

  watch(
    messageLang,
    (l) => {
      if (import.meta.server) return
      try {
        localStorage.setItem(STORAGE_KEY, l)
      } catch {
        // localStorage indisponible
      }
    },
    { immediate: false },
  )

  /** Retourne true si le lead a au moins une version anglaise */
  function hasEnVersion(lead: Lead | null): boolean {
    if (!lead) return false
    const r = lead as Record<string, unknown>
    return !!(
      (r.generated_outreach_en != null && String(r.generated_outreach_en).trim())
      || (r.followup_j4_en != null && String(r.followup_j4_en).trim())
      || (r.followup_j10_en != null && String(r.followup_j10_en).trim())
    )
  }

  /** Récupère le message d'outreach selon la langue (fallback FR si _en vide) */
  function getOutreach(lead: Lead | null): string {
    if (!lead) return ''
    const keysEn = [MESSAGE_KEYS.en.outreach, MESSAGE_KEYS.fr.outreach, ...OUTREACH_FALLBACK_KEYS]
    const keysFr = [MESSAGE_KEYS.fr.outreach, ...OUTREACH_FALLBACK_KEYS]
    return getField(lead, messageLang.value === 'en' ? keysEn : keysFr)
  }

  /** Récupère le message J+4 selon la langue (fallback FR si _en vide) */
  function getFollowupJ4(lead: Lead | null): string {
    if (!lead) return ''
    const keysEn = [MESSAGE_KEYS.en.j4, MESSAGE_KEYS.fr.j4, ...J4_FALLBACK_KEYS]
    const keysFr = [MESSAGE_KEYS.fr.j4, ...J4_FALLBACK_KEYS]
    return getField(lead, messageLang.value === 'en' ? keysEn : keysFr)
  }

  /** Récupère le message J+10 selon la langue (fallback FR si _en vide) */
  function getFollowupJ10(lead: Lead | null): string {
    if (!lead) return ''
    const keysEn = [MESSAGE_KEYS.en.j10, MESSAGE_KEYS.fr.j10, ...J10_FALLBACK_KEYS]
    const keysFr = [MESSAGE_KEYS.fr.j10, ...J10_FALLBACK_KEYS]
    return getField(lead, messageLang.value === 'en' ? keysEn : keysFr)
  }

  /** Récupère le message de relance (J+4 ou J+10) selon le type */
  function getFollowupMessage(lead: Lead | null, type: 'j4' | 'j10' | null): string {
    if (!lead) return ''
    if (type === 'j4') return getFollowupJ4(lead)
    if (type === 'j10') return getFollowupJ10(lead)
    return getField(lead, ['followup_message'])
  }

  return {
    messageLang,
    hasEnVersion,
    getOutreach,
    getFollowupJ4,
    getFollowupJ10,
    getFollowupMessage,
  }
}
