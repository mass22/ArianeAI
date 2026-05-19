<script setup lang="ts">
import LeadFilters from '~/components/leads/LeadFilters.vue'
import LeadTable from '~/components/leads/LeadTable.vue'
import LeadsImportModal from '~/components/leads/import/LeadsImportModal.vue'
import type { LeadsQuery } from '~/composables/useArianeApi'
import { PROSPECTION_KPI_TARGETS } from '~/config/prospection-kpi'
import { currentMonthProgress, isInCurrentMonth, isInCurrentWeek } from '~/lib/dateUtils'
import type { Lead } from '~/types/leads'

definePageMeta({ ssr: false })

type KpiState = 'red' | 'orange' | 'green'

function kpiStateWeekly(value: number, target: number): KpiState {
  if (target <= 0) return value >= 0 ? 'green' : 'red'
  const ratio = value / target
  if (ratio < 0.4) return 'red'
  if (ratio < 0.8) return 'orange'
  return 'green'
}

function kpiStateMonthlyProposals(actual: number, target: number): KpiState {
  if (target <= 0) return actual >= 0 ? 'green' : 'red'
  const { dayOfMonth, daysInMonth } = currentMonthProgress()
  const monthProgress = dayOfMonth / daysInMonth
  const expectedNow = target * monthProgress
  const ratio = expectedNow <= 0 ? (actual >= target ? 1 : 0) : actual / expectedNow
  if (ratio < 0.25) return 'red'
  if (ratio < 0.75) return 'orange'
  return 'green'
}

function kpiStateMinActive(actual: number, target: number): KpiState {
  return actual >= target ? 'green' : 'red'
}

const INDICATORS: Record<KpiState, string> = { red: '🔴', orange: '🟡', green: '🟢' }

const PAGE_SIZE = 50
/** L'API Ariane ne supporte pas offset — on charge tout et on pagine côté client */
const FETCH_LIMIT = 10000

const { fetchLeads, patchLead, markAsMessaged, markJ4Sent, markJ10Sent, rescoreLeads } = useArianeApi()
const importModalOpen = ref(false)

const allLeads = ref<Lead[]>([])
const loading = ref(false)
const currentPage = ref(1)
const actionLoadingKey = ref<string | null>(null)
const rescoring = ref(false)
const uiFilters = reactive({ showInactive: false })
const filters = ref<LeadsQuery>({
  sort: 'priority_score',
  order: 'desc',
})

/** Leads inactifs : won, lost (pipeline terminal) ou status inactive */
const INACTIVE_STAGES = ['won', 'lost']
const INACTIVE_STATUS = 'inactive'

function isInactiveLead(lead: Lead): boolean {
  const stage = String(lead.pipeline_stage ?? lead.status ?? '').toLowerCase()
  const status = String(lead.status ?? '').toLowerCase()
  return INACTIVE_STAGES.includes(stage) || status === INACTIVE_STATUS
}

/** Filtre par recherche nom (contact_name, name, company) — côté client */
function filterBySearch(list: Lead[]): Lead[] {
  const q = filters.value.search?.trim().toLowerCase()
  if (!q) return list
  return list.filter((l) => {
    const name = (l.contact_name ?? l.name ?? '').toLowerCase()
    const company = (l.company ?? '').toLowerCase()
    return name.includes(q) || company.includes(q)
  })
}

/** Tri côté client — l'API peut ignorer sort/order */
function sortLeads(list: Lead[]): Lead[] {
  const { sort, order } = filters.value
  const desc = order === 'desc'
  return [...list].sort((a, b) => {
    const ra = a as Record<string, unknown>
    const rb = b as Record<string, unknown>
    let va: unknown = ra[sort ?? 'priority_score']
    let vb: unknown = rb[sort ?? 'priority_score']
    if (va === vb) return 0
    if (va == null) return desc ? -1 : 1
    if (vb == null) return desc ? 1 : -1
    if (typeof va === 'number' && typeof vb === 'number') {
      return desc ? vb - va : va - vb
    }
    if (typeof va === 'string' && typeof vb === 'string') {
      const cmp = va.localeCompare(vb)
      return desc ? -cmp : cmp
    }
    const sa = String(va)
    const sb = String(vb)
    const cmp = sa.localeCompare(sb)
    return desc ? -cmp : cmp
  })
}

const leads = computed(() => {
  let list = filterBySearch(allLeads.value)
  if (!uiFilters.showInactive) {
    list = list.filter((l) => !isInactiveLead(l))
  }
  const sorted = sortLeads(list)
  const start = (currentPage.value - 1) * PAGE_SIZE
  return sorted.slice(start, start + PAGE_SIZE)
})

const totalLeads = computed(() => {
  let list = filterBySearch(allLeads.value)
  if (!uiFilters.showInactive) list = list.filter((l) => !isInactiveLead(l))
  return list.length
})
const totalPages = computed(() => Math.ceil(totalLeads.value / PAGE_SIZE) || 1)
const hasNextPage = computed(() => currentPage.value < totalPages.value)

