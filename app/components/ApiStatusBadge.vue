<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useIntervalFn } from '@vueuse/core'

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error'
  latency_ms: number
}

const status = ref<'ok' | 'degraded' | 'error' | 'loading'>('loading')
const latencyMs = ref<number | null>(null)
const lastCheck = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

async function checkHealth() {
  const start = Date.now()
  try {
    const data = await $fetch<HealthResponse>('/api/health')
    const roundTripMs = Date.now() - start
    status.value = data?.status ?? 'ok'
    latencyMs.value = data?.latency_ms ?? roundTripMs
    lastCheck.value = new Date().toISOString()
    errorMessage.value = null
  } catch (err: any) {
    status.value = 'error'
    latencyMs.value = Date.now() - start
    lastCheck.value = new Date().toISOString()
    errorMessage.value = err?.message ?? 'Unreachable'
  }
}

let retryTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  checkHealth()
})

// Auto-refresh every 60s
useIntervalFn(() => {
  checkHealth()
}, 60000)

// Retry sooner (10s) when failed
watch(status, (s) => {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  if (s === 'error') {
    retryTimer = setTimeout(() => checkHealth(), 10000)
  }
}, { immediate: true })

onUnmounted(() => {
  if (retryTimer) clearTimeout(retryTimer)
})

const circleClass = computed(() => {
  switch (status.value) {
    case 'ok': return 'bg-green-500'
    case 'degraded': return 'bg-amber-500'
    case 'error': return 'bg-red-500'
    default: return 'bg-gray-400'
  }
})

const tooltipText = computed(() => {
  const parts = [`Statut: ${status.value}`]
  if (latencyMs.value != null) parts.push(`Latence: ${latencyMs.value}ms`)
  if (lastCheck.value) parts.push(`Vérifié: ${new Date(lastCheck.value).toLocaleTimeString()}`)
  if (errorMessage.value) parts.push(`Erreur: ${errorMessage.value}`)
  return parts.join('\n')
})
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          type="button"
          class="inline-flex items-center rounded-full p-1 text-muted-foreground hover:bg-muted/50 transition-colors"
          aria-label="Statut API"
        >
          <span
            class="h-2 w-2 rounded-full shrink-0"
            :class="circleClass"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" class="whitespace-pre-line">
        {{ tooltipText }}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
