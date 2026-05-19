<script setup lang="ts">
import { Conversation, ConversationContent } from '@/components/ai-elements/conversation'
import { Loader } from '@/components/ai-elements/loader'
import { Message, MessageAvatar, MessageContent } from '@/components/ai-elements/message'
import { Button } from '@/components/ui/button'
import { computed, ref, watch } from 'vue'
import { useArianeRecorder } from '~/composables/useArianeRecorder'
import { useContext } from '~/composables/useContext'
import { buildMeetingContentFromScribe } from '~/lib/scribeContentUtils'
import { todayMontreal } from '~/lib/dateUtils'
import type { MeetingWorkflowResult } from '~/types/meeting'

definePageMeta({
  ssr: false,
})

const { context } = useContext()
const { runMeetingWorkflow } = useArianeApi()
const toast = useToast()

// États workflow : loading, ok, degraded, error
type WorkflowState = 'idle' | 'loading' | 'ok' | 'degraded' | 'error'
const workflowState = ref<WorkflowState>('idle')
const error = ref<string | null>(null)
const workflowResult = ref<MeetingWorkflowResult | null>(null)
const loadingWorkflow = ref(false)
const loadingTranscript = ref(false)

const { isRecording, lastBlob, elapsedSeconds, start, stop, resetTimer } = useArianeRecorder()

type RecordStatus = 'idle' | 'recording' | 'uploading'
const recordStatus = ref<RecordStatus>('idle')

// Pour retry : garder le dernier blob et ses params
const lastProcessParams = ref<{ blob: Blob; format: string; source: string } | null>(null)

const isBusy = computed(
  () => isRecording.value || loadingWorkflow.value || loadingTranscript.value || recordStatus.value === 'uploading',
)

const formattedTime = computed(() => {
  const s = elapsedSeconds.value
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})

const statusLabel = computed(() => {
  if (recordStatus.value === 'recording') return 'Enregistrement en cours'
  if (recordStatus.value === 'uploading') return "Upload de l'audio"
  if (loadingTranscript.value) return 'Import transcription (Scribe + import)'
  if (loadingWorkflow.value) return 'Analyse par Ariane (1 clic)'
  if (workflowState.value === 'ok') return 'Analyse terminée'
  if (workflowState.value === 'degraded') return 'Analyse terminée (dégradé)'
  if (workflowState.value === 'error') return 'Erreur'
  return 'Prêt'
})

const statusColor = computed(() => {
  if (recordStatus.value === 'recording') {
    return 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 text-red-700 dark:text-red-300 border-red-200/80 dark:border-red-800/50 shadow-sm shadow-red-500/10'
  }
  if (loadingWorkflow.value || loadingTranscript.value || recordStatus.value === 'uploading') {
    return 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/50 shadow-sm shadow-blue-500/10'
  }
  if (workflowState.value === 'ok') {
    return 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/50 shadow-sm shadow-emerald-500/10'
  }
  if (workflowState.value === 'degraded') {
    return 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/50 shadow-sm shadow-amber-500/10'
  }
  if (workflowState.value === 'error') {
    return 'bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/50 shadow-sm shadow-rose-500/10'
  }
  return 'bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/30 dark:to-slate-900/30 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/50 shadow-sm'
})

const debugMessage = computed(() => {
  if (recordStatus.value === 'recording') return 'Enregistrement en cours. Parlez normalement.'
  if (recordStatus.value === 'uploading') return "Préparation de l'audio pour envoi..."
  if (loadingTranscript.value) return 'Analyse Scribe puis import en cours...'
  if (loadingWorkflow.value) return 'Workflow meeting en cours (transcription + scribe + import)...'
  if (workflowState.value === 'ok') return 'Analyse terminée et importé dans Ariane ✅'
  if (workflowState.value === 'degraded') return 'Analyse terminée avec avertissements. Vérifiez les étapes.'
  if (workflowState.value === 'error') return error.value ?? 'Échec du workflow meeting.'
  return 'Enregistrez, uploadez un audio, ou une transcription .md/.txt'
})

