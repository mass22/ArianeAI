<script setup lang="ts">
import { useAsyncData } from '#app'
import { useIntervalFn } from '@vueuse/core'
import { computed } from 'vue'

definePageMeta({
  ssr: false,
})

interface MetricsData {
  uptime_seconds?: number
  agents?: Record<string, {
    count?: number
    request_count?: number
    avg_duration_ms?: number
    avg_ms?: number
    avgMs?: number
    avg?: number
    p95_duration_ms?: number
    p95_ms?: number
    p95Ms?: number
    p95?: number
    error_count?: number
    errorCount?: number
    errors?: number
    last_error_at?: string | null
    [key: string]: any
  }>
}

interface LogItem {
  ts?: string
  timestamp?: string
  success?: boolean
  agent?: string
  service?: string
  message?: string
  errorMessage?: string
  meta?: any
  context?: any
  data?: any
  [key: string]: any
}

interface LogsData {
  items?: LogItem[]
  error?: boolean
  message?: string
}

const {
  data: metrics,
  refresh: refreshMetrics,
  pending: pendingMetrics,
} = useAsyncData<MetricsData>('ariane-metrics', () => $fetch<MetricsData>('/api/ariane/metrics'), {
  server: false,
})

const {
  data: logs,
  refresh: refreshLogs,
  pending: pendingLogs,
} = useAsyncData<LogsData>('ariane-logs', () => $fetch<LogsData>('/api/ariane/logs?limit=30'), {
  server: false,
})

// refresh auto toutes les 10s
useIntervalFn(() => {
  refreshMetrics()
  refreshLogs()
}, 10000)

const uptime = computed(() => {
  if (!metrics.value) return '—'
  const s = (metrics.value as MetricsData).uptime_seconds ?? 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
})

const services = computed(() => {
  const m = metrics.value as MetricsData
  if (!m?.agents) return []

  // Debug: afficher les données brutes dans la console
  if (m.agents) {
    console.log('📊 Métriques brutes reçues:', JSON.stringify(m.agents, null, 2))
  }

  return Object.entries(m.agents).map(([name, data]) => ({
    name,
    ...data,
  }))
})

const globalStatus = computed(() => {
  if (!services.value.length) return 'unknown'
  const hasErrors = services.value.some(
    (s) => (s.error_count ?? s.errorCount ?? s.errors ?? 0) > 0,
  )
  return hasErrors ? 'degraded' : 'ok'
})

function serviceStatusColor(svc: any) {
  const errors = svc.error_count ?? svc.errorCount ?? svc.errors ?? 0
  const p95 = svc.p95_duration_ms ?? svc.p95_ms ?? svc.p95Ms ?? svc.p95 ?? 0

  if (errors > 0) return 'bg-rose-100 text-rose-700 border-rose-200'
  if (p95 > 8000) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-emerald-100 text-emerald-700 border-emerald-200'
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '—'
  try {
    const date = new Date(ts)
    if (isNaN(date.getTime())) return ts

    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
  } catch {
    return ts
  }
}

function getLogData(log: LogItem): string {
  // Priorité: message/errorMessage
  const message = log.message || log.errorMessage || ''

  // Collecter toutes les données supplémentaires
  const extraData: Record<string, any> = {}

  if (log.meta && Object.keys(log.meta).length > 0) {
    extraData.meta = log.meta
  }
  if (log.context && Object.keys(log.context).length > 0) {
    extraData.context = log.context
  }
  if (log.data && Object.keys(log.data).length > 0) {
    extraData.data = log.data
  }

  // Si on a un message, on l'affiche avec les données supplémentaires
  if (message) {
    if (Object.keys(extraData).length > 0) {
      return `${message} · ${JSON.stringify(extraData)}`
    }
    return message
  }

  // Si pas de message mais des données, on affiche les données
  if (Object.keys(extraData).length > 0) {
    return JSON.stringify(extraData)
  }

  // Sinon, on affiche toutes les propriétés sauf celles déjà affichées ailleurs
  const excludedKeys = ['ts', 'timestamp', 'success', 'agent', 'service', 'message', 'errorMessage']
  const otherData: Record<string, any> = {}
  for (const [key, value] of Object.entries(log)) {
    if (!excludedKeys.includes(key) && value !== undefined && value !== null && value !== '') {
      otherData[key] = value
    }
  }

  if (Object.keys(otherData).length > 0) {
    return JSON.stringify(otherData)
  }

  return ''
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

      <!-- Debug: Afficher les données brutes -->
      <details v-if="metrics?.agents" class="mb-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs">
        <summary class="cursor-pointer font-semibold text-amber-800">🐛 Debug: Données brutes des métriques</summary>
        <pre class="mt-2 overflow-auto rounded bg-slate-900 p-3 text-slate-100 font-mono text-[10px]">{{ JSON.stringify(metrics.agents, null, 2) }}</pre>
        <div class="mt-2 space-y-1">
          <p class="font-semibold text-amber-900">Données parsées par agent:</p>
          <div v-for="svc in services" :key="svc.name" class="rounded bg-white p-2">
            <p class="font-mono text-[10px]"><strong>{{ svc.name }}:</strong> {{ JSON.stringify(svc) }}</p>
          </div>
        </div>
      </details>

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
                {{ svc.avg_duration_ms ?? svc.avg_ms ?? svc.avgMs ?? svc.avg ?? 0 }} ms
              </dd>
            </div>
            <div>
              <dt class="text-slate-600">p95</dt>
              <dd class="font-mono">
                {{ svc.p95_duration_ms ?? svc.p95_ms ?? svc.p95Ms ?? svc.p95 ?? 0 }} ms
              </dd>
            </div>
            <div>
              <dt class="text-slate-600">Erreurs</dt>
              <dd class="font-mono">
                {{ svc.error_count ?? svc.errorCount ?? svc.errors ?? 0 }}
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
            v-else-if="!logs || !logs.items || !logs.items.length"
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
              {{ formatTimestamp(log.ts || log.timestamp) }}
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
              {{ getLogData(log) || '—' }}
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
