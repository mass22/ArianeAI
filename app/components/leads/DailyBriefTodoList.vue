<script setup lang="ts">
import type { DailyBrief, Lead, LeadsResponse } from '~/types/leads'
import { getScheduledFollowupType, normalizeToYMD } from '~/lib/dateUtils'

defineOptions({
  name: 'DailyBriefTodoList',
})

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

/** URL LinkedIn du lead (snake_case ou camelCase), normalisée avec https */
function linkedinHref(lead: Lead): string {
  const r = lead as Record<string, unknown>
  const url = (r.linkedin_url ?? r.linkedinUrl) as string | undefined
  if (!url || !String(url).trim()) return ''
  const u = String(url).trim()
  return u.startsWith('http') ? u : `https://${u}`
}

const { fetchDaily, todayMontreal, markAsMessaged, leadsInvalidatedAt } = useArianeApi()
const selectedDate = ref(todayMontreal())
const brief = ref<DailyBrief | null>(null)
const allLeads = ref<Lead[]>([])
const followupLeads = ref<Lead[]>([])
const loading = ref(true)
const actionLoadingKey = ref<string | null>(null)

const { getLeadsToContact, markContacted, clearListsForRescore, refreshTrigger } = useDailyTodos()
const { getMeetingTodos, removeMeetingTodo, refreshTrigger: meetingRefreshTrigger } = useMeetingTodos()
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

/** Leads à contacter, triés par score décroissant */
const leadsToContact = computed(() => {
  refreshTrigger.value
  const list = selectedDate.value ? getLeadsToContact(selectedDate.value, allLeads.value) : []
  const all = allLeads.value
  const rankByKey = new Map(all.map((l, i) => [l.lead_key, i]))
  return [...list].sort((a, b) => {
    const sa = getPriorityScore(a)
    const sb = getPriorityScore(b)
    if (sa !== sb) return sb - sa
    return (rankByKey.get(a.lead_key) ?? 9999) - (rankByKey.get(b.lead_key) ?? 9999)
  })
})

const followupLeadsFromList = computed(() => {
  const date = selectedDate.value
  if (!date) return []
  const fromApi = followupLeads.value
  const fromAll = allLeads.value
  const filtered = [...fromApi, ...fromAll].filter((l) => dateMatches(l, date))
  const byKey = new Map<string, Lead>()
  for (const l of filtered) {
    if (!byKey.has(l.lead_key)) byKey.set(l.lead_key, l)
  }
  return Array.from(byKey.values())
})

const mergedFollowups = computed(() => {
  const fromDaily = brief.value?.followups_today ?? []
  const fromList = followupLeadsFromList.value
  const date = selectedDate.value
  const byKey = new Map<string, Lead & { followup_message?: string; followup_type?: 'j4' | 'j10' }>()
  for (const l of fromList) {
    const lastTouch = (l as Record<string, unknown>).last_action_at ?? l.last_touch_at
    const followupType = date && dateMatches(l, date) ? getScheduledFollowupType(lastTouch, l.next_followup_at) : null
    byKey.set(l.lead_key, { ...l, followup_type: followupType ?? undefined })
  }
  for (const l of fromDaily) {
    const lastTouch = (l as Record<string, unknown>).last_action_at ?? l.last_touch_at
    const followupType = date && dateMatches(l, date) ? getScheduledFollowupType(lastTouch, l.next_followup_at) : null
    const msg = (l as Record<string, unknown>).followup_message as string | undefined
    byKey.set(l.lead_key, {
      ...l,
      followup_message: msg,
      followup_type: followupType ?? undefined,
    })
  }
  return Array.from(byKey.values())
})