// KPI : données brutes pour les compteurs (fetch sans filtre)
const kpiLeads = ref<Lead[]>([])
const kpiLoading = ref(false)

const ACTIVE_STAGES = ['messaged', 'replied', 'scheduled', 'proposal'] as const

const kpis = computed(() => {
  const list = kpiLeads.value
  const lastTouch = (l: Lead) => (l as Record<string, unknown>).last_action_at ?? l.last_touch_at
  const stage = (l: Lead) => l.pipeline_stage ?? l.status ?? ''
  const targets = PROSPECTION_KPI_TARGETS

  const weeklyMessages = list.filter((l) => stage(l) === 'messaged' && isInCurrentWeek(lastTouch(l))).length
  const weeklyCalls = list.filter((l) => (stage(l) === 'scheduled' || stage(l) === 'call') && isInCurrentWeek(lastTouch(l))).length
  const monthlyProposals = list.filter((l) => stage(l) === 'proposal' && isInCurrentMonth(lastTouch(l))).length
  const minActivePipeline = list.filter((l) => ACTIVE_STAGES.includes(stage(l) as typeof ACTIVE_STAGES[number])).length

  return {
    weeklyMessages: { value: weeklyMessages, target: targets.weeklyMessages, state: kpiStateWeekly(weeklyMessages, targets.weeklyMessages) },
    weeklyCalls: { value: weeklyCalls, target: targets.weeklyCalls, state: kpiStateWeekly(weeklyCalls, targets.weeklyCalls) },
    monthlyProposals: { value: monthlyProposals, target: targets.monthlyProposals, state: kpiStateMonthlyProposals(monthlyProposals, targets.monthlyProposals) },
    minActivePipeline: { value: minActivePipeline, target: targets.minActivePipeline, state: kpiStateMinActive(minActivePipeline, targets.minActivePipeline) },
  }
})

async function loadKpis() {
  kpiLoading.value = true
  try {
    const { data } = await fetchLeads({ sort: 'priority_score', order: 'desc', limit: 1000 })
    kpiLeads.value = data?.leads ?? data?.items ?? []
  } finally {
    kpiLoading.value = false
  }
}

async function loadLeads(resetPage = true) {
  loading.value = true
  try {
    const query: LeadsQuery = {
      ...filters.value,
      limit: FETCH_LIMIT,
    }
    const { data } = await fetchLeads(query)
    const items = data?.leads ?? data?.items ?? []
    allLeads.value = items
    if (resetPage) currentPage.value = 1
  } finally {
    loading.value = false
  }
}

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
}

async function handleStatusChange(lead: Lead, status: string) {
  actionLoadingKey.value = lead.lead_key
  try {
    const { error } = await patchLead(lead.lead_key, { status })
    if (!error) {
      await loadLeads()
      await loadKpis()
    }
  } finally {
    actionLoadingKey.value = null
  }
}

async function handlePipelineChange(lead: Lead, stage: string) {
  actionLoadingKey.value = lead.lead_key
  try {
    const { error } = await patchLead(lead.lead_key, { pipeline_stage: stage })
    if (!error) {
      await loadLeads()
      await loadKpis()
    }
  } finally {
    actionLoadingKey.value = null
  }
}

async function handleMarkMessaged(lead: Lead) {
  actionLoadingKey.value = lead.lead_key
  try {
    const { error } = await markAsMessaged(lead.lead_key)
    if (!error) {
      await loadLeads()
      await loadKpis()
    }
  } finally {
    actionLoadingKey.value = null
  }
}

async function handleMarkJ4Sent(lead: Lead) {
  actionLoadingKey.value = lead.lead_key
  try {
    const { error } = await markJ4Sent(lead.lead_key)
    if (!error) {
      await loadLeads()
      await loadKpis()
    }
  } finally {
    actionLoadingKey.value = null
  }
}

async function handleMarkJ10Sent(lead: Lead) {
  actionLoadingKey.value = lead.lead_key
  try {
    const { error } = await markJ10Sent(lead.lead_key)
    if (!error) {
      await loadLeads()
      await loadKpis()
    }
  } finally {
    actionLoadingKey.value = null
  }
}

function onImportSuccess() {
  loadLeads(true)
  loadKpis()
}

async function handleRescore() {
  rescoring.value = true
  try {
    const { error } = await rescoreLeads()
    if (!error) {
      await loadLeads(true)
      await loadKpis()
    }
  } finally {
    rescoring.value = false
  }
}

watch(
  () => ({
    type: filters.value.type,
    status: filters.value.status,
    pipeline_stage: filters.value.pipeline_stage,
    minScore: filters.value.minScore,
    sort: filters.value.sort,
    order: filters.value.order,
  }),
  () => loadLeads(true),
  { deep: true },
)

watch(() => filters.value.search, () => { currentPage.value = 1 })
watch(() => uiFilters.showInactive, () => { currentPage.value = 1 })