const canRetry = computed(() => workflowState.value === 'error' && lastProcessParams.value !== null)

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1]
        base64 ? resolve(base64) : reject(new Error('Failed to convert blob to base64'))
      } else {
        reject(new Error('Failed to read blob as data URL'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

const getAudioFormat = (filename: string, mimeType: string): string => {
  const ext = filename.toLowerCase().split('.').pop() || ''
  const formatMap: Record<string, string> = {
    mp3: 'mp3', wav: 'wav', m4a: 'm4a', ogg: 'ogg', webm: 'webm', flac: 'flac', aac: 'aac',
  }
  if (formatMap[ext]) return formatMap[ext]
  if (mimeType.includes('mp3')) return 'mp3'
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('m4a') || mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('flac')) return 'flac'
  if (mimeType.includes('aac')) return 'aac'
  return 'mp3'
}

async function processAudio(blob: Blob, format: string, source: string) {
  if (blob.size < 800) {
    workflowState.value = 'error'
    error.value = 'Fichier audio trop petit ou vide.'
    return
  }

  loadingWorkflow.value = true
  recordStatus.value = 'uploading'
  error.value = null
  workflowResult.value = null
  workflowState.value = 'loading'
  lastProcessParams.value = { blob, format, source }

  try {
    const base64 = await blobToBase64(blob)
    recordStatus.value = 'uploading'

    const { data, error: err } = await runMeetingWorkflow({
      audio_base64: base64,
      format,
      language: 'fr',
      meta: {
        source,
        label: `capture depuis Nuxt - ${source}`,
        clientId: context.value.clientId ?? undefined,
        dossierId: context.value.dossierId ?? undefined,
        date: todayMontreal(),
        title: 'Réunion enregistrée',
        participants: [],
      },
    })

    if (err || !data) {
      workflowState.value = 'error'
      error.value = err ?? 'Erreur inconnue'
      toast.add({ title: 'Erreur', description: error.value, color: 'error' })
      return
    }

    workflowResult.value = data
    workflowState.value = data.status
    recordStatus.value = 'idle'

    if (data.status === 'degraded') {
      toast.add({
        title: 'Analyse terminée avec avertissements',
        description: 'Certaines étapes ont échoué. Vérifiez les détails ci-dessous.',
        color: 'warning',
      })
    } else if (data.status === 'ok') {
      toast.add({ title: 'Succès', description: 'Meeting analysé et importé', color: 'success' })
    }
  } catch (e: unknown) {
    const ex = e as { message?: string }
    console.error('[meeting]', ex)
    workflowState.value = 'error'
    error.value = ex?.message ?? 'Erreur pendant le workflow.'
    recordStatus.value = 'idle'
    toast.add({ title: 'Erreur', description: error.value, color: 'error' })
  } finally {
    loadingWorkflow.value = false
  }
}

async function retry() {
  if (!lastProcessParams.value) return
  const { blob, format, source } = lastProcessParams.value
  await processAudio(blob, format, source)
}

const startRecording = async () => {
  error.value = null
  workflowResult.value = null
  workflowState.value = 'idle'
  recordStatus.value = 'recording'
  try {
    resetTimer()
    await start()
  } catch (e: unknown) {
    const ex = e as { message?: string }
    workflowState.value = 'error'
    error.value = ex?.message ?? "Impossible de démarrer l'enregistrement"
    toast.add({ title: 'Erreur', description: error.value, color: 'error' })
  }
}

const stopRecording = async () => {
  await stop()
  recordStatus.value = 'uploading'
}

watch(lastBlob, async (blob) => {
  if (!blob) return
  await processAudio(blob, 'webm', 'meeting-recording')
})

const uploadedFileName = ref<string | null>(null)

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('audio/')) {
    workflowState.value = 'error'
    error.value = "Le fichier sélectionné n'est pas un fichier audio."
    toast.add({ title: 'Erreur', description: error.value, color: 'error' })
    target.value = ''
    return
  }

  error.value = null
  workflowResult.value = null
  workflowState.value = 'idle'
  uploadedFileName.value = file.name
  const format = getAudioFormat(file.name, file.type)
  await processAudio(file, format, 'meeting-upload')
  target.value = ''
}

