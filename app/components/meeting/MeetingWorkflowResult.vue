<script setup lang="ts">
import type { MeetingWorkflowResult, FollowupEmail } from '~/types/meeting'
import { StreamMarkdown } from 'streamdown-vue'
import { todayMontreal } from '~/lib/dateUtils'

defineOptions({
  name: 'MeetingWorkflowResult',
})

const props = defineProps<{
  result: MeetingWorkflowResult
}>()

const toast = useToast()
const { addMeetingTodos } = useMeetingTodos()

const MAX_TODOS = 5

// Section A: Résumé meeting (markdown)
const summaryMarkdown = computed(() => {
  const r = props.result?.result
  if (!r) return ''
  const meeting = r.meeting as { content?: string; markdown?: string; raw?: string } | undefined
  if (meeting?.content) return meeting.content
  if (meeting?.markdown) return meeting.markdown
  const scribe = r.scribe
  if (!scribe) return ''
  const parts: string[] = []
  if (scribe.summary || scribe.resume) {
    parts.push(`## Résumé\n\n${scribe.summary || scribe.resume}\n`)
  }
  if (scribe.key_points?.length) {
    parts.push('## Points clés\n\n')
    scribe.key_points.forEach((p: string) => parts.push(`- ${p}\n`))
  }
  if (scribe.client_goals?.length) {
    parts.push('## Objectifs client\n\n')
    scribe.client_goals.forEach((g: string) => parts.push(`- ${g}\n`))
  }
  if (scribe.action_items?.length) {
    parts.push('## Actions\n\n')
    scribe.action_items.forEach((a: string) => parts.push(`- ${a}\n`))
  }
  return parts.join('')
})

const markdownPath = computed(() => {
  const m = props.result?.result?.meeting as { markdown_path?: string } | undefined
  return m?.markdown_path ?? null
})

async function copySummary() {
  if (!summaryMarkdown.value) return
  try {
    await navigator.clipboard.writeText(summaryMarkdown.value)
    toast.add({ title: 'Copié', description: 'Résumé copié dans le presse-papier', color: 'success' })
  } catch {
    toast.add({ title: 'Erreur', description: 'Copie impossible', color: 'error' })
  }
}

// Section B: Todos (max 5, tronqué + warning si > 5)
const rawTodos = computed(() => {
  const list = props.result?.result?.todos ?? []
  return Array.isArray(list) ? list : []
})
const todos = computed(() => rawTodos.value.slice(0, MAX_TODOS))
const todosTruncated = computed(() => rawTodos.value.length > MAX_TODOS)

const todoChecked = ref<Set<number>>(new Set())

function toggleTodo(i: number) {
  const next = new Set(todoChecked.value)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  todoChecked.value = next
}

const todosAsText = computed(() => todos.value.map((t, i) => `${i + 1}. ${t}`).join('\n'))

async function copyTodos() {
  if (!todosAsText.value) return
  try {
    await navigator.clipboard.writeText(todosAsText.value)
    toast.add({ title: 'Copié', description: 'Todos copiés dans le presse-papier', color: 'success' })
  } catch {
    toast.add({ title: 'Erreur', description: 'Copie impossible', color: 'error' })
  }
}

function addToDailyTodos() {
  const items = rawTodos.value
  if (!items.length) return
  const date = todayMontreal()
  const added = addMeetingTodos(date, items)
  if (added > 0) {
    toast.add({
      title: 'Tâches ajoutées',
      description: `${added} tâche(s) ajoutée(s) au brief du jour (${date})`,
      color: 'success',
    })
  } else {
    toast.add({
      title: 'Déjà présentes',
      description: 'Ces tâches sont déjà dans le brief du jour.',
      color: 'neutral',
    })
  }
}

// Section C: Email follow-up (subject + body)
const followupEmailRaw = computed(() => props.result?.result?.followup_email)

const followupEmailDisplay = computed(() => {
  const raw = followupEmailRaw.value
  if (!raw) return ''
  if (typeof raw === 'string') return raw
  const obj = raw as FollowupEmail
  const parts: string[] = []
  if (obj.subject) parts.push(`Subject: ${obj.subject}\n`)
  if (obj.body) parts.push(obj.body)
  return parts.join('\n')
})

async function copyEmail() {
  if (!followupEmailDisplay.value) return
  try {
    await navigator.clipboard.writeText(followupEmailDisplay.value)
    toast.add({ title: 'Copié', description: 'Email copié dans le presse-papier', color: 'success' })
  } catch {
    toast.add({ title: 'Erreur', description: 'Copie impossible', color: 'error' })
  }
}

// Section D: Steps debug (collapsible)
const steps = computed(() => props.result?.steps ?? [])

// Section E: Status badge
const status = computed(() => props.result?.status ?? 'ok')

