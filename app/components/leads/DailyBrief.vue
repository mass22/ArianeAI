<script setup lang="ts">
import type { DailyBrief, Lead } from '~/types/leads'
import { getFollowupType, getScheduledFollowupType, normalizeToYMD } from '~/lib/dateUtils'

const props = withDefaults(
  defineProps<{
    brief: DailyBrief | null
    loading?: boolean
    /** Tous les leads (source: GET /api/leads) — Top 5 et fallback relances */
    allLeads?: Lead[]
    /** Leads filtrés par next_followup_at par l'API (ou à filtrer côté client) */
    followupLeadsApi?: Lead[]
    selectedDate?: string
  }>(),
  {
    allLeads: () => [],
    followupLeadsApi: () => [],
    selectedDate: '',
  },
)

const emit = defineEmits<{ refreshed: [] }>()

const DATE_KEYS = [
  'next_followup_at',
  'next_follow_up_at',
  'nextFollowUpAt',
  'next_followup_date',
  'followup_at',
  'followup_date',
  'nextFollowupAt',
]

function getFollowupDate(lead: Lead): string | null {
  const r = lead as Record<string, unknown>
  for (const key of DATE_KEYS) {
    const v = r[key]
    if (v != null) {
      const norm = normalizeToYMD(v)
      if (norm) return norm
    }
  }
  return null
}

function dateMatches(lead: Lead, dateStr: string): boolean {
  const leadDate = getFollowupDate(lead)
  const targetDate = normalizeToYMD(dateStr) ?? dateStr.slice(0, 10)
  return leadDate !== null && leadDate === targetDate
}