const uploadedTranscriptName = ref<string | null>(null)

async function processTranscript(text: string, source: string) {
  loadingTranscript.value = true
  error.value = null
  workflowResult.value = null
  workflowState.value = 'loading'

  try {
    if (!text.trim()) {
      throw new Error('Le fichier de transcription est vide.')
    }

    if (!context.value.clientId) {
      toast.add({
        title: 'Client requis',
        description: 'Sélectionnez un client dans le sélecteur pour importer la transcription.',
        color: 'warning',
      })
      workflowState.value = 'error'
      error.value = 'Sélectionnez un client pour lier la réunion aux insights.'
      return
    }

    const scribeRes = await $fetch<any>('/api/ariane/agent/scribe', {
      method: 'POST',
      body: { transcript: text, context: 'Transcription de réunion commerciale' },
      timeout: 600_000, // 10 min (Scribe/LLM peut être lent)
    })

    const content = buildMeetingContentFromScribe(scribeRes, text)

    await $fetch('/api/ariane/meetings/import', {
      method: 'POST',
      body: {
        content,
        transcript: text,
        scribeResult: scribeRes,
        meta: {
          source,
          label: `Import transcription - ${source}`,
          clientId: context.value.clientId,
          dossierId: context.value.dossierId ?? undefined,
          date: todayMontreal(),
          title: 'Import transcription',
          participants: [],
        },
      },
    })

    workflowState.value = 'ok'
    workflowResult.value = {
      workflow_id: `transcript-${Date.now()}`,
      status: 'ok',
      steps: [{ name: 'Scribe', status: 'ok' }, { name: 'Import', status: 'ok' }],
      result: {
        meeting: { content, markdown: content },
        scribe: scribeRes,
        todos: scribeRes?.action_items ?? scribeRes?.actions ?? [],
        crm: { created: true },
        memory: { stored: true },
      },
    }
    toast.add({ title: 'Succès', description: 'Transcription analysée et importée', color: 'success' })
  } catch (e: unknown) {
    const ex = e as { message?: string }
    workflowState.value = 'error'
    error.value = ex?.message ?? 'Erreur lors de l\'import de la transcription.'
    toast.add({ title: 'Erreur', description: error.value, color: 'error' })
  } finally {
    loadingTranscript.value = false
  }
}

const handleTranscriptUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const ext = file.name.toLowerCase().split('.').pop() || ''
  if (!['md', 'txt', 'markdown'].includes(ext)) {
    workflowState.value = 'error'
    error.value = 'Format non supporté. Utilisez .md ou .txt'
    toast.add({ title: 'Erreur', description: error.value, color: 'error' })
    target.value = ''
    return
  }

  error.value = null
  workflowResult.value = null
  workflowState.value = 'idle'
  uploadedTranscriptName.value = file.name

  const text = await file.text()
  await processTranscript(text, 'transcription-upload')
  target.value = ''
}

const router = useRouter()
const onInsightsClient = () => {
  const id = context.value.clientId
  if (id) {
    router.push(`/clients/${id}?tab=insights`)
  } else {
    toast.add({
      title: 'Sélectionnez un client',
      description: 'Choisissez un client dans le sélecteur pour accéder à ses insights.',
      color: 'warning',
    })
  }
}
</script>