onMounted(() => {
  loadLeads(true)
  loadKpis()
})
</script>

<template>
  <div class="min-h-screen bg-default">
    <div class="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight">
            Leads
          </h1>
          <p class="text-sm text-muted mt-1">
            Gérez vos leads et leur pipeline —
            <NuxtLink to="/daily" class="text-primary hover:underline">Brief du jour</NuxtLink>
          </p>
        </div>
        <div class="flex gap-2">
          <UButton
            variant="outline"
            icon="i-lucide-calculator"
            :loading="rescoring"
            :disabled="rescoring"
            @click="handleRescore"
          >
            Recalculer le scoring
          </UButton>
          <LeadsImportModal v-model:open="importModalOpen" @success="onImportSuccess">
            <UButton
              icon="i-lucide-upload"
            >
              Import
            </UButton>
          </LeadsImportModal>
          <UButton
            to="/daily"
            variant="outline"
            icon="i-lucide-calendar"
          >
            Brief du jour
          </UButton>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <UCard class="overflow-hidden">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="text-sm text-muted">Messages / semaine</div>
              <div class="text-2xl font-semibold mt-1 tabular-nums">
                {{ kpiLoading ? '—' : `${kpis.weeklyMessages.value} / ${kpis.weeklyMessages.target}` }}
              </div>
            </div>
            <span class="text-lg shrink-0" :title="kpis.weeklyMessages.state">{{ kpiLoading ? '' : INDICATORS[kpis.weeklyMessages.state] }}</span>
          </div>
        </UCard>
        <UCard class="overflow-hidden">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="text-sm text-muted">Calls / semaine</div>
              <div class="text-2xl font-semibold mt-1 tabular-nums">
                {{ kpiLoading ? '—' : `${kpis.weeklyCalls.value} / ${kpis.weeklyCalls.target}` }}
              </div>
            </div>
            <span class="text-lg shrink-0" :title="kpis.weeklyCalls.state">{{ kpiLoading ? '' : INDICATORS[kpis.weeklyCalls.state] }}</span>
          </div>
        </UCard>
        <UCard class="overflow-hidden">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="text-sm text-muted">Propositions / mois</div>
              <div class="text-2xl font-semibold mt-1 tabular-nums">
                {{ kpiLoading ? '—' : `${kpis.monthlyProposals.value} / ${kpis.monthlyProposals.target}` }}
              </div>
            </div>
            <span class="text-lg shrink-0" :title="kpis.monthlyProposals.state">{{ kpiLoading ? '' : INDICATORS[kpis.monthlyProposals.state] }}</span>
          </div>
        </UCard>
        <UCard class="overflow-hidden">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="text-sm text-muted">Pipeline actif (min)</div>
              <div class="text-2xl font-semibold mt-1 tabular-nums">
                {{ kpiLoading ? '—' : `${kpis.minActivePipeline.value} / ${kpis.minActivePipeline.target}` }}
              </div>
            </div>
            <span class="text-lg shrink-0" :title="kpis.minActivePipeline.state">{{ kpiLoading ? '' : INDICATORS[kpis.minActivePipeline.state] }}</span>
          </div>
        </UCard>
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <LeadFilters v-model="filters" />
        <UCheckbox
          v-model="uiFilters.showInactive"
          label="Afficher les leads inactifs (gagnés / perdus)"
        />
      </div>

      <LeadTable
        :leads="leads"
        :loading="loading"
        :action-loading-key="actionLoadingKey"
        @status-change="handleStatusChange"
        @pipeline-change="handlePipelineChange"
        @mark-messaged="handleMarkMessaged"
        @mark-j4-sent="handleMarkJ4Sent"
        @mark-j10-sent="handleMarkJ10Sent"
      />

      <!-- Pagination (côté client — l'API ne supporte pas offset) -->
      <div
        v-if="totalLeads > 0 || loading"
        class="flex items-center justify-between gap-4 py-4"
      >
        <p class="text-sm text-muted">
          <span v-if="loading">Chargement…</span>
          <template v-else>
            {{ (currentPage - 1) * PAGE_SIZE + 1 }}-{{ Math.min(currentPage * PAGE_SIZE, totalLeads) }} sur {{ totalLeads }}
            lead{{ totalLeads > 1 ? 's' : '' }}
          </template>
        </p>
        <div class="flex items-center gap-2">
          <UButton
            variant="outline"
            size="sm"
            icon="i-lucide-chevron-left"
            :disabled="currentPage <= 1 || loading"
            @click="goToPage(currentPage - 1)"
          >
            Précédent
          </UButton>
          <UButton
            variant="outline"
            size="sm"
            trailing-icon="i-lucide-chevron-right"
            :disabled="!hasNextPage || loading"
            @click="goToPage(currentPage + 1)"
          >
            Suivant
          </UButton>
          <UIcon
            v-if="loading"
            name="i-lucide-loader-2"
            class="size-4 animate-spin text-muted"
          />
        </div>
      </div>
    </div>
  </div>
</template>
