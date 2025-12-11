<script setup lang="ts">
import { useAsyncData } from '#app'
import { useIntervalFn } from '@vueuse/core'
import { computed } from 'vue'

definePageMeta({
  ssr: false,
})

const {
  data: metrics,
  refresh: refreshMetrics,
  pending: pendingMetrics,
} = useAsyncData('ariane-metrics', () => $fetch('/api/ariane/metrics'), {
  server: false,
})

const {
  data: logs,
  refresh: refreshLogs,
  pending: pendingLogs,
} = useAsyncData('ariane-logs', () => $fetch('/api/ariane/logs?limit=30'), {
  server: false,
})

// refresh auto toutes les 10s
useIntervalFn(() => {
  refreshMetrics()
  refreshLogs()
}, 10000)

const uptime = computed(() => {
  if (!metrics.value) return '—'
  const s = metrics.value.uptime_seconds ?? 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
})

const services = computed(() => {
  if (!metrics.value?.agents) return []
  return Object.entries(metrics.value.agents).map(([name, data]: any) => ({
    name,
    ...data,
  }))
})

const globalStatus = computed(() => {
  if (!services.value.length) return 'unknown'
  const hasErrors = services.value.some(
    (s: any) => (s.error_count ?? s.errorCount ?? 0) > 0,
  )
  return hasErrors ? 'degraded' : 'ok'
})

function serviceStatusColor(svc: any) {
  const errors = svc.error_count ?? svc.errorCount ?? 0
  const p95 = svc.p95_ms ?? svc.p95Ms ?? 0

  if (errors > 0) return 'bg-rose-100 text-rose-700 border-rose-200'
  if (p95 > 8000) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-emerald-100 text-emerald-700 border-emerald-200'
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8 space-y-8">
    <header class="space-y-3">
      <h1 class="text-3xl font-semibold tracking-tight">
        Ariane Core – Observabilité
      </h1>
      <p class="text-sm text-slate-500">
        Vue temps réel de la santé d’Ariane Core (Dell) : uptime, temps de
        réponse et logs récents.
      </p>
    </header>

    <!-- Global status -->
    <section
      class="grid gap-4 sm:grid-cols-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
    >
      <div class="space-y-1">
        <p class="text-xs font-semibold text-slate-500 uppercase">
          Statut global
        </p>
        <p class="text-sm font-medium">
          <span
            v-if="globalStatus === 'ok'"
            class="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700 border border-emerald-200"
          >
            <span class="h-2 w-2 rounded-full bg-emerald-500" />
            OK
          </span>
          <span
            v-else-if="globalStatus === 'degraded'"
            class="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700 border border-amber-200"
          >
            <span class="h-2 w-2 rounded-full bg-amber-500" />
            Dégradé
          </span>
          <span
            v-else
            class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 border border-slate-200"
          >
            <span class="h-2 w-2 rounded-full bg-slate-400" />
            Inconnu
          </span>
        </p>
      </div>

      <div class="space-y-1">
        <p class="text-xs font-semibold text-slate-500 uppercase">
          Uptime
        </p>
        <p class="text-sm font-mono text-slate-800">
          {{ uptime }}
        </p>
      </div>

      <div class="space-y-1">
        <p class="text-xs font-semibold text-slate-500 uppercase">
          Agents monitorés
        </p>
        <p class="text-sm text-slate-800">
          {{ services.length || '—' }}
        </p>
      </div>
    </section>

    <!-- Services cards -->
    <section class="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-slate-800">
          SLA et performances par agent
        </h2>
        <span class="text-xs text-slate-400">
          Dernière mise à jour :
          <span v-if="pendingMetrics">chargement...</span>
          <span v-else>OK</span>
        </span>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <article
          v-for="svc in services"
          :key="svc.name"
          class="space-y-2 rounded-xl border p-4 bg-white shadow-sm"
          :class="serviceStatusColor(svc)"
        >
          <header class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">
              {{ svc.name }}
            </h3>
            <span class="text-[10px] uppercase tracking-wide">
              {{ svc.count ?? svc.request_count ?? 0 }} appels
            </span>
          </header>

          <dl class="grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <dt class="text-slate-600">Temps moyen</dt>
              <dd class="font-mono">
                {{ svc.avg_ms ?? svc.avgMs ?? 0 }} ms
              </dd>
            </div>
            <div>
              <dt class="text-slate-600">p95</dt>
              <dd class="font-mono">
                {{ svc.p95_ms ?? svc.p95Ms ?? 0 }} ms
              </dd>
            </div>
            <div>
              <dt class="text-slate-600">Erreurs</dt>
              <dd class="font-mono">
                {{ svc.error_count ?? svc.errorCount ?? 0 }}
              </dd>
            </div>
          </dl>
        </article>
      </div>
    </section>

    <!-- Logs -->
    <section class="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-slate-800">
          Logs récents
        </h2>
        <button
          class="text-xs text-slate-500 hover:text-slate-700"
          @click="() => { refreshMetrics(); refreshLogs(); }"
        >
          Rafraîchir
        </button>
      </div>

      <div
        class="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-slate-100 text-[11px]"
      >
        <div class="max-h-72 overflow-auto font-mono">
          <div
            v-if="pendingLogs"
            class="p-3 text-slate-400"
          >
            Chargement des logs...
          </div>

          <div
            v-else-if="!logs?.items?.length"
            class="p-3 text-slate-400"
          >
            Aucun log pour le moment.
          </div>

          <div
            v-else
            v-for="(log, idx) in logs.items"
            :key="idx"
            class="border-b border-slate-800/60 px-3 py-1.5 flex gap-2"
          >
            <span class="text-slate-500 shrink-0 w-[130px]">
              {{ log.ts || log.timestamp || '—' }}
            </span>
            <span class="shrink-0 w-[80px]">
              <span
                v-if="log.success === false"
                class="inline-flex items-center rounded px-1.5 py-0.5 bg-rose-600/30 text-rose-200"
              >
                ERR
              </span>
              <span
                v-else
                class="inline-flex items-center rounded px-1.5 py-0.5 bg-slate-600/40 text-slate-100"
              >
                INFO
              </span>
            </span>
            <span class="shrink-0 w-[90px] text-sky-300">
              {{ log.agent || log.service || 'core' }}
            </span>
            <span class="flex-1">
              {{ log.message || log.errorMessage || '' }}
              <span
                v-if="log.meta"
                class="text-slate-400"
              >
                · {{ JSON.stringify(log.meta) }}
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
