<script setup lang="ts">
import { useAsyncData } from '#app'
import { CodeBlock } from '@/components/ai-elements/code-block'
import { Conversation, ConversationContent } from '@/components/ai-elements/conversation'
import { Loader } from '@/components/ai-elements/loader'
import { Message, MessageAvatar, MessageContent } from '@/components/ai-elements/message'
import { Button } from '@/components/ui/button'
import { useIntervalFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useArianeRecorder } from '~/composables/useArianeRecorder'
import { useContext } from '~/composables/useContext'

definePageMeta({
  // routeRules désactive déjà le SSR, mais on laisse au cas où
  ssr: false,
})

// Contexte global (client/dossier)
const { context } = useContext()

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

// Récupération des métriques d'Ariane AI
const {
  data: metrics,
  refresh: refreshMetrics,
  pending: pendingMetrics,
} = useAsyncData<MetricsData>('ariane-metrics-meeting', () => $fetch<MetricsData>('/api/ariane/metrics'), {
  server: false,
})

// Refresh automatique toutes les 10s
useIntervalFn(() => {
  refreshMetrics()
}, 10000)

const services = computed(() => {
  const m = metrics.value as MetricsData
  if (!m?.agents) return []
  return Object.entries(m.agents).map(([name, data]) => ({
    name,
    ...data,
  }))
})

const arianeStatus = computed(() => {
  if (!services.value.length || pendingMetrics.value) return 'unknown'
  const hasErrors = services.value.some(
    (s) => (s.error_count ?? s.errorCount ?? s.errors ?? 0) > 0,
  )
  return hasErrors ? 'degraded' : 'ok'
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
      return 'Dégradé'
    default:
      return 'Inconnu'
  }
})

const transcript = ref('')
const analysis = ref<any | null>(null)
const error = ref<string | null>(null)
const debugMessage = ref('Prêt à enregistrer.')
const loadingTranscribe = ref(false)
const loadingScribe = ref(false)

const { isRecording, lastBlob, elapsedSeconds, start, stop, resetTimer } =
  useArianeRecorder()

type Status =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'transcribing'
  | 'analyzing'
  | 'done'
  | 'error'

const status = ref<Status>('idle')

const isBusy = computed(
  () =>
    isRecording.value ||
    loadingTranscribe.value ||
    loadingScribe.value ||
    status.value === 'uploading' ||
    status.value === 'transcribing' ||
    status.value === 'analyzing',
)

const formattedTime = computed(() => {
  const s = elapsedSeconds.value
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
})

const statusLabel = computed(() => {
  switch (status.value) {
    case 'idle':
      return 'En attente'
    case 'recording':
      return 'Enregistrement en cours'
    case 'uploading':
      return "Upload de l'audio"
    case 'transcribing':
      return 'Transcription en cours'
    case 'analyzing':
      return 'Analyse par Ariane'
    case 'done':
      return 'Analyse terminée'
    case 'error':
      return 'Erreur'
  }
})

