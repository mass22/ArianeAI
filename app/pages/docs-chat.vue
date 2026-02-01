<script setup lang="ts">
import { useAsyncData } from '#app'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Loader } from '@/components/ai-elements/loader'
import {
  Message,
  MessageAction,
  MessageActions,
  MessageAvatar,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputProvider,
} from '@/components/ai-elements/prompt-input'
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources'
import { useIntervalFn } from '@vueuse/core'
import type { ChatStatus } from 'ai'
import { CopyIcon } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useContext } from '~/composables/useContext'

definePageMeta({ ssr: false })

// Contexte global (client/dossier)
const { context } = useContext()

interface MetricsData {
  uptime_seconds?: number
  agents?: Record<string, {
    count?: number
    error_count?: number
    avg_duration_ms?: number
    p95_duration_ms?: number
    last_error_at?: string | null
    [key: string]: any
  }>
}

interface SourceItem {
  url: string
  title: string
  heading?: string
  score?: number
  excerpt?: string
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceItem[]
}

const {
  data: metrics,
  refresh: refreshMetrics,
  pending: pendingMetrics,
} = useAsyncData<MetricsData>('ariane-metrics-docs', () => $fetch<MetricsData>('/api/ariane/metrics'), {
  server: false,
})

useIntervalFn(() => {
  refreshMetrics()
}, 10000)

const services = computed(() => {
  const m = metrics.value as MetricsData
  if (!m?.agents) return []
  return Object.entries(m.agents).map(([name, data]) => ({ name, ...data }))
})

// Degraded only if an error happened recently (default 5 minutes)
const arianeStatus = computed(() => {
  if (!services.value.length || pendingMetrics.value) return 'unknown'
  const fiveMinAgo = Date.now() - 5 * 60 * 1000
  const hasRecentErrors = services.value.some((s) => {
    const last = s.last_error_at ? Date.parse(s.last_error_at) : 0
    return (s.error_count ?? 0) > 0 && last && last >= fiveMinAgo
  })
  return hasRecentErrors ? 'degraded' : 'ok'
})

const arianeStatusColor = computed(() => {
  switch (arianeStatus.value) {
    case 'ok':
      return 'from-emerald-500/20 via-teal-500/20 to-emerald-500/20'
    case 'degraded':
      return 'from-amber-500/20 via-orange-500/20 to-amber-500/20'
    default:
      return 'from-slate-500/20 via-slate-400/20 to-slate-500/20'
  }
})

const arianeStatusBadgeColor = computed(() => {
  switch (arianeStatus.value) {
    case 'ok':
      return 'bg-emerald-500 ring-emerald-200 dark:ring-emerald-900'
    case 'degraded':
      return 'bg-amber-500 ring-amber-200 dark:ring-amber-900'
    default:
      return 'bg-slate-400 ring-slate-200 dark:ring-slate-700'
  }
})

const arianeStatusText = computed(() => {
  switch (arianeStatus.value) {
    case 'ok':
      return 'Opérationnel'
    case 'degraded':
      return 'Dégradé (récent)'
    default:
      return 'Inconnu'
  }
})

const query = ref('')
const loading = ref(false)
const error = ref<string>('')
const messages = ref<ChatMessage[]>([])

const promptInput = usePromptInputProvider({
  onSubmit: async ({ text }) => {
    if (!text?.trim() || loading.value) return
    query.value = text.trim()
    await ask()
  },
})

async function ask() {
  error.value = ''
  loading.value = true

  const userMessageId = `user-${Date.now()}`
  messages.value.push({ id: userMessageId, role: 'user', content: query.value })

  try {
    // ✅ Use Nuxt proxy (avoids CORS & hardcoded IP)
    const res = await $fetch('/api/ariane/agent/docs', {
      method: 'POST',
      body: {
        query: query.value,
        top_k: 5,
        context: {
          clientId: context.value.clientId || undefined,
          dossierId: context.value.dossierId || undefined,
        },
        meta: {
          clientId: context.value.clientId || undefined,
          dossierId: context.value.dossierId || undefined,
        },
      },
    }) as any


    // ✅ Response can be either:
    // 1) pass-through from Ariane Core: { ok, trace_id, data: { answer, sources } }
    // 2) older double-wrapped shape: { ok, trace_id, data: { ok, trace_id, data: { answer, sources } } }
    const payload = res?.data?.data ?? res?.data ?? res
    const ok = (res?.ok ?? payload?.ok) === true

    if (!ok) {
      throw new Error(payload?.error?.message || res?.error?.message || 'Agent error')
    }

    const assistantMessageId = `assistant-${Date.now()}`
    const src: SourceItem[] = Array.isArray(payload?.sources) ? payload.sources : []

    messages.value.push({
      id: assistantMessageId,
      role: 'assistant',
      content: payload?.answer || '',
      sources: src,
    })
query.value = ''
  } catch (e: any) {
    error.value = e?.message || String(e)
    const errorMessageId = `error-${Date.now()}`
    messages.value.push({
      id: errorMessageId,
      role: 'assistant',
      content: `❌ Erreur: ${error.value}`,
    })
  } finally {
    loading.value = false
  }
}

const chatStatus = computed<ChatStatus | undefined>(() => {
  if (loading.value) return 'submitted'
  return undefined
})

async function copyToClipboard(text: string) {
  try { await navigator.clipboard.writeText(text) } catch {}
}

