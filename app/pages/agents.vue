<script setup lang="ts">
import { Chat } from '@ai-sdk/vue'
import type { ChatStatus, SourceUrlUIPart, UIMessage } from 'ai'
import { DefaultChatTransport } from 'ai'
import { computed, ref } from 'vue'
import { useContext } from '~/composables/useContext'

/* AI Elements Components */
import {
    Conversation,
    ConversationContent,
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
    Reasoning,
    ReasoningContent,
    ReasoningTrigger,
} from '@/components/ai-elements/reasoning'

import {
    Source,
    Sources,
    SourcesContent,
    SourcesTrigger,
} from '@/components/ai-elements/sources'

import { CopyIcon, RefreshCcwIcon } from 'lucide-vue-next'

/* 🔹 Contexte global */
const { context } = useContext()

/* 🔹 Définition des agents */
const agents = [
  { id: 'ariane-ai', label: 'Ariane AI', description: 'Assistant général.' },
  { id: 'scribe', label: 'Scribe', description: 'Analyse & structuration.' },
  { id: 'strategist', label: 'Stratège', description: 'Décisions & options.' },
  { id: 'memory', label: 'Mémoire', description: 'Accès à ton historique.' },
] as const

type AgentId = (typeof agents)[number]['id']

const selectedAgentId = ref<AgentId>('ariane-ai')

/* 🔹 Transport personnalisé qui inclut le contexte */
class ContextualChatTransport extends DefaultChatTransport {
  constructor(options: { api: string }) {
    super(options)
  }

  async fetch(body: any) {
    // Ajouter le contexte aux requêtes
    const enhancedBody = {
      ...body,
      context: {
        clientId: context.value.clientId || undefined,
        dossierId: context.value.dossierId || undefined,
      },
      meta: {
        clientId: context.value.clientId || undefined,
        dossierId: context.value.dossierId || undefined,
      },
    }
    return super.fetch(enhancedBody)
  }
}

/* 🔹 Un chat par agent, connecté à TON endpoint */
const chats = Object.fromEntries(
  agents.map(a => [
    a.id,
    new Chat({
      transport: new ContextualChatTransport({ api: `/api/ariane/agent/${a.id}` }),
    }),
  ]),
) as Record<AgentId, InstanceType<typeof Chat>>

const currentChat = computed(() => chats[selectedAgentId.value])
const messages = computed(() => currentChat.value.messages)
const status = computed<ChatStatus>(() => currentChat.value.status)
const lastMessageId = computed(() => messages.value.at(-1)?.id ?? null)

/* 🔹 Prompt Input */
const promptInput = usePromptInputProvider({
  onSubmit: ({ text }) => {
    if (text?.trim()) {
      return currentChat.value.sendMessage({ text })
    }
  },
})

/* Helpers */
function isStreamingPart(message: UIMessage, partIndex: number) {
  return (
    status.value === 'streaming' &&
    message.id === lastMessageId.value &&
    partIndex === message.parts.length - 1
  )
}

function getSourceParts(message: UIMessage) {
  return message.parts.filter((p): p is SourceUrlUIPart => p.type === 'source-url')
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {}
}

function regenerate() {
  currentChat.value.regenerate()
}
</script>

<template>
  <div class="h-screen flex gap-4 p-6 bg-background">

    <!-- 🔹 Sidebar Agents -->
    <aside class="w-64 border-r pr-4 flex flex-col gap-3">
      <h2 class="font-semibold text-lg">Ariane · AI</h2>

      <nav class="flex flex-col gap-2 mt-2">
        <button
          v-for="agent in agents"
          :key="agent.id"
          class="p-3 rounded-xl border text-left transition"
          :class="selectedAgentId === agent.id ? 'bg-accent' : 'bg-card'"
          @click="selectedAgentId = agent.id"
        >
          <div class="font-medium">{{ agent.label }}</div>
          <div class="text-xs text-muted-foreground">{{ agent.description }}</div>
        </button>
      </nav>

      <p class="text-[11px] text-muted-foreground mt-auto">
        Chaque agent utilise :
        <code class="px-1 bg-muted rounded">/api/ariane/agent/&lt;name&gt;</code>
      </p>
    </aside>

    <!-- 🔹 Main Panel -->
    <main class="flex-1 flex flex-col rounded-2xl border bg-card p-4">
      <!-- Header -->
      <header class="mb-4">
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-xl font-semibold">
              {{ agents.find(a => a.id === selectedAgentId)?.label }}
            </h1>
            <p class="text-xs text-muted-foreground">
              {{ agents.find(a => a.id === selectedAgentId)?.description }}
            </p>
          </div>
          <!-- Contexte actuel -->
          <div
            v-if="context.clientId || context.dossierId"
            class="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded"
          >
            <div v-if="context.client">
              Client: <span class="font-medium">{{ context.client.prenom }} {{ context.client.nom }}</span>
            </div>
            <div v-if="context.dossier" class="mt-0.5">
              Dossier: <span class="font-medium">{{ context.dossier.name }}</span>
            </div>
          </div>
        </div>
      </header>

      <!-- 🔹 Chat -->
      <div class="flex flex-col flex-1 rounded-xl border bg-background p-4">
        <Conversation class="flex flex-col flex-1">
          <ConversationContent>

            <!-- ——————————————— MESSAGES ——————————————— -->
            <div v-for="m in messages" :key="m.id" class="mb-4">

              <!-- Sources RAG -->
              <Sources v-if="getSourceParts(m).length > 0">
                <SourcesTrigger :count="getSourceParts(m).length" />
                <SourcesContent v-for="(src, i) in getSourceParts(m)" :key="i">
                  <Source :href="src.url" :title="src.title ?? src.url" />
                </SourcesContent>
              </Sources>

              <template v-for="(part, i) in m.parts" :key="i">

                <!-- Message text -->
                <Message v-if="part.type === 'text'" :from="m.role">
                  <MessageAvatar src="" :name="m.role === 'user' ? 'TU' : 'AI'" />
                  <MessageContent>
                    <MessageResponse :content="part.text" />
                  </MessageContent>

                  <!-- Actions (Copy / Retry) -->
                  <MessageActions v-if="m.role === 'assistant'">
                    <MessageAction label="Retry" @click="regenerate">
                      <RefreshCcwIcon class="size-3" />
                    </MessageAction>
                    <MessageAction label="Copy" @click="copyToClipboard(part.text)">
                      <CopyIcon class="size-3" />
                    </MessageAction>
                  </MessageActions>
                </Message>

                <!-- Reasoning -->
                <Reasoning v-else-if="part.type === 'reasoning'"
                  :is-streaming="isStreamingPart(m, i)"
                >
                  <ReasoningTrigger />
                  <ReasoningContent :content="part.text" />
                </Reasoning>
              </template>
            </div>

            <!-- Loader state -->
            <Loader v-if="status === 'submitted'" class="mx-auto mt-4" />
          </ConversationContent>

          <ConversationScrollButton />
        </Conversation>

        <!-- 🔹 Input -->
        <PromptInput class="mt-4">
          <PromptInputBody>
            <PromptInputTextarea placeholder="Parle à Ariane…" />
          </PromptInputBody>

          <PromptInputFooter>
            <PromptInputSubmit :status="status" />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </main>
  </div>
</template>