<template>
  <div class="flex h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
    <header class="relative border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/80 px-6 py-6 shadow-sm">
      <div class="mx-auto max-w-5xl">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <h1 class="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-100 dark:via-slate-200 dark:to-slate-100 bg-clip-text text-transparent">
              Meeting Scribe
            </h1>
            <p class="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Enregistrez, uploadez un audio ou une transcription .md — Scribe analyse et importe dans les insights.
            </p>
          </div>
          <ContextSwitcher />
        </div>
      </div>
    </header>

    <!-- Barre de statut -->
    <div class="border-b border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 via-white/50 to-slate-50/50 dark:from-slate-900/50 dark:via-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm px-6 py-3">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <span
            class="inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 text-xs font-semibold shadow-sm transition-all duration-200"
            :class="statusColor"
          >
            <span
              v-if="recordStatus === 'recording'"
              class="relative h-2.5 w-2.5 rounded-full bg-red-500"
            >
              <span class="absolute inset-0 h-2.5 w-2.5 rounded-full bg-red-500 animate-ping opacity-75" />
            </span>
            <span
              v-else-if="isBusy"
              class="relative h-2.5 w-2.5 rounded-full bg-blue-500"
            >
              <span class="absolute inset-0 h-2.5 w-2.5 rounded-full bg-blue-500 animate-ping opacity-75" />
            </span>
            <span
              v-else-if="workflowState === 'ok'"
              class="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900"
            />
            <span
              v-else-if="workflowState === 'degraded'"
              class="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900"
            />
            <span
              v-else-if="workflowState === 'error'"
              class="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200 dark:ring-rose-900"
            />
            <span v-else class="h-2.5 w-2.5 rounded-full bg-slate-400" />
            {{ statusLabel }}
          </span>
          <p class="text-xs text-slate-600 dark:text-slate-400 font-medium">
            {{ debugMessage }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <UButton
            v-if="canRetry"
            color="primary"
            variant="soft"
            icon="i-lucide-refresh-cw"
            :loading="loadingWorkflow"
            @click="retry"
          >
            Réessayer
          </UButton>
          <div class="relative inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-xs font-mono font-semibold text-white shadow-lg shadow-blue-500/25">
            <UIcon name="i-lucide-clock" class="h-3.5 w-3.5" />
            <span class="opacity-90">Durée</span>
            <span class="font-bold">{{ formattedTime }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="border-b border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm px-6 py-4">
      <div class="mx-auto flex max-w-5xl items-center gap-4">
        <div class="flex items-center gap-3">
          <Button
            v-if="!isRecording"
            :disabled="isBusy"
            @click="startRecording"
            class="group relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <span class="relative z-10 flex items-center gap-2.5">
              <UIcon name="i-lucide-mic" class="h-5 w-5" />
              <span>Commencer l'enregistrement</span>
            </span>
          </Button>
          <Button
            v-else
            @click="stopRecording"
            class="group relative overflow-hidden bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-red-500/25 transition-all duration-300"
          >
            <span class="relative z-10 flex items-center gap-2.5">
              <UIcon name="i-lucide-square" class="h-5 w-5" />
              <span>Arrêter l'enregistrement</span>
            </span>
          </Button>
          <div class="h-8 w-px bg-slate-300 dark:bg-slate-700" />
          <label
            :class="[
              'group relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-pointer inline-flex items-center gap-2.5',
              isBusy && 'opacity-50 cursor-not-allowed hover:scale-100',
            ]"
          >
            <input
              type="file"
              accept="audio/*"
              :disabled="isBusy"
              @change="handleFileUpload"
              class="hidden"
            />
            <UIcon name="i-lucide-upload" class="h-5 w-5" />
            <span>Upload audio</span>
          </label>
          <label
            :class="[
              'group relative overflow-hidden bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-pointer inline-flex items-center gap-2.5',
              isBusy && 'opacity-50 cursor-not-allowed hover:scale-100',
            ]"
          >
            <input
              type="file"
              accept=".md,.txt,.markdown"
              :disabled="isBusy"
              @change="handleTranscriptUpload"
              class="hidden"
            />
            <UIcon name="i-lucide-file-text" class="h-5 w-5" />
            <span>Upload transcription (.md)</span>
          </label>
          <UButton
            variant="soft"
            color="neutral"
            icon="i-lucide-sparkles"
            :disabled="isBusy"
            title="Voir les insights du client sélectionné"
            @click="onInsightsClient"
          >
            Insights client
          </UButton>
        </div>
        <div class="flex-1">
          <p class="text-xs text-slate-600 dark:text-slate-400 ml-4">
            <span v-if="uploadedFileName" class="font-medium text-blue-600 dark:text-blue-400">
              Fichier audio: {{ uploadedFileName }}
            </span>
            <span v-else-if="uploadedTranscriptName" class="font-medium text-violet-600 dark:text-violet-400">
              Transcription: {{ uploadedTranscriptName }}
            </span>
            <span v-else>
              Enregistrez, uploadez un <strong class="text-slate-900 dark:text-slate-100">audio</strong> ou une <strong class="text-slate-900 dark:text-slate-100">transcription .md/.txt</strong>.
            </span>
          </p>
        </div>
      </div>
    </div>

    <!-- Zone résultat -->
    <div class="flex-1 overflow-hidden bg-gradient-to-b from-transparent via-slate-50/30 to-transparent dark:via-slate-900/30">
      <Conversation class="h-full">
        <ConversationContent class="mx-auto max-w-5xl px-6 py-8">
          <Message v-if="error && workflowState === 'error'" from="assistant">
            <MessageAvatar src="" name="ER" class="bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/25" />
            <MessageContent>
              <div class="rounded-xl border-2 border-red-200/80 dark:border-red-900/50 bg-gradient-to-br from-red-50/80 to-rose-50/80 dark:from-red-950/30 dark:to-rose-950/30 p-4">
                <div class="flex items-start gap-3">
                  <UIcon name="i-lucide-alert-circle" class="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div class="flex-1">
                    <p class="text-sm font-medium text-red-900 dark:text-red-200">{{ error }}</p>
                    <UButton
                      v-if="canRetry"
                      color="primary"
                      variant="soft"
                      size="sm"
                      icon="i-lucide-refresh-cw"
                      :loading="loadingWorkflow"
                      class="mt-3"
                      @click="retry"
                    >
                      Réessayer
                    </UButton>
                  </div>
                </div>
              </div>
            </MessageContent>
          </Message>

          <Message v-if="loadingWorkflow" from="assistant">
            <MessageAvatar src="" name="AI" class="bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25" />
            <MessageContent>
              <div class="flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-50/80 to-purple-50/80 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200/50 dark:border-blue-800/50 p-4">
                <Loader />
                <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{{ debugMessage }}</span>
              </div>
            </MessageContent>
          </Message>

          <Message v-if="workflowResult" from="assistant">
            <MessageAvatar src="" name="AR" class="bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25" />
            <MessageContent>
              <UAlert
                v-if="workflowResult.status === 'degraded'"
                icon="i-lucide-alert-triangle"
                color="warning"
                variant="soft"
                title="Workflow dégradé"
                description="Certaines étapes ont échoué. Le résumé peut être incomplet. Vérifiez les steps debug."
                class="mb-4"
              />
              <MeetingWorkflowResult :result="workflowResult" />
            </MessageContent>
          </Message>

          <div
            v-if="!workflowResult && !error && !loadingWorkflow"
            class="flex h-full min-h-[400px] items-center justify-center"
          >
            <div class="text-center space-y-4">
              <div class="relative mx-auto h-20 w-20">
                <div class="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-2xl" />
                <div class="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg">
                  <UIcon name="i-lucide-mic" class="h-10 w-10 text-slate-400 dark:text-slate-500" />
                </div>
              </div>
              <p class="text-sm font-medium text-slate-600 dark:text-slate-400">
                Commencez l'enregistrement, uploadez un <strong class="text-slate-900 dark:text-slate-100">audio</strong> ou une <strong class="text-slate-900 dark:text-slate-100">transcription .md/.txt</strong>.
              </p>
            </div>
          </div>
        </ConversationContent>
      </Conversation>
    </div>
  </div>
</template>