const statusConfig = computed(() => {
  switch (status.value) {
    case 'ok':
      return { label: 'OK', color: 'success', icon: 'i-lucide-check-circle' }
    case 'degraded':
      return { label: 'Dégradé', color: 'warning', icon: 'i-lucide-alert-triangle' }
    case 'error':
      return { label: 'Erreur', color: 'error', icon: 'i-lucide-alert-circle' }
    default:
      return { label: status.value, color: 'neutral', icon: 'i-lucide-help-circle' }
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Section E: Badge status (en tête) -->
    <div class="flex flex-wrap items-center gap-2">
      <UBadge :color="statusConfig.color" variant="subtle" size="md">
        <UIcon :name="statusConfig.icon" class="h-3.5 w-3.5 mr-1" />
        {{ statusConfig.label }}
      </UBadge>
      <span v-if="result.workflow_id" class="text-xs text-slate-500 dark:text-slate-400 font-mono">
        {{ result.workflow_id }}
      </span>
    </div>

    <!-- Section A: Résumé meeting (markdown + copier + ouvrir) -->
    <div
      v-if="summaryMarkdown"
      class="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 p-4 shadow-sm"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <div
            class="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md"
          >
            <UIcon name="i-lucide-file-text" class="h-4 w-4 text-white" />
          </div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
            Résumé meeting
          </h3>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            color="primary"
            variant="soft"
            icon="i-lucide-copy"
            @click="copySummary"
          >
            Copier
          </UButton>
          <UButton
            v-if="markdownPath && (markdownPath.startsWith('http') || markdownPath.startsWith('/'))"
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-external-link"
            :to="markdownPath"
            target="_blank"
            rel="noopener"
          >
            Ouvrir le markdown
          </UButton>
        </div>
      </div>
      <div class="prose prose-slate dark:prose-invert max-w-none text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <StreamMarkdown
          :content="summaryMarkdown"
          :shiki-theme="{ light: 'github-light', dark: 'github-dark' }"
          class="size-full"
        />
      </div>
    </div>

    <!-- Section B: Todos (max 5 + warning + copier todos) -->
    <div
      v-if="todos.length"
      class="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 p-4 shadow-sm"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <div
            class="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md"
          >
            <UIcon name="i-lucide-list-checks" class="h-4 w-4 text-white" />
          </div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
            Todos
          </h3>
          <UBadge v-if="todosTruncated" color="warning" variant="subtle" size="xs">
            Limité à {{ MAX_TODOS }} ({{ rawTodos.length }} reçus)
          </UBadge>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            color="primary"
            variant="soft"
            icon="i-lucide-calendar-plus"
            @click="addToDailyTodos"
          >
            Ajouter aux tâches du jour
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-copy"
            @click="copyTodos"
          >
            Copier
          </UButton>
        </div>
      </div>
      <ul class="space-y-2">
        <li
          v-for="(todo, i) of todos"
          :key="i"
          class="flex items-start gap-2 cursor-pointer"
          @click="toggleTodo(i)"
        >
          <div class="flex-shrink-0 mt-0.5" @click.stop>
            <UCheckbox
              :model-value="todoChecked.has(i)"
              variant="list"
              @update:model-value="() => toggleTodo(i)"
            />
          </div>
          <span
            :class="[
              'text-sm text-slate-700 dark:text-slate-300',
              todoChecked.has(i) && 'line-through opacity-70',
            ]"
          >
            {{ todo }}
          </span>
        </li>
      </ul>
    </div>

    <!-- Section C: Email follow-up (subject + body + copier) -->
    <div
      v-if="followupEmailDisplay"
      class="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 p-4 shadow-sm"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <div
            class="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-md"
          >
            <UIcon name="i-lucide-mail" class="h-4 w-4 text-white" />
          </div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
            Email follow-up
          </h3>
        </div>
        <UButton
          size="xs"
          color="primary"
          variant="soft"
          icon="i-lucide-copy"
          @click="copyEmail"
        >
          Copier
        </UButton>
      </div>
      <pre
        class="whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 max-h-48 overflow-y-auto"
      >{{ followupEmailDisplay }}</pre>
    </div>

    <!-- Section D: Steps debug (collapsible) -->
    <UCollapsible v-if="steps.length" class="flex flex-col gap-2">
      <UButton
        variant="ghost"
        size="sm"
        color="neutral"
        trailing-icon="i-lucide-chevron-down"
        class="text-xs font-medium w-fit"
      >
        <UIcon name="i-lucide-bug" class="h-3.5 w-3.5 mr-1" />
        Workflow steps (debug)
      </UButton>
      <template #content>
        <div class="space-y-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/50 p-3">
          <div
            v-for="(step, i) of steps"
            :key="i"
            class="flex items-center gap-2 text-xs font-mono"
          >
            <UBadge
              :color="step.status === 'ok' ? 'success' : step.status === 'error' ? 'error' : 'neutral'"
              variant="subtle"
              size="xs"
            >
              {{ step.status }}
            </UBadge>
            <span class="text-slate-600 dark:text-slate-400">{{ step.name }}</span>
            <span v-if="step.duration_ms" class="text-slate-500 dark:text-slate-500">
              ({{ step.duration_ms }}ms)
            </span>
            <span v-if="step.error" class="text-red-600 dark:text-red-400 truncate" :title="step.error">
              — {{ step.error }}
            </span>
          </div>
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
