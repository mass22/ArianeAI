<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChatStatus } from 'ai'
import { useContext } from '~/composables/useContext'
import { usePromptInputProvider } from '@/components/ai-elements/prompt-input/context'
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
} from '@/components/ai-elements/prompt-input'
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources'
import { CopyIcon } from 'lucide-vue-next'
import type { LlmChatMessage } from '~/composables/useLlmChat'

export interface SourceItem {
  url: string
  title: string
  heading?: string
  score?: number
  excerpt?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceItem[]
}

interface Props {
  /** Endpoint API pour l'agent (ex: '/api/ariane/agent/docs'). Si non fourni, utilise '/api/llm/chat' */
  agentEndpoint?: string
  /** Placeholder pour le champ de saisie */
  placeholder?: string
  /** Message d'état vide */
  emptyStateTitle?: string
  emptyStateDescription?: string
  /** Inclure automatiquement le contexte client/dossier */
  includeContext?: boolean
  /** Paramètres supplémentaires à envoyer dans le body */
  extraBodyParams?: Record<string, any>
  /** Classe CSS pour le conteneur */
  class?: string
  /** Modèle LLM à utiliser (par défaut: 'llama3.1:8b') */
  model?: string
  /** Prompt système pour le LLM */
  system?: string
  /** Température pour le LLM (par défaut: 0.7) */
  temperature?: number
  /** Nombre maximum de tokens */
  maxTokens?: number
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Posez votre question…',
  emptyStateTitle: 'Posez votre question',
  emptyStateDescription: 'Commencez par poser une question',
  includeContext: true,
  extraBodyParams: () => ({}),
  agentEndpoint: '/api/llm/chat',
  model: 'llama3.1:8b',
  system: 'Tu es un assistant utile et concis. Réponds en français.',
  temperature: 0.7,
})

const emit = defineEmits<{
  (e: 'message', message: ChatMessage): void
  (e: 'error', error: string): void
}>()

// Contexte global (client/dossier)
const { context } = useContext()

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
  const userMessage: ChatMessage = {
    id: userMessageId,
    role: 'user',
    content: query.value,
  }
  messages.value.push(userMessage)
  emit('message', userMessage)

  try {
    // Vérifier si on utilise le nouvel endpoint LLM ou l'ancien endpoint agent
    const isLlmChatEndpoint = props.agentEndpoint === '/api/llm/chat' || props.agentEndpoint?.endsWith('/llm/chat')
    
    if (isLlmChatEndpoint) {
      // Utiliser le nouvel endpoint /api/llm/chat
      // Convertir l'historique des messages en format LLM
      const llmMessages: LlmChatMessage[] = messages.value.map(msg => ({
        role: msg.role,
        content: msg.content,
      }))

      // Construire le body pour l'endpoint LLM
      const body: Record<string, any> = {
        model: props.model,
        system: props.system,
        messages: llmMessages,
        temperature: props.temperature,
        ...(props.maxTokens && { maxTokens: props.maxTokens }),
        ...props.extraBodyParams,
      }

      // Ajouter le contexte dans le système prompt si demandé
      if (props.includeContext && (context.value.clientId || context.value.dossierId)) {
        const contextInfo = []
        if (context.value.clientId) contextInfo.push(`Client ID: ${context.value.clientId}`)
        if (context.value.dossierId) contextInfo.push(`Dossier ID: ${context.value.dossierId}`)
        if (contextInfo.length > 0) {
          body.system = `${body.system}\n\nContexte: ${contextInfo.join(', ')}`
        }
      }

      const res = await $fetch<{
        ok: boolean
        trace_id?: string
        data?: {
          response: string
          model: string
          llm_ms: number
        }
        error?: {
          code: string
          message: string
        }
      }>(props.agentEndpoint, {
        method: 'POST',
        body,
      })

      if (!res.ok) {
        throw new Error(res.error?.message || 'Erreur LLM')
      }

      if (!res.data) {
        throw new Error('Réponse invalide du serveur')
      }

      const assistantMessageId = `assistant-${Date.now()}`
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: res.data.response,
        sources: [], // Le nouvel endpoint ne retourne pas de sources pour l'instant
      }

      messages.value.push(assistantMessage)
      emit('message', assistantMessage)
      query.value = ''
    } else {
      // Ancien endpoint agent (compatibilité)
      const body: Record<string, any> = {
        query: query.value,
        ...props.extraBodyParams,
      }

      // Ajouter le contexte si demandé
      if (props.includeContext) {
        body.context = {
          clientId: context.value.clientId || undefined,
          dossierId: context.value.dossierId || undefined,
        }
        body.meta = {
          clientId: context.value.clientId || undefined,
          dossierId: context.value.dossierId || undefined,
        }
      }

      const res = await $fetch(props.agentEndpoint, {
        method: 'POST',
        body,
      }) as any

      // Gérer les différentes formes de réponse
      // 1) pass-through from Ariane Core: { ok, trace_id, data: { answer, sources } }
      // 2) older double-wrapped shape: { ok, trace_id, data: { ok, trace_id, data: { answer, sources } } }
      const payload = res?.data?.data ?? res?.data ?? res
      const ok = (res?.ok ?? payload?.ok) === true

      if (!ok) {
        throw new Error(payload?.error?.message || res?.error?.message || 'Agent error')
      }

      const assistantMessageId = `assistant-${Date.now()}`
      const src: SourceItem[] = Array.isArray(payload?.sources) ? payload.sources : []

      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: payload?.answer || '',
        sources: src,
      }

      messages.value.push(assistantMessage)
      emit('message', assistantMessage)
      query.value = ''
    }
  } catch (e: any) {
    error.value = e?.message || String(e)
    emit('error', error.value)
    
    const errorMessageId = `error-${Date.now()}`
    const errorMessage: ChatMessage = {
      id: errorMessageId,
      role: 'assistant',
      content: `❌ Erreur: ${error.value}`,
    }
    messages.value.push(errorMessage)
    emit('message', errorMessage)
  } finally {
    loading.value = false
  }
}

const chatStatus = computed<ChatStatus | undefined>(() => {
  if (loading.value) return 'submitted'
  return undefined
})

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {}
}

function clearChat() {
  messages.value = []
  error.value = ''
  query.value = ''
}

// Exposer les méthodes et états pour utilisation externe
defineExpose({
  messages,
  loading,
  error,
  clearChat,
  ask,
})
</script>

<template>
  <div :class="['flex flex-col h-full', props.class]">
    <div class="flex-1 overflow-hidden">
      <Conversation class="h-full">
        <ConversationContent class="h-full overflow-y-auto">
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
            <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Traitement en cours...</span>
          </div>

          <ConversationEmptyState
            v-if="messages.length === 0 && !loading"
            :title="emptyStateTitle"
            :description="emptyStateDescription"
            class="min-h-[400px]"
          />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>

    <div class="border-t border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm px-6 py-4 flex-shrink-0">
      <PromptInput v-bind="promptInput">
        <PromptInputBody>
          <PromptInputTextarea
            v-model="query"
            :placeholder="placeholder"
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
</template>
