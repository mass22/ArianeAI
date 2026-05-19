<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'

definePageMeta({
  ssr: false,
})

interface MetricsData {
  error?: boolean
  message?: string
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
  details?: string
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
} = useAsyncData<LogsData>('ariane-logs', () => $fetch<LogsData>('/api/ariane/logs?limit=100'), {
  server: false,
})

// refresh auto toutes les 10s
useIntervalFn(() => {
  refreshMetrics()
  refreshLogs()
}, 10000)

const metricsError = computed(() => (metrics.value as MetricsData)?.error === true)
const logsError = computed(() => (logs.value as LogsData)?.error === true)
const metricsErrorMessage = computed(() => (metrics.value as MetricsData)?.message ?? '')
const logsErrorMessage = computed(() => (logs.value as LogsData)?.message ?? '')

const uptime = computed(() => {
  if (!metrics.value || metricsError.value) return '—'
  const s = (metrics.value as MetricsData).uptime_seconds ?? 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
})

// Services depuis les métriques (priorité)
const servicesFromMetrics = computed(() => {
  const m = metrics.value as MetricsData
  if (!m?.agents || metricsError.value) return []
  return Object.entries(m.agents).map(([name, data]) => ({
    name,
    ...data,
  }))
})

// Fallback : dériver les stats des logs (endpoint, duration_ms, status dans meta/data)
const servicesFromLogs = computed(() => {
  const items = (logs.value as LogsData)?.items ?? []
  if (logsError.value || !items.length) return []

  const byEndpoint: Record<string, { durations: number[], errors: number }> = {}
  for (const log of items) {
    const src = log.meta ?? log.data ?? log.context ?? log
    const endpoint = src.endpoint ?? src.path ?? log.agent ?? log.service
    if (!endpoint) continue

    const key = typeof endpoint === 'string' ? endpoint : String(endpoint)
    if (!byEndpoint[key]) byEndpoint[key] = { durations: [], errors: 0 }

    const duration = src.duration_ms ?? src.duration ?? 0
    if (typeof duration === 'number' && duration >= 0) byEndpoint[key].durations.push(duration)

    const status = src.status_code ?? src.status ?? 200
    const statusNum = typeof status === 'string' ? parseInt(status, 10) : status
    const isError = log.success === false || (typeof statusNum === 'number' && statusNum >= 400)
    if (isError) byEndpoint[key].errors += 1
  }

  return Object.entries(byEndpoint).map(([name, { durations, errors }]) => {
    const count = durations.length
    const avg = count > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / count)
      : 0
    const sorted = [...durations].sort((a, b) => a - b)
    const p95 = sorted.length > 0
      ? sorted[Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1)]
      : 0
    return {
      name,
      count,
      request_count: count,
      avg_duration_ms: avg,
      avg_ms: avg,
      avg: avg,
      p95_duration_ms: p95,
      p95_ms: p95,
      p95: p95,
      error_count: errors,
      errorCount: errors,
      errors,
    }
  })
})

const services = computed(() =>
  servicesFromMetrics.value.length > 0 ? servicesFromMetrics.value : servicesFromLogs.value,
)
const servicesSource = computed(() =>
  servicesFromMetrics.value.length > 0 ? 'metrics' : 'logs',
)

// Logs filtrés : warning et error uniquement (les infos sont dans le terminal)
const WARN_ERROR_LEVELS = ['warning', 'warn', 'error', 'err']
const filteredLogs = computed(() => {
  const items = (logs.value as LogsData)?.items ?? []
  return items.filter((log) => {
    const level = (log.level ?? log.lvl ?? '').toString().toLowerCase()
    const isError = log.success === false
    return WARN_ERROR_LEVELS.includes(level) || isError
  })
})

const globalStatus = computed(() => {
  if (metricsError.value) return 'error'
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function getLogData(log: LogItem): string {
  // Priorité: message/errorMessage
  const message = log.message || log.errorMessage || ''

  // Collecter toutes les données supplémentaires (sécuriser contre les non-objets)
  const extraData: Record<string, any> = {}

  if (isPlainObject(log.meta) && Object.keys(log.meta).length > 0) {
    extraData.meta = log.meta
  }
  if (isPlainObject(log.context) && Object.keys(log.context).length > 0) {
    extraData.context = log.context
  }
  if (isPlainObject(log.data) && Object.keys(log.data).length > 0) {
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
        Vue temps réel de la santé d'Ariane Core (Dell) : uptime, temps de
        réponse et logs récents.
      </p>
    </header>

    <!-- Bannière d'erreur : Ariane Core inaccessible -->
    <div
      v-if="!pendingMetrics && metricsError"
      class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
    >
      <p class="font-medium">
        Ariane Core inaccessible
      </p>
      <p class="mt-1 text-rose-700">
        {{ metricsErrorMessage }}
      </p>
      <p class="mt-2 text-xs text-rose-600">
        Vérifiez que le serveur Ariane Core est démarré et accessible.
      </p>
    </div>

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
            v-else-if="globalStatus === 'error'"
            class="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-700 border border-rose-200"
          >
            <span class="h-2 w-2 rounded-full bg-rose-500" />
            Erreur
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
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <h2 class="text-sm font-semibold text-slate-800">
          {{ servicesSource === 'logs' ? 'Performances par endpoint (dérivées des logs)' : 'SLA et performances par agent' }}
        </h2>
        <div class="flex items-center gap-2">
          <span
            v-if="servicesSource === 'logs' && services.length > 0"
            class="rounded bg-sky-100 px-2 py-0.5 text-[10px] text-sky-700"
          >
            Données des {{ logs?.items?.length ?? 0 }} derniers logs
          </span>
          <span class="text-xs text-slate-400">
            Dernière mise à jour :
            <span v-if="pendingMetrics">chargement...</span>
            <span v-else>OK</span>
          </span>
        </div>
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
            v-else-if="logsError"
            class="p-3 text-rose-300"
          >
            {{ logsErrorMessage }}
          </div>
          <div
            v-else-if="!filteredLogs.length"
            class="p-3 text-slate-400"
          >
            Aucun warning ni erreur récent.
          </div>

          <div
            v-else
            v-for="(log, idx) in filteredLogs"
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
