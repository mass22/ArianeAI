<script setup lang="ts">
import { useAsyncData } from '#app'
import { useIntervalFn } from '@vueuse/core'
import { computed } from 'vue'
import { useClients } from '~/composables/useClients'

definePageMeta({
  ssr: false,
})

interface MetricsData {
  uptime_seconds?: number
  agents?: Record<string, {
    count?: number
    request_count?: number
    avg_duration_ms?: number
    error_count?: number
    [key: string]: any
  }>
}

const { fetchClients } = useClients()

// Charger les clients pour le compteur
const {
  data: clientsData,
  refresh: refreshClients,
} = useAsyncData('home-clients', async () => {
  try {
    const { data } = await fetchClients()
    return data
  } catch {
    return { items: [], total: 0 }
  }
}, {
  server: false,
})

// Charger les métriques
const {
  data: metrics,
  refresh: refreshMetrics,
} = useAsyncData<MetricsData>('home-metrics', () => $fetch<MetricsData>('/api/ariane/metrics'), {
  server: false,
})

// Rafraîchir toutes les 30 secondes
useIntervalFn(() => {
  refreshMetrics()
  refreshClients()
}, 30000)

const clientsCount = computed(() => clientsData.value?.total || 0)

const agentsCount = computed(() => {
  if (!metrics.value?.agents) return 0
  return Object.keys(metrics.value.agents).length
})

const uptime = computed(() => {
  if (!metrics.value) return '—'
  const s = (metrics.value as MetricsData).uptime_seconds ?? 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
})

const systemStatus = computed(() => {
  if (!metrics.value?.agents) return 'unknown'
  const agents = Object.values(metrics.value.agents)
  const hasErrors = agents.some(
    (a) => (a.error_count ?? 0) > 0,
  )
  return hasErrors ? 'degraded' : 'ok'
})