const dateLabel = computed(() => {
  const d = selectedDate.value
  if (!d) return ''
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

const meetingTodos = computed(() => {
  meetingRefreshTrigger.value
  return selectedDate.value ? getMeetingTodos(selectedDate.value) : []
})

const totalTasks = computed(
  () => leadsToContact.value.length + mergedFollowups.value.length + meetingTodos.value.length,
)
const hasContent = computed(() => totalTasks.value > 0)

function handleRemoveMeetingTodo(index: number) {
  const date = selectedDate.value
  if (date) removeMeetingTodo(date, index)
}

async function loadData() {
  const wasInvalidated = leadsInvalidatedAt.value > 0
  if (wasInvalidated) {
    clearListsForRescore(selectedDate.value)
  }
  loading.value = true
  const cacheBust = leadsInvalidatedAt.value || Date.now()
  try {
    const date = selectedDate.value
    const [dailyRes, leadsRes, followupsRes] = await Promise.all([
      fetchDaily(date),
      $fetch<LeadsResponse>('/api/leads', {
        query: { sort: 'priority_score', order: 'desc', limit: 300, _t: cacheBust },
      }).catch(() => ({ leads: [], items: [] })),
      $fetch<LeadsResponse>('/api/leads', {
        query: {
          sort: 'priority_score',
          order: 'desc',
          limit: 500,
          offset: 300,
          _t: cacheBust,
        },
      }).catch(() => ({ leads: [], items: [] })),
    ])
    brief.value = dailyRes.data ?? null
    const raw = leadsRes?.leads ?? leadsRes?.items ?? []
    allLeads.value = Array.isArray(raw) ? raw : []
    followupLeads.value = Array.isArray(followupsRes?.leads ?? followupsRes?.items)
      ? (followupsRes.leads ?? followupsRes.items ?? [])
      : []
    if (wasInvalidated) {
      leadsInvalidatedAt.value = 0
    }
  } finally {
    loading.value = false
  }
}

async function handleMarkMessaged(lead: Lead) {
  const date = selectedDate.value || ''
  if (!date) return
  actionLoadingKey.value = lead.lead_key
  try {
    const { error } = await markAsMessaged(lead.lead_key)
    if (!error) {
      markContacted(date, lead.lead_key)
    }
  } finally {
    actionLoadingKey.value = null
  }
}

function copyToClipboard(text: string) {
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    useToast().add({ title: 'Copié', description: 'Texte copié dans le presse-papier', color: 'success' })
  })
}

