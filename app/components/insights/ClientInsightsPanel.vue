<script setup lang="ts">
import type { InsightsResponse } from '~/types/insights'

const props = defineProps<{
  clientId?: string | null
}>()

const { fetchInsights, loading, error, insights } = useInsights()

const aggregated = computed(() => insights.value?.aggregated ?? null)
const topTopics = computed(() => insights.value?.top_topics ?? [])
const recurringRisks = computed(() => insights.value?.recurring_risks ?? [])
const recurringDecisions = computed(() => insights.value?.recurring_decisions ?? [])
const activityTrend = computed(() => {
  const t = insights.value?.activity_trend
  if (!t || typeof t !== 'object') return null
  const o = t as Record<string, unknown>
  return {
    meetings_last_7d: o.meetings_last_7d ?? o.meetingsLast7d ?? null,
    meetings_last_30d: o.meetings_last_30d ?? o.meetingsLast30d ?? null,
    summary: o.summary ?? null,
  }
})

function loadInsights() {
  const id = props.clientId ?? undefined
  if (!id) return
  fetchInsights(id)
}

watch(
  () => props.clientId,
  (newId) => {
    if (newId) loadInsights()
  },
  { immediate: true },
)
</script>

<template>
  <div class="space-y-6">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-muted" />
    </div>

    <!-- Error -->
    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      :title="error"
      icon="i-lucide-alert-circle"
    />

    <!-- Content -->
    <template v-else-if="insights">
      <!-- A) Overview cards -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UCard variant="subtle">
          <div class="flex items-center gap-3">
            <div class="rounded-lg bg-primary/10 p-2">
              <UIcon name="i-lucide-calendar" class="size-5 text-primary" />
            </div>
            <div>
              <p class="text-xs font-medium text-muted uppercase">
                Réunions
              </p>
              <p class="text-2xl font-semibold">
                {{ aggregated?.total_meetings ?? 0 }}
              </p>
            </div>
          </div>
        </UCard>
        <UCard variant="subtle">
          <div class="flex items-center gap-3">
            <div class="rounded-lg bg-emerald-500/10 p-2">
              <UIcon name="i-lucide-check-square" class="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p class="text-xs font-medium text-muted uppercase">
                Décisions
              </p>
              <p class="text-2xl font-semibold">
                {{ aggregated?.decisions_count ?? 0 }}
              </p>
            </div>
          </div>
        </UCard>
        <UCard variant="subtle">
          <div class="flex items-center gap-3">
            <div class="rounded-lg bg-amber-500/10 p-2">
              <UIcon name="i-lucide-list-todo" class="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p class="text-xs font-medium text-muted uppercase">
                Actions
              </p>
              <p class="text-2xl font-semibold">
                {{ aggregated?.action_items_count ?? 0 }}
              </p>
            </div>
          </div>
        </UCard>
        <UCard variant="subtle">
          <div class="flex items-center gap-3">
            <div class="rounded-lg bg-blue-500/10 p-2">
              <UIcon name="i-lucide-clock" class="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p class="text-xs font-medium text-muted uppercase">
                Dernière réunion
              </p>
              <p class="text-sm font-medium">
                {{ aggregated?.last_meeting_date
                  ? new Date(aggregated.last_meeting_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'
                }}
              </p>
            </div>
          </div>
        </UCard>
      </div>

      <!-- B) Top Topics -->
      <UCard variant="subtle">
        <template #header>
          <h3 class="font-semibold">
            Sujets récurrents
          </h3>
        </template>
        <ul v-if="topTopics.length" class="space-y-2">
          <li
            v-for="(item, idx) in topTopics"
            :key="idx"
            class="flex items-center gap-2 text-sm"
          >
            <UBadge variant="subtle" color="neutral" size="xs">
              {{ item.count ?? 1 }}
            </UBadge>
            <span>{{ item.topic }}</span>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">
          Aucun sujet enregistré
        </p>
      </UCard>

      <!-- C) Recurring Risks -->
      <UCard variant="subtle">
        <template #header>
          <h3 class="font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-alert-triangle" class="size-4 text-amber-500" />
            Risques récurrents
          </h3>
        </template>
        <ul v-if="recurringRisks.length" class="space-y-2">
          <li
            v-for="(item, idx) in recurringRisks"
            :key="idx"
            class="flex items-center gap-2 text-sm"
          >
            <UBadge v-if="item.occurrences" variant="subtle" color="error" size="xs">
              {{ item.occurrences }}
            </UBadge>
            <span>{{ item.risk }}</span>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">
          Aucun risque identifié
        </p>
      </UCard>

      <!-- D) Recurring Decisions -->
      <UCard variant="subtle">
        <template #header>
          <h3 class="font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-gavel" class="size-4 text-emerald-500" />
            Décisions récurrentes
          </h3>
        </template>
        <ul v-if="recurringDecisions.length" class="space-y-2">
          <li
            v-for="(item, idx) in recurringDecisions"
            :key="idx"
            class="flex items-center gap-2 text-sm"
          >
            <UBadge v-if="item.occurrences" variant="subtle" color="success" size="xs">
              {{ item.occurrences }}
            </UBadge>
            <span>{{ item.decision }}</span>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">
          Aucune décision enregistrée
        </p>
      </UCard>

      <!-- E) Activity Trend -->
      <UCard v-if="activityTrend" variant="subtle">
        <template #header>
          <h3 class="font-semibold">
            Tendance d'activité
          </h3>
        </template>
        <div class="space-y-2 text-sm">
          <p v-if="activityTrend.meetings_last_7d != null">
            Réunions (7 derniers jours) : <strong>{{ activityTrend.meetings_last_7d }}</strong>
          </p>
          <p v-if="activityTrend.meetings_last_30d != null">
            Réunions (30 derniers jours) : <strong>{{ activityTrend.meetings_last_30d }}</strong>
          </p>
          <p v-if="activityTrend.summary" class="text-muted">
            {{ activityTrend.summary }}
          </p>
        </div>
      </UCard>
    </template>

    <!-- Empty -->
    <UEmpty
      v-else-if="!loading && !error"
      icon="i-lucide-bar-chart-3"
      :title="props.clientId ? 'Aucun insight' : 'Client requis'"
      :description="props.clientId ? 'Aucune donnée disponible. Importez des réunions depuis la page Meeting pour alimenter les insights.' : 'Sélectionnez un client pour afficher ses insights.'"
    />
  </div>
</template>
