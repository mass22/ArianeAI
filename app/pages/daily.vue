<script setup lang="ts">
import type { DailyBrief, Lead, LeadsResponse } from '~/types/leads'
import DailyBriefComponent from '~/components/leads/DailyBrief.vue'

definePageMeta({ ssr: false })

const { fetchDaily, todayMontreal, leadsInvalidatedAt, rescoreLeads } = useArianeApi()
const { clearListsForRescore } = useDailyTodos()
const rescoring = ref(false)

const brief = ref<DailyBrief | null>(null)
const allLeads = ref<Lead[]>([])
const followupLeads = ref<Lead[]>([])
const loading = ref(true)
const selectedDate = ref(todayMontreal())

async function loadDaily() {
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

async function handleRescore() {
  rescoring.value = true
  try {
    const { error } = await rescoreLeads()
    if (!error) await loadDaily()
  } finally {
    rescoring.value = false
  }
}

watch(selectedDate, () => loadDaily())
watch(leadsInvalidatedAt, () => loadDaily())

onMounted(() => loadDaily())

onActivated(() => loadDaily())
</script>

<template>
  <div class="min-h-screen bg-default">
    <div class="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight">
            Brief du jour
          </h1>
          <p class="text-sm text-muted mt-1">
            Vos priorités parmi vos leads —
            <NuxtLink to="/leads" class="text-primary hover:underline">Voir tous les leads</NuxtLink>
          </p>
        </div>
        <div class="flex items-center gap-3">
          <UInput
            v-model="selectedDate"
            type="date"
            size="sm"
            class="w-40"
          />
          <UButton
            variant="outline"
            size="sm"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            title="Actualiser"
            @click="loadDaily"
          />
          <UButton
            variant="outline"
            size="sm"
            icon="i-lucide-calculator"
            :loading="rescoring"
            :disabled="rescoring"
            title="Recalculer le scoring des leads"
            @click="handleRescore"
          >
            Recalculer scoring
          </UButton>
          <UButton
            to="/leads"
            variant="outline"
            icon="i-lucide-list"
          >
            Voir les leads
          </UButton>
        </div>
      </div>

      <DailyBriefComponent
        :brief="brief"
        :all-leads="allLeads"
        :followup-leads-api="followupLeads"
        :selected-date="selectedDate"
        :loading="loading"
        @refreshed="loadDaily"
      />
    </div>
  </div>
</template>