watch(leadsInvalidatedAt, () => loadData())
onMounted(() => loadData())
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
          <UIcon name="i-lucide-sunrise" class="h-5 w-5" />
        </div>
        <div>
          <h2 class="text-base font-semibold text-slate-800">
            Brief du jour
          </h2>
          <p class="text-xs text-slate-500">
            {{ dateLabel }} — {{ totalTasks }} action{{ totalTasks > 1 ? 's' : '' }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div
          v-if="hasAnyEnVersion"
          class="flex rounded-md overflow-hidden border border-slate-200 dark:border-slate-700"
          role="group"
          aria-label="Langue des messages"
        >
          <UButton
            size="xs"
            variant="ghost"
            :color="messageLang === 'fr' ? 'primary' : 'neutral'"
            :class="messageLang === 'fr' ? 'bg-slate-100 dark:bg-slate-800' : ''"
            @click="messageLang = 'fr'"
          >
            FR
          </UButton>
          <UButton
            size="xs"
            variant="ghost"
            :color="messageLang === 'en' ? 'primary' : 'neutral'"
            :class="messageLang === 'en' ? 'bg-slate-100 dark:bg-slate-800' : ''"
            @click="messageLang = 'en'"
          >
            EN
          </UButton>
        </div>
        <NuxtLink
          to="/daily"
          class="text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline"
        >
          Voir le brief complet →
        </NuxtLink>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-circle" class="h-6 w-6 animate-spin text-slate-400" />
    </div>

    <div v-else-if="hasContent" class="space-y-4">
      <!-- Section Prospection (leads) -->
      <div
        v-if="leadsToContact.length || mergedFollowups.length"
        class="space-y-1"
      >
        <div class="flex items-center gap-2 mb-2 pb-1.5 border-b border-orange-200/60 dark:border-orange-800/40">
          <div class="flex h-6 w-6 items-center justify-center rounded-md bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400">
            <UIcon name="i-lucide-users" class="size-3.5" />
          </div>
          <span class="text-xs font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-300">
            Prospection
          </span>
          <UBadge variant="subtle" color="orange" size="xs">
            {{ leadsToContact.length + mergedFollowups.length }}
          </UBadge>
        </div>
        <!-- À contacter -->
        <div
          v-for="item in leadsToContact"
          :key="'contact-' + item.lead_key"
          class="group flex items-center gap-3 rounded-lg py-2 px-3 -mx-3 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-colors"
        >
          <UCheckbox
            :model-value="false"
            color="orange"
            size="sm"
            :disabled="actionLoadingKey === item.lead_key"
            @update:model-value="() => handleMarkMessaged(item)"
          />
          <div class="flex-1 min-w-0">
            <NuxtLink
              :to="`/leads/${item.lead_key}`"
              class="font-medium text-slate-800 dark:text-slate-200 hover:text-orange-600 dark:hover:text-orange-400 hover:underline truncate block"
            >
              {{ item.contact_name || item.name || item.company || item.lead_key }}
            </NuxtLink>
            <p v-if="item.company && (item.contact_name || item.name)" class="text-xs text-slate-500 truncate">
              {{ item.company }}
            </p>
          </div>
          <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              v-if="linkedinHref(item)"
              :href="linkedinHref(item)"
              target="_blank"
              rel="noopener noreferrer"
              title="Profil LinkedIn"
              class="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
            >
              <UIcon name="i-simple-icons-linkedin" class="size-4 shrink-0" />
            </a>
            <UButton
              v-if="getOutreach(item)"
              size="xs"
              variant="ghost"
              icon="i-lucide-copy"
              class="h-7 w-7"
              @click.stop="copyToClipboard(getOutreach(item) || '')"
            />
            <UButton
              size="xs"
              color="orange"
              variant="soft"
              :loading="actionLoadingKey === item.lead_key"
              class="h-7"
              @click="handleMarkMessaged(item)"
            >
              Marquer messagé
            </UButton>
          </div>
        </div>
        <!-- Relances prévues -->
        <div
          v-for="item in mergedFollowups"
          :key="'followup-' + item.lead_key"
          class="group flex items-center gap-3 rounded-lg py-2 px-3 -mx-3 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-colors"
        >
          <UIcon name="i-lucide-rotate-ccw" class="h-4 w-4 text-orange-500 dark:text-orange-400 shrink-0" />
          <div class="flex-1 min-w-0">
            <NuxtLink
              :to="`/leads/${item.lead_key}`"
              class="font-medium text-slate-800 dark:text-slate-200 hover:text-orange-600 dark:hover:text-orange-400 hover:underline truncate block"
            >
              {{ item.contact_name || item.name || item.company || item.lead_key }}
            </NuxtLink>
            <p
              v-if="getFollowupMessage(item, (item as any).followup_type)"
              class="text-xs text-slate-500 line-clamp-2"
            >
              {{ getFollowupMessage(item, (item as any).followup_type) }}
            </p>
          </div>
          <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              v-if="linkedinHref(item)"
              :href="linkedinHref(item)"
              target="_blank"
              rel="noopener noreferrer"
              title="Profil LinkedIn"
              class="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
            >
              <UIcon name="i-simple-icons-linkedin" class="size-4 shrink-0" />
            </a>
            <UButton
              v-if="getFollowupMessage(item, (item as any).followup_type)"
              size="xs"
              variant="ghost"
              icon="i-lucide-copy"
              class="h-7 w-7"
              @click.stop="copyToClipboard(getFollowupMessage(item, (item as any).followup_type))"
            />
          </div>
        </div>
      </div>

      <!-- Section Réunions (meeting todos) -->
      <div
        v-if="meetingTodos.length"
        class="rounded-lg border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 space-y-1"
      >
        <div class="flex items-center gap-2 mb-2 pb-1.5 border-b border-emerald-200/60 dark:border-emerald-700/40">
          <div class="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
            <UIcon name="i-lucide-mic" class="size-3.5" />
          </div>
          <span class="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Réunions
          </span>
          <UBadge variant="subtle" color="success" size="xs">
            {{ meetingTodos.length }}
          </UBadge>
          <NuxtLink
            to="/meeting"
            class="ml-auto text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Meeting Scribe →
          </NuxtLink>
        </div>
        <div
          v-for="(item, idx) in meetingTodos"
          :key="'meeting-' + idx"
          class="group flex items-center gap-3 rounded-md py-2 px-3 -mx-3 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-colors"
        >
          <UCheckbox
            :model-value="false"
            color="success"
            size="sm"
            @update:model-value="() => handleRemoveMeetingTodo(idx)"
          />
          <span class="flex-1 font-medium text-slate-800 dark:text-slate-200 truncate block">
            {{ item }}
          </span>
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-x"
            color="neutral"
            class="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            @click="handleRemoveMeetingTodo(idx)"
          />
        </div>
      </div>
    </div>

    <div v-else class="py-6 text-center">
      <p class="text-sm text-slate-500">
        Aucune action prévue pour aujourd'hui
      </p>
      <NuxtLink
        to="/leads"
        class="mt-2 inline-block text-xs text-orange-600 hover:underline"
      >
        Gérer les leads →
      </NuxtLink>
    </div>
  </div>
</template>