const statusColor = computed(() => {
  switch (status.value) {
    case 'recording':
      return 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 text-red-700 dark:text-red-300 border-red-200/80 dark:border-red-800/50 shadow-sm shadow-red-500/10'
    case 'uploading':
    case 'transcribing':
    case 'analyzing':
      return 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/50 shadow-sm shadow-blue-500/10'
    case 'done':
      return 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/50 shadow-sm shadow-emerald-500/10'
    case 'error':
      return 'bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/50 shadow-sm shadow-rose-500/10'
    default:
      return 'bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/30 dark:to-slate-900/30 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/50 shadow-sm'
  }
})

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1]
        if (base64) {
          resolve(base64)
        } else {
          reject(new Error('Failed to convert blob to base64'))
        }
      } else {
        reject(new Error('Failed to read blob as data URL'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

// Fonction pour formater le résultat de scribe en markdown
const formatScribeToMarkdown = (scribeResult: any): string => {
  if (!scribeResult) return ''

  const parts: string[] = []

  // Résumé
  if (scribeResult.summary || scribeResult.resume) {
    parts.push(`## Résumé\n\n${scribeResult.summary || scribeResult.resume}\n`)
  }

  // Points clés
  if (scribeResult.key_points && Array.isArray(scribeResult.key_points) && scribeResult.key_points.length > 0) {
    parts.push('## Points clés\n\n')
    scribeResult.key_points.forEach((point: string) => {
      parts.push(`- ${point}\n`)
    })
    parts.push('\n')
  }

  // Objectifs client
  if (scribeResult.client_goals && Array.isArray(scribeResult.client_goals) && scribeResult.client_goals.length > 0) {
    parts.push('## Objectifs client\n\n')
    scribeResult.client_goals.forEach((goal: string) => {
      parts.push(`- ${goal}\n`)
    })
    parts.push('\n')
  }

  // Besoins implicites
  if (scribeResult.implicit_needs && Array.isArray(scribeResult.implicit_needs) && scribeResult.implicit_needs.length > 0) {
    parts.push('## Besoins implicites\n\n')
    scribeResult.implicit_needs.forEach((need: string) => {
      parts.push(`- ${need}\n`)
    })
    parts.push('\n')
  }

  // Risques / Objections
  if (scribeResult.risks && Array.isArray(scribeResult.risks) && scribeResult.risks.length > 0) {
    parts.push('## Risques / Objections\n\n')
    scribeResult.risks.forEach((risk: string) => {
      parts.push(`- ${risk}\n`)
    })
    parts.push('\n')
  }

  // Actions proposées
  if (scribeResult.action_items && Array.isArray(scribeResult.action_items) && scribeResult.action_items.length > 0) {
    parts.push('## Actions proposées\n\n')
    scribeResult.action_items.forEach((action: string) => {
      parts.push(`- ${action}\n`)
    })
    parts.push('\n')
  }

  // Questions ouvertes
  if (scribeResult.open_questions && Array.isArray(scribeResult.open_questions) && scribeResult.open_questions.length > 0) {
    parts.push('## Questions ouvertes\n\n')
    scribeResult.open_questions.forEach((question: string) => {
      parts.push(`- ${question}\n`)
    })
    parts.push('\n')
  }

  return parts.join('')
}

const getAudioFormat = (filename: string, mimeType: string): string => {
  // Détection basée sur l'extension
  const ext = filename.toLowerCase().split('.').pop() || ''
  const formatMap: Record<string, string> = {
    'mp3': 'mp3',
    'wav': 'wav',
    'm4a': 'm4a',
    'ogg': 'ogg',
    'webm': 'webm',
    'flac': 'flac',
    'aac': 'aac',
  }

  if (formatMap[ext]) {
    return formatMap[ext]
  }

  // Détection basée sur le MIME type
  if (mimeType.includes('mp3')) return 'mp3'
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('m4a') || mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('flac')) return 'flac'
  if (mimeType.includes('aac')) return 'aac'

  // Par défaut, on essaie webm ou mp3
  return 'mp3'
}

const processAudio = async (blob: Blob, format: string, source: string = 'meeting') => {
  if (blob.size < 800) {
    status.value = 'error'
    error.value = 'Fichier audio trop petit ou vide.'
    debugMessage.value = 'Le fichier semble être vide ou corrompu.'
    return
  }

  loadingTranscribe.value = true

  try {
    status.value = 'uploading'
    debugMessage.value = "Conversion de l'audio (base64)..."
    const base64 = await blobToBase64(blob)

    status.value = 'transcribing'
    debugMessage.value = 'Envoi à Ariane Core pour transcription...'

    const transcribeRes: any = await $fetch('/api/ariane/transcribe', {
      method: 'POST',
      body: {
        audio_base64: base64,
        format: format,
        language: 'fr',
        meta: {
          source,
          label: `capture depuis Nuxt - ${source}`,
          clientId: context.value.clientId || undefined,
          dossierId: context.value.dossierId || undefined,
        },
      },
    })

    transcript.value = transcribeRes.transcript || ''
    loadingTranscribe.value = false

    if (!transcript.value) {
      status.value = 'error'
      error.value = 'Transcription vide.'
      debugMessage.value =
        'Whisper a renvoyé une transcription vide (audio trop bruité ?).'
      return
    }

    status.value = 'analyzing'
    debugMessage.value = "Analyse du meeting par l'agent Scribe..."
    loadingScribe.value = true

    const scribeRes: any = await $fetch('/api/ariane/agent/scribe', {
      method: 'POST',
      body: {
        transcript: transcript.value,
        context: {
          language: 'fr',
          source,
          clientId: context.value.clientId || undefined,
          dossierId: context.value.dossierId || undefined,
        },
        meta: {
          source,
          label: `capture depuis Nuxt - ${source}`,
          clientId: context.value.clientId || undefined,
          dossierId: context.value.dossierId || undefined,
        },
      },
    })

    analysis.value = scribeRes

    // Formater le résultat en markdown et appeler /meetings/import
    try {
      debugMessage.value = 'Formatage en markdown et import dans Ariane...'
      const markdownContent = formatScribeToMarkdown(scribeRes)

      if (markdownContent) {
        console.log('[meeting.vue] Appel à /api/ariane/meetings/import avec contenu markdown:', markdownContent.substring(0, 200) + '...')

        await $fetch('/api/ariane/meetings/import', {
          method: 'POST',
          body: {
            content: markdownContent,
            transcript: transcript.value, // ⚠️ IMPORTANT : la transcription brute
            scribeResult: scribeRes, // Optionnel mais recommandé
            meta: {
              source,
              label: `import depuis Nuxt - ${source}`,
              clientId: context.value.clientId || undefined,
              dossierId: context.value.dossierId || undefined,
            },
          },
        })

        console.log('[meeting.vue] Import réussi ✅')
        debugMessage.value = 'Analyse terminée et importé dans Ariane ✅'
      } else {
        console.warn('[meeting.vue] Aucun contenu markdown à importer')
        debugMessage.value = 'Analyse terminée ✅'
      }
    } catch (importError: any) {
      console.error('[meeting.vue] Erreur lors de l\'import:', importError)
      // On ne bloque pas le flux si l'import échoue, on affiche juste un message
      debugMessage.value = 'Analyse terminée ✅ (import échoué, voir console)'
    }

    status.value = 'done'
  } catch (e: any) {
    console.error(e)
    status.value = 'error'
    error.value = e?.data || e?.message || 'Erreur pendant la transcription.'
    debugMessage.value = 'Erreur dans le pipeline transcription/analyse.'
  } finally {
    loadingTranscribe.value = false
    loadingScribe.value = false
  }
}

const startRecording = async () => {
  error.value = null
  transcript.value = ''
  analysis.value = null
  uploadedFileName.value = null
  status.value = 'recording'
  debugMessage.value = "Demande d'accès au micro..."

  try {
    resetTimer()
    await start()
    debugMessage.value = 'Enregistrement en cours. Parlez normalement.'
  } catch (e: any) {
    status.value = 'error'
    error.value = e?.message || "Impossible de démarrer l'enregistrement"
    debugMessage.value = "Erreur lors de l'accès au micro."
  }
}

const stopRecording = async () => {
  debugMessage.value = "Arrêt de l'enregistrement..."
  await stop()
  status.value = 'uploading'
  debugMessage.value = "Préparation de l'audio pour envoi..."
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

  // Vérifier que c'est un fichier audio
  if (!file.type.startsWith('audio/')) {
    status.value = 'error'
    error.value = 'Le fichier sélectionné n\'est pas un fichier audio.'
    debugMessage.value = 'Veuillez sélectionner un fichier audio (mp3, wav, m4a, etc.)'
    target.value = '' // Réinitialiser l'input
    return
  }

  // Réinitialiser l'état
  error.value = null
  transcript.value = ''
  analysis.value = null
  uploadedFileName.value = file.name

  // Détecter le format
  const format = getAudioFormat(file.name, file.type)

  // Traiter le fichier
  await processAudio(file, format, 'meeting-upload')

  // Réinitialiser l'input pour permettre de re-uploader le même fichier
  target.value = ''
}
</script>

<template>
  <div class="flex h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
    <!-- Header -->
    <header class="relative border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/80 px-6 py-6 shadow-sm">
      <div class="mx-auto max-w-5xl">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <h1 class="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-100 dark:via-slate-200 dark:to-slate-100 bg-clip-text text-transparent">
              Meeting Scribe
            </h1>
            <p class="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Enregistrez votre réunion, laissez Whisper transcrire et Ariane structurer
              le tout comme un consultant stratégique professionnel.
            </p>
          </div>
          <div class="flex-shrink-0">
            <div class="relative group">
              <div class="absolute inset-0 rounded-xl bg-gradient-to-r blur-xl opacity-50 transition-all duration-300" :class="arianeStatusColor"></div>
              <div class="relative rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 px-4 py-2 shadow-lg hover:shadow-xl transition-all duration-300">
                <div class="flex items-center gap-2.5">
                  <div
                    class="relative h-2.5 w-2.5 rounded-full ring-2 transition-all duration-300"
                    :class="arianeStatusBadgeColor"
                  >
                    <span
                      v-if="arianeStatus === 'ok' || arianeStatus === 'degraded'"
                      class="absolute inset-0 h-2.5 w-2.5 rounded-full animate-ping opacity-75"
                      :class="arianeStatusBadgeColor"
                    ></span>
                  </div>
                  <div class="flex flex-col">
                    <span class="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">Ariane AI</span>
                    <span
                      class="text-[10px] font-medium leading-tight transition-colors duration-300"
                      :class="{
                        'text-emerald-600 dark:text-emerald-400': arianeStatus === 'ok',
                        'text-amber-600 dark:text-amber-400': arianeStatus === 'degraded',
                        'text-slate-500 dark:text-slate-400': arianeStatus === 'unknown'
                      }"
                    >
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

    <!-- Status Bar -->
    <div class="border-b border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 via-white/50 to-slate-50/50 dark:from-slate-900/50 dark:via-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm px-6 py-3">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="relative">
            <span
              class="inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 text-xs font-semibold shadow-sm transition-all duration-200"
              :class="statusColor"
            >
              <span
                v-if="status === 'recording'"
                class="relative h-2.5 w-2.5 rounded-full bg-red-500"
              >
                <span class="absolute inset-0 h-2.5 w-2.5 rounded-full bg-red-500 animate-ping opacity-75"></span>
              </span>
              <span
                v-else-if="isBusy"
                class="relative h-2.5 w-2.5 rounded-full bg-blue-500"
              >
                <span class="absolute inset-0 h-2.5 w-2.5 rounded-full bg-blue-500 animate-ping opacity-75"></span>
              </span>
              <span
                v-else-if="status === 'done'"
                class="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900"
              />
              <span
                v-else-if="status === 'error'"
                class="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200 dark:ring-rose-900"
              />
              <span v-else class="h-2.5 w-2.5 rounded-full bg-slate-400"></span>
              {{ statusLabel }}
            </span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-400 font-medium">
            {{ debugMessage }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <div class="relative group">
            <div class="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-pink-500/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div class="relative inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-xs font-mono font-semibold text-white shadow-lg shadow-blue-500/25 transition-transform duration-200 group-hover:scale-105">
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span class="opacity-90">Durée</span>
              <span class="font-bold">{{ formattedTime }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Controls -->
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
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
              </svg>
              <span>Commencer l'enregistrement</span>
            </span>
            <div class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
          </Button>
          <Button
            v-else
            @click="stopRecording"
            class="group relative overflow-hidden bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-red-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-red-500/40 hover:scale-105"
          >
            <span class="relative z-10 flex items-center gap-2.5">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10h6v4H9z"></path>
              </svg>
              <span>Arrêter l'enregistrement</span>
            </span>
            <div class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
          </Button>

          <!-- Séparateur -->
          <div class="h-8 w-px bg-slate-300 dark:bg-slate-700"></div>

          <!-- Upload Button -->
          <label
            :class="[
              'group relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 cursor-pointer inline-flex items-center gap-2.5',
              isBusy && 'opacity-50 cursor-not-allowed hover:scale-100'
            ]"
          >
            <input
              type="file"
              accept="audio/*"
              :disabled="isBusy"
              @change="handleFileUpload"
              class="hidden"
            />
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            <span>Uploader un fichier audio</span>
            <div class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
          </label>
        </div>
        <div class="flex-1">
          <p class="text-xs text-slate-600 dark:text-slate-400 ml-4">
            <span v-if="uploadedFileName" class="font-medium text-blue-600 dark:text-blue-400">
              Fichier: {{ uploadedFileName }}
            </span>
            <span v-else>
              Enregistrez depuis le micro ou
              <strong class="text-slate-900 dark:text-slate-100">uploadez</strong> un fichier audio existant.
            </span>
          </p>
        </div>
      </div>
    </div>

    <!-- Conversation Area -->
    <div class="flex-1 overflow-hidden bg-gradient-to-b from-transparent via-slate-50/30 to-transparent dark:via-slate-900/30">
      <Conversation class="h-full">
        <ConversationContent class="mx-auto max-w-5xl px-6 py-8">
          <!-- Error Message -->
          <Message v-if="error" from="assistant">
            <MessageAvatar
              src=""
              name="ER"
              class="bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/25"
            />
            <MessageContent>
              <div class="group relative overflow-hidden rounded-xl border-2 border-red-200/80 dark:border-red-900/50 bg-gradient-to-br from-red-50/80 to-rose-50/80 dark:from-red-950/30 dark:to-rose-950/30 backdrop-blur-sm p-4 shadow-lg shadow-red-500/10">
                <div class="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div class="relative flex items-start gap-3">
                  <svg class="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <p class="text-sm font-medium text-red-900 dark:text-red-200 leading-relaxed">
                    {{ error }}
                  </p>
                </div>
              </div>
            </MessageContent>
          </Message>

          <!-- Loading States -->
          <Message v-if="loadingTranscribe || loadingScribe" from="assistant">
            <MessageAvatar src="" name="AI" class="bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25" />
            <MessageContent>
              <div class="flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-50/80 to-purple-50/80 dark:from-blue-950/30 dark:to-purple-950/30 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50 p-4 shadow-md">
                <Loader />
                <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{{ debugMessage }}</span>
              </div>
            </MessageContent>
          </Message>

          <!-- Transcript Message -->
          <Message v-if="transcript" from="assistant">
            <MessageAvatar src="" name="WH" class="bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25" />
            <MessageContent>
              <div class="space-y-3">
                <div class="flex items-center gap-2">
                  <svg class="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">Transcription brute</h3>
                </div>
                <div class="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/80 dark:from-slate-800 dark:to-slate-900/80 border border-slate-200/60 dark:border-slate-700/60 p-4 shadow-lg backdrop-blur-sm">
                  <div class="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-indigo-500 to-purple-600"></div>
                  <pre class="whitespace-pre-wrap font-mono text-xs text-slate-700 dark:text-slate-300 leading-relaxed pl-3">{{ transcript }}</pre>
                </div>
              </div>
            </MessageContent>
          </Message>

          <!-- Analysis Message -->
          <Message v-if="analysis" from="assistant">
            <MessageAvatar src="" name="AR" class="bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25" />
            <MessageContent>
              <div class="space-y-5">
                <div class="flex items-center gap-2">
                  <svg class="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <h3 class="text-base font-bold bg-gradient-to-r from-emerald-700 to-teal-700 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                    Analyse Ariane – Vue Consultant
                  </h3>
                </div>

                <div class="grid gap-4 md:grid-cols-2">
                  <div class="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-800 dark:to-slate-900/80 p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                    <div class="absolute top-0 right-0 h-20 w-20 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-2xl"></div>
                    <div class="relative">
                      <div class="flex items-center gap-2 mb-3">
                        <div class="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                          <svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                          </svg>
                        </div>
                        <h4 class="text-sm font-bold text-slate-900 dark:text-slate-100">Résumé</h4>
                      </div>
                      <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {{ analysis.summary || analysis.resume || '—' }}
                      </p>
                    </div>
                  </div>

                  <div class="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-800 dark:to-slate-900/80 p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                    <div class="absolute top-0 right-0 h-20 w-20 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full blur-2xl"></div>
                    <div class="relative">
                      <div class="flex items-center gap-2 mb-3">
                        <div class="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                          <svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                          </svg>
                        </div>
                        <h4 class="text-sm font-bold text-slate-900 dark:text-slate-100">Objectifs client</h4>
                      </div>
                      <ul class="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        <li v-for="(item, i) in analysis.client_goals || analysis.objectifs || []" :key="i" class="flex items-start gap-2">
                          <span class="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                          <span class="leading-relaxed">{{ item }}</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div class="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-800 dark:to-slate-900/80 p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                    <div class="absolute top-0 right-0 h-20 w-20 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full blur-2xl"></div>
                    <div class="relative">
                      <div class="flex items-center gap-2 mb-3">
                        <div class="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
                          <svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                          </svg>
                        </div>
                        <h4 class="text-sm font-bold text-slate-900 dark:text-slate-100">Besoins implicites</h4>
                      </div>
                      <ul class="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        <li v-for="(item, i) in analysis.implicit_needs || []" :key="i" class="flex items-start gap-2">
                          <span class="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                          <span class="leading-relaxed">{{ item }}</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div class="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-800 dark:to-slate-900/80 p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                    <div class="absolute top-0 right-0 h-20 w-20 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 rounded-full blur-2xl"></div>
                    <div class="relative">
                      <div class="flex items-center gap-2 mb-3">
                        <div class="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-md">
                          <svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                          </svg>
                        </div>
                        <h4 class="text-sm font-bold text-slate-900 dark:text-slate-100">Actions proposées</h4>
                      </div>
                      <ul class="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        <li v-for="(item, i) in analysis.action_items || analysis.actions || []" :key="i" class="flex items-start gap-2">
                          <span class="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-500 flex-shrink-0"></span>
                          <span class="leading-relaxed">{{ item }}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <details class="group mt-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-sm overflow-hidden transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600">
                  <summary class="cursor-pointer px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center gap-2">
                    <svg class="h-4 w-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                    Voir le JSON complet (debug)
                  </summary>
                  <div class="px-4 pb-4 pt-2">
                    <CodeBlock
                      :code="JSON.stringify(analysis, null, 2)"
                      language="json"
                      class="text-xs rounded-lg"
                    />
                  </div>
                </details>
              </div>
            </MessageContent>
          </Message>

          <!-- Empty State -->
          <div
            v-if="!transcript && !analysis && !error && !isBusy"
            class="flex h-full min-h-[400px] items-center justify-center"
          >
            <div class="text-center space-y-4">
              <div class="relative mx-auto h-20 w-20">
                <div class="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-2xl"></div>
                <div class="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg">
                  <svg class="h-10 w-10 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                  </svg>
                </div>
              </div>
              <p class="text-sm font-medium text-slate-600 dark:text-slate-400">
                Cliquez sur <strong class="text-slate-900 dark:text-slate-100">"Commencer l'enregistrement"</strong> pour démarrer
              </p>
            </div>
          </div>
        </ConversationContent>
      </Conversation>
    </div>
  </div>
</template>