function getField(lead: Lead, keys: string[]): string {
  const r = lead as Record<string, unknown>
  for (const k of keys) {
    const v = r[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

/** Retourne le message de relance J+4 ou J+10 selon le type */
function getFollowupMessageForType(lead: Lead, type: 'j4' | 'j10' | null): string {
  if (!type) return getField(lead, ['followup_message'])
  const keys = type === 'j4'
    ? ['followup_j4', 'followup_J4', 'followupJ4', 'followup_message_j4', 'followupMessageJ4']
    : ['followup_j10', 'followup_J10', 'followupJ10', 'followup_message_j10', 'followupMessageJ10']
  return getField(lead, keys) || getField(lead, ['followup_message'])
}

/** URL LinkedIn du lead (snake_case ou camelCase), normalisée avec https */
function linkedinHref(lead: Lead): string {
  const r = lead as Record<string, unknown>
  const url = (r.linkedin_url ?? r.linkedinUrl) as string | undefined
  if (!url || !String(url).trim()) return ''
  const u = String(url).trim()
  return u.startsWith('http') ? u : `https://${u}`
}

const { getLeadsToContact, markContacted, refreshTrigger } = useDailyTodos()
const actionLoadingKey = ref<string | null>(null)
const { messageLang, hasEnVersion, getOutreach, getFollowupMessage } = useLeadMessagesLang()

/** Switcher FR/EN visible si au moins un lead a des versions anglaises */
const hasAnyEnVersion = computed(() =>
  leadsToContact.value.some((l) => hasEnVersion(l)) || mergedFollowups.value.some((l) => hasEnVersion(l)),
)

/** Score priorité (snake_case ou camelCase) */
function getPriorityScore(l: Lead): number {
  const r = l as Record<string, unknown>
  const s = r.priority_score ?? r.priorityScore
  return typeof s === 'number' && !Number.isNaN(s) ? s : 0
}

/** Todolist « à contacter » — max 5/jour, triés par score décroissant */
const leadsToContact = computed(() => {
  refreshTrigger.value // réactivité
  const date = props.selectedDate || ''
  const list = date ? getLeadsToContact(date, props.allLeads ?? []) : []
  const all = props.allLeads ?? []
  const rankByKey = new Map(all.map((l, i) => [l.lead_key, i]))
  return [...list].sort((a, b) => {
    const sa = getPriorityScore(a)
    const sb = getPriorityScore(b)
    if (sa !== sb) return sb - sa
    return (rankByKey.get(a.lead_key) ?? 9999) - (rankByKey.get(b.lead_key) ?? 9999)
  })
})

const followupLeadsFromList = computed(() => {
  const date = props.selectedDate
  if (!date) return []
  const fromApi = props.followupLeadsApi ?? []
  const fromAll = props.allLeads ?? []
  const filtered = [...fromApi, ...fromAll].filter((l) => dateMatches(l, date))
  const byKey = new Map<string, Lead>()
  for (const l of filtered) {
    if (!byKey.has(l.lead_key)) byKey.set(l.lead_key, l)
  }
  return Array.from(byKey.values())
})


const mergedFollowups = computed(() => {
  const fromDaily = props.brief?.followups_today ?? []
  const fromList = followupLeadsFromList.value
  const date = props.selectedDate || ''
  const byKey = new Map<string, Lead & { followup_message?: string; followup_type?: 'j4' | 'j10' }>()
  for (const l of fromList) {
    const lastTouch = (l as Record<string, unknown>).last_action_at ?? l.last_touch_at
    const followupType = date && dateMatches(l, date) ? getScheduledFollowupType(lastTouch, l.next_followup_at) : null
    const msg = getFollowupMessageForType(l, followupType)
    byKey.set(l.lead_key, { ...l, followup_message: msg, followup_type: followupType ?? undefined })
  }
  for (const l of fromDaily) {
    const existing = byKey.get(l.lead_key)
    const lastTouch = (l as Record<string, unknown>).last_action_at ?? l.last_touch_at
    const followupType = date && dateMatches(l, date) ? getScheduledFollowupType(lastTouch, l.next_followup_at) : null
    const msg = (l as any).followup_message ?? (followupType ? getFollowupMessageForType(l, followupType) : undefined)
    byKey.set(l.lead_key, { ...l, followup_message: msg ?? existing?.followup_message, followup_type: followupType ?? undefined })
  }
  return Array.from(byKey.values())
})

const selectedDateLabel = computed(() => {
  const d = props.selectedDate
  if (!d) return 'cette date'
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('fr-CA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return d
  }
})

const pipelineSummary = computed(() => {
  if (props.brief?.pipeline_summary && Object.keys(props.brief.pipeline_summary).length) {
    return props.brief.pipeline_summary
  }
  const leads = props.allLeads ?? []
  const summary: Record<string, number> = {}
  for (const l of leads) {
    const stage = l.pipeline_stage || l.status || 'unknown'
    summary[stage] = (summary[stage] ?? 0) + 1
  }
  return summary
})

const hasContent = computed(() => {
  return Object.keys(pipelineSummary.value).length > 0 ||
    leadsToContact.value.length > 0 ||
    mergedFollowups.value.length > 0
})


function copyToClipboard(text: string) {
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    useToast().add({ title: 'Copié', description: 'Texte copié dans le presse-papier', color: 'success' })
  })
}

const { markAsMessaged, markJ4Sent, markJ10Sent } = useArianeApi()

async function handleMarkMessaged(lead: Lead) {
  const date = props.selectedDate || ''
  if (!date) return
  actionLoadingKey.value = lead.lead_key
  try {
    const { error } = await markAsMessaged(lead.lead_key)
    if (!error) {
      markContacted(date, lead.lead_key)
      emit('refreshed')
    }
  } finally {
    actionLoadingKey.value = null
  }
}

async function handleMarkJ4Sent(lead: Lead) {
  actionLoadingKey.value = lead.lead_key
  try {
    const { error } = await markJ4Sent(lead.lead_key)
    if (!error) emit('refreshed')
  } finally {
    actionLoadingKey.value = null
  }
}

async function handleMarkJ10Sent(lead: Lead) {
  actionLoadingKey.value = lead.lead_key
  try {
    const { error } = await markJ10Sent(lead.lead_key)
    if (!error) emit('refreshed')
  } finally {
    actionLoadingKey.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-circle" class="h-8 w-8 animate-spin text-muted" />
    </div>

    <template v-else-if="brief || hasContent">
      <!-- Pipeline summary -->
      <div v-if="Object.keys(pipelineSummary).length" class="rounded-lg border border-default p-4">
        <h2 class="text-sm font-semibold mb-3">Résumé pipeline</h2>
        <div class="flex flex-wrap gap-3">
          <div
            v-for="(count, stage) in pipelineSummary"
            :key="stage"
            class="flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1"
          >
            <span class="text-xs font-medium">{{ stage }}</span>
            <span class="text-xs text-muted">{{ count }}</span>
          </div>
        </div>
      </div>

      <!-- Todolist : max 5 à contacter par jour (report des non contactés au lendemain) -->
      <div class="rounded-lg border border-default p-4">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 class="text-sm font-semibold">
            À contacter le {{ selectedDateLabel }} (max 5)
          </h2>
          <div class="flex items-center gap-3">
            <div
              v-if="hasAnyEnVersion"
              class="flex rounded-md overflow-hidden border border-default"
              role="group"
              aria-label="Langue des messages"
            >
              <UButton
                size="xs"
                variant="ghost"
                :color="messageLang === 'fr' ? 'primary' : 'neutral'"
                :class="messageLang === 'fr' ? 'bg-muted' : ''"
                @click="messageLang = 'fr'"
              >
                FR
              </UButton>
              <UButton
                size="xs"
                variant="ghost"
                :color="messageLang === 'en' ? 'primary' : 'neutral'"
                :class="messageLang === 'en' ? 'bg-muted' : ''"
                @click="messageLang = 'en'"
              >
                EN
              </UButton>
            </div>
            <NuxtLink
              to="/leads"
              class="text-xs text-primary hover:underline"
            >
              Voir tous les leads →
            </NuxtLink>
          </div>
        </div>
        <div v-if="leadsToContact.length" class="space-y-3">
          <div
            v-for="item in leadsToContact"
            :key="item.lead_key"
            class="flex items-start justify-between gap-4 rounded-md bg-muted/30 p-3"
          >
            <div class="flex-1 min-w-0">
              <NuxtLink
                :to="`/leads/${item.lead_key}`"
                class="font-medium hover:underline"
              >
                {{ item.contact_name || item.name || item.company || item.lead_key }}
              </NuxtLink>
              <p v-if="item.company && (item.contact_name || item.name)" class="text-xs text-muted">
                {{ item.company }}
              </p>
              <p
                v-if="getOutreach(item)"
                class="mt-2 text-sm text-muted line-clamp-2"
              >
                {{ getOutreach(item) }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <a
                v-if="linkedinHref(item)"
                :href="linkedinHref(item)"
                target="_blank"
                rel="noopener noreferrer"
                title="Profil LinkedIn"
                class="inline-flex items-center justify-center rounded-md font-medium text-xs gap-1 ring ring-inset ring-primary/50 text-primary hover:bg-primary/10 p-1 transition-colors"
              >
                <UIcon name="i-simple-icons-linkedin" class="size-4 shrink-0" />
              </a>
              <UButton
                v-if="getOutreach(item)"
                size="xs"
                variant="outline"
                icon="i-lucide-copy"
                @click="copyToClipboard(getOutreach(item) || '')"
              >
                Copier
              </UButton>
              <UButton
                size="xs"
                color="primary"
                :loading="actionLoadingKey === item.lead_key"
                @click="handleMarkMessaged(item)"
              >
                Marquer messagé
              </UButton>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-muted">
          Aucun lead à contacter — les non contactés d'hier sont reportés au lendemain.
        </p>
      </div>

      <!-- Relances (source: /api/leads filtré par next_followup_at + daily API) -->
      <div class="rounded-lg border border-default p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold">
            Relances prévues le {{ selectedDateLabel }}
          </h2>
          <NuxtLink
            to="/leads"
            class="text-xs text-primary hover:underline"
          >
            Gérer les leads →
          </NuxtLink>
        </div>
        <div v-if="mergedFollowups.length" class="space-y-3">
          <div
            v-for="item in mergedFollowups"
            :key="item.lead_key"
            class="flex items-start justify-between gap-4 rounded-md bg-muted/30 p-3"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <NuxtLink
                  :to="`/leads/${item.lead_key}`"
                  class="font-medium hover:underline"
                >
                  {{ item.contact_name || item.name || item.company || item.lead_key }}
                </NuxtLink>
                <UBadge
                  v-if="(item as any).followup_type"
                  :variant="(item as any).followup_type === 'j4' ? 'solid' : 'outline'"
                  size="xs"
                  :color="(item as any).followup_type === 'j4' ? 'primary' : 'neutral'"
                >
                  J+{{ (item as any).followup_type === 'j4' ? '4' : '10' }}
                </UBadge>
              </div>
              <p v-if="item.company && (item.contact_name || item.name)" class="text-xs text-muted">
                {{ item.company }}
              </p>
              <p v-if="getFollowupMessage(item, (item as any).followup_type)" class="mt-2 text-sm text-muted">
                {{ getFollowupMessage(item, (item as any).followup_type) }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <a
                v-if="linkedinHref(item)"
                :href="linkedinHref(item)"
                target="_blank"
                rel="noopener noreferrer"
                title="Profil LinkedIn"
                class="inline-flex items-center justify-center rounded-md font-medium text-xs gap-1 ring ring-inset ring-primary/50 text-primary hover:bg-primary/10 p-1 transition-colors"
              >
                <UIcon name="i-simple-icons-linkedin" class="size-4 shrink-0" />
              </a>
              <UButton
                v-if="getFollowupMessage(item, (item as any).followup_type)"
                size="xs"
                variant="outline"
                icon="i-lucide-copy"
                @click="copyToClipboard(getFollowupMessage(item, (item as any).followup_type))"
              >
                Copier relance
              </UButton>
              <UButton
                v-if="(item as any).followup_type === 'j4'"
                size="xs"
                color="primary"
                :loading="actionLoadingKey === item.lead_key"
                @click="handleMarkJ4Sent(item)"
              >
                J+4 envoyé
              </UButton>
              <UButton
                v-if="(item as any).followup_type === 'j10'"
                size="xs"
                color="primary"
                :loading="actionLoadingKey === item.lead_key"
                @click="handleMarkJ10Sent(item)"
              >
                J+10 envoyé
              </UButton>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-muted">
          Aucune relance prévue pour cette date
        </p>
      </div>
    </template>

    <div v-else class="text-center py-12 text-muted">
      Aucune donnée disponible pour cette date
    </div>
  </div>
</template>