const features = [
  {
    title: 'Clients',
    description: 'Gérez vos clients et leurs dossiers',
    icon: 'i-lucide-users',
    href: '/clients',
    color: 'blue',
  },
  {
    title: 'Leads',
    description: 'Pipeline et gestion des leads',
    icon: 'i-lucide-target',
    href: '/leads',
    color: 'emerald',
  },
  {
    title: 'Brief du jour',
    description: 'Vos actions prioritaires pour aujourd\'hui',
    icon: 'i-lucide-sunrise',
    href: '/daily',
    color: 'orange',
  },
  {
    title: 'Réunions',
    description: 'Importez et transcrivez vos réunions',
    icon: 'i-lucide-video',
    href: '/meeting',
    color: 'green',
  },
  {
    title: 'Observabilité',
    description: 'Surveillez les performances et la santé du système',
    icon: 'i-lucide-bar-chart-3',
    href: '/observability/core',
    color: 'amber',
  },
  {
    title: 'Docs Chat',
    description: 'Chattez avec votre documentation',
    icon: 'i-lucide-message-square',
    href: '/docs-chat',
    color: 'indigo',
  },
  {
    title: 'Documentation',
    description: 'Accédez à la documentation complète',
    icon: 'i-lucide-book-open',
    href: 'http://massimo-ia:4001',
    external: true,
    color: 'slate',
  },
]
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8 space-y-8">
    <!-- Header -->
    <header class="space-y-3">
      <h1 class="text-4xl font-semibold tracking-tight">
        Bienvenue sur Ariane AI
      </h1>
      <p class="text-sm text-slate-500">
        Votre plateforme CRM intelligente avec agents IA pour gérer vos clients, dossiers et réunions.
      </p>
    </header>

    <!-- Brief du jour — todolist -->
    <section>
      <LeadsDailyBriefTodoList />
    </section>

    <div>
    <LLMChat
        placeholder="Posez votre question…"
        empty-state-title="Commencez la conversation"
        empty-state-description="Posez votre première question"
        model="llama3.1:8b"
        system="Tu es un assistant utile et concis. Réponds en français."
        :temperature="0.7"
      />
    </div>

    <!-- Statistiques rapides -->
    <section
      class="grid gap-4 sm:grid-cols-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
    >
      <div class="space-y-1">
        <p class="text-xs font-semibold text-slate-500 uppercase">
          Clients
        </p>
        <p class="text-2xl font-semibold text-slate-800">
          {{ clientsCount }}
        </p>
      </div>

      <div class="space-y-1">
        <p class="text-xs font-semibold text-slate-500 uppercase">
          Agents actifs
        </p>
        <p class="text-2xl font-semibold text-slate-800">
          {{ agentsCount }}
        </p>
      </div>

      <div class="space-y-1">
        <p class="text-xs font-semibold text-slate-500 uppercase">
          Statut système
        </p>
        <p class="text-sm font-medium">
          <span
            v-if="systemStatus === 'ok'"
            class="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700 border border-emerald-200"
          >
            <span class="h-2 w-2 rounded-full bg-emerald-500" />
            Opérationnel
          </span>
          <span
            v-else-if="systemStatus === 'degraded'"
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
    </section>

    <!-- Uptime si disponible -->
    <section
      v-if="metrics && uptime !== '—'"
      class="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
    >
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <p class="text-xs font-semibold text-slate-500 uppercase">
            Uptime
          </p>
          <p class="text-sm font-mono text-slate-800">
            {{ uptime }}
          </p>
        </div>
        <UButton
          variant="ghost"
          size="sm"
          icon="i-lucide-refresh-cw"
          @click="() => { refreshMetrics(); refreshClients(); }"
        >
          Actualiser
        </UButton>
      </div>
    </section>

    <!-- Fonctionnalités principales -->
    <section class="space-y-3">
      <h2 class="text-lg font-semibold text-slate-800">
        Fonctionnalités principales
      </h2>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="feature in features"
          :key="feature.href"
          :to="feature.external ? undefined : feature.href"
          :href="feature.external ? feature.href : undefined"
          :target="feature.external ? '_blank' : undefined"
          class="group relative flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-md"
        >
          <div class="flex items-start justify-between">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-lg"
              :class="{
                'bg-blue-100 text-blue-600': feature.color === 'blue',
                'bg-purple-100 text-purple-600': feature.color === 'purple',
                'bg-green-100 text-green-600': feature.color === 'green',
                'bg-amber-100 text-amber-600': feature.color === 'amber',
                'bg-indigo-100 text-indigo-600': feature.color === 'indigo',
                'bg-slate-100 text-slate-600': feature.color === 'slate',
                'bg-emerald-100 text-emerald-600': feature.color === 'emerald',
                'bg-orange-100 text-orange-600': feature.color === 'orange',
              }"
            >
              <UIcon :name="feature.icon" class="h-5 w-5" />
            </div>
            <UIcon
              v-if="feature.external"
              name="i-lucide-external-link"
              class="h-4 w-4 text-slate-400 group-hover:text-slate-600"
            />
            <UIcon
              v-else
              name="i-lucide-arrow-right"
              class="h-4 w-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-transform"
            />
          </div>
          <div class="space-y-1">
            <h3 class="font-semibold text-slate-800">
              {{ feature.title }}
            </h3>
            <p class="text-sm text-slate-500">
              {{ feature.description }}
            </p>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- Message d'aide -->
    <section
      v-if="clientsCount === 0"
      class="rounded-xl border border-amber-200 bg-amber-50/50 p-4"
    >
      <div class="flex items-start gap-3">
        <UIcon name="i-lucide-lightbulb" class="h-5 w-5 text-amber-600 mt-0.5" />
        <div class="flex-1 space-y-1">
          <p class="text-sm font-medium text-amber-900">
            Commencez par ajouter votre premier client
          </p>
          <p class="text-xs text-amber-700">
            Créez un client pour commencer à gérer vos dossiers et réunions.
          </p>
          <UButton
            to="/clients"
            size="sm"
            color="amber"
            variant="soft"
            class="mt-2"
          >
            Ajouter un client
          </UButton>
        </div>
      </div>
    </section>
  </div>
</template>