function clearChat() {
  messages.value = []
  error.value = ''
  query.value = ''
}
</script>

<template>
  <div class="flex h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
    <header class="relative border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/80 px-6 py-6 shadow-sm">
      <div class="mx-auto max-w-5xl">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <h1 class="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-100 dark:via-slate-200 dark:to-slate-100 bg-clip-text text-transparent">
              Ask the Docs
            </h1>
            <p class="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Posez vos questions sur la documentation d'Ariane. L'IA recherche dans les docs et vous répond avec les sources.
            </p>
          </div>

          <div class="flex-shrink-0">
            <div class="relative group">
              <div class="absolute inset-0 rounded-xl bg-gradient-to-r blur-xl opacity-50 transition-all duration-300" :class="arianeStatusColor"></div>
              <div class="relative rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 px-4 py-2 shadow-lg hover:shadow-xl transition-all duration-300">
                <div class="flex items-center gap-2.5">
                  <div class="relative h-2.5 w-2.5 rounded-full ring-2 transition-all duration-300" :class="arianeStatusBadgeColor">
                    <span v-if="arianeStatus === 'ok' || arianeStatus === 'degraded'"
                      class="absolute inset-0 h-2.5 w-2.5 rounded-full animate-ping opacity-75"
                      :class="arianeStatusBadgeColor"></span>
                  </div>
                  <div class="flex flex-col">
                    <span class="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">Docs AI</span>
                    <span class="text-[10px] font-medium leading-tight transition-colors duration-300"
                      :class="{
                        'text-emerald-600 dark:text-emerald-400': arianeStatus === 'ok',
                        'text-amber-600 dark:text-amber-400': arianeStatus === 'degraded',
                        'text-slate-500 dark:text-slate-400': arianeStatus === 'unknown'
                      }">
                      {{ arianeStatusText }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </header>

    <div class="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-transparent via-slate-50/30 to-transparent dark:via-slate-900/30">
      <div class="flex-1 overflow-hidden">
        <Conversation class="h-full">
          <ConversationContent class="mx-auto max-w-5xl px-6 py-8">
            <template v-for="message in messages" :key="message.id">
              <Message :from="message.role" class="relative">
                <MessageAvatar
                  src=""
                  :name="message.role === 'user' ? 'TU' : 'AI'"
                  :class="message.role === 'assistant'
                    ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25'
                    : 'bg-gradient-to-br from-slate-500 to-slate-600'"
                />
                <MessageContent>
                  <MessageResponse :content="message.content" />
                </MessageContent>

                <!-- Sources qui se superposent au contenu -->
                <template v-if="message.role === 'assistant' && message.sources?.length">
                  <div class="absolute top-0 right-0 z-10 translate-x-2 -translate-y-2">
                    <Sources>
                      <SourcesTrigger :count="message.sources.length" />
                      <SourcesContent class="mt-2 w-80 max-w-[calc(100vw-2rem)] origin-top-right">
                        <Source
                          v-for="(source, idx) in message.sources"
                          :key="idx"
                          :href="source.url"
                          :title="source.title || source.heading || source.url"
                          class="group relative overflow-hidden rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-800 dark:to-slate-900/80 p-3 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] backdrop-blur-sm"
                        >
                          <div class="flex items-start justify-between gap-2">
                            <div class="flex-1 min-w-0">
                              <p class="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                {{ source.title || source.heading || source.url }}
                              </p>
                              <p v-if="source.heading && source.title" class="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">
                                {{ source.heading }}
                              </p>
                              <p v-if="source.excerpt" class="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                {{ source.excerpt }}
                              </p>
                            </div>
                            <div v-if="source.score !== undefined && source.score !== null" class="shrink-0">
                              <span class="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                                {{ Math.round(source.score * 100) }}%
                              </span>
                            </div>
                          </div>
                        </Source>
                      </SourcesContent>
                    </Sources>
                  </div>
                </template>

                <MessageActions v-if="message.role === 'assistant'">
                  <MessageAction label="Copier" tooltip="Copier la réponse" @click="copyToClipboard(message.content)">
                    <CopyIcon class="size-3" />
                  </MessageAction>
                </MessageActions>
              </Message>
            </template>

            <div v-if="loading" class="flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-50/80 to-purple-50/80 dark:from-blue-950/30 dark:to-purple-950/30 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50 p-4 shadow-md">
              <Loader />
              <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Recherche dans la documentation...</span>
            </div>

            <ConversationEmptyState
              v-if="messages.length === 0 && !loading"
              title="Posez votre question"
              description="Commencez par poser une question sur la documentation d'Ariane"
              class="min-h-[400px]"
            />

          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      <div class="border-t border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm px-6 py-4 flex-shrink-0">
        <div class="mx-auto max-w-5xl">
          <PromptInput v-bind="promptInput">
            <PromptInputBody>
              <PromptInputTextarea
                v-model="query"
                placeholder="Posez une question sur la documentation d'Ariane…"
                :disabled="loading"
              />
            </PromptInputBody>

            <PromptInputFooter>
              <div class="flex items-center justify-between w-full">
                <button
                  v-if="messages.length > 0"
                  @click="clearChat"
                  class="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                >
                  Effacer la conversation
                </button>
                <PromptInputSubmit :status="chatStatus" />
              </div>
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  </div>
</template>
