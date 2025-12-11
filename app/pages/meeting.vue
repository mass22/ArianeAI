<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useArianeRecorder } from '~/composables/useArianeRecorder'

definePageMeta({
  // routeRules désactive déjà le SSR, mais on laisse au cas où
  ssr: false,
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
      return 'Upload de l’audio'
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
      return 'bg-red-100 text-red-700 border-red-300'
    case 'uploading':
    case 'transcribing':
    case 'analyzing':
      return 'bg-blue-100 text-blue-700 border-blue-300'
    case 'done':
      return 'bg-emerald-100 text-emerald-700 border-emerald-300'
    case 'error':
      return 'bg-rose-100 text-rose-700 border-rose-300'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300'
  }
})

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

const startRecording = async () => {
  error.value = null
  transcript.value = ''
  analysis.value = null
  status.value = 'recording'
  debugMessage.value = 'Demande d’accès au micro...'

  try {
    resetTimer()
    await start()
    debugMessage.value = 'Enregistrement en cours. Parlez normalement.'
  } catch (e: any) {
    status.value = 'error'
    error.value = e?.message || 'Impossible de démarrer l’enregistrement'
    debugMessage.value = 'Erreur lors de l’accès au micro.'
  }
}

const stopRecording = async () => {
  debugMessage.value = 'Arrêt de l’enregistrement...'
  await stop()
  status.value = 'uploading'
  debugMessage.value = 'Préparation de l’audio pour envoi...'
}

watch(lastBlob, async (blob) => {
  if (!blob) return

  // diagnostic de base
  console.log('BLOB SIZE =', blob.size)

  if (blob.size < 800) {
    status.value = 'error'
    error.value = 'Aucun son détecté (blob trop petit).'
    debugMessage.value =
      'Le navigateur n’a presque rien capté. Vérifie le micro / permissions.'
    return
  }

  loadingTranscribe.value = true

  try {
    status.value = 'uploading'
    debugMessage.value = 'Conversion de l’audio (base64)...'
    const base64 = await blobToBase64(blob)

    status.value = 'transcribing'
    debugMessage.value = 'Envoi à Ariane Core pour transcription...'

    const transcribeRes: any = await $fetch('/api/ariane/transcribe', {
      method: 'POST',
      body: {
        audio_base64: base64,
        format: 'webm',
        language: 'fr',
        meta: { source: 'meeting', label: 'capture depuis Nuxt' },
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
    debugMessage.value = 'Analyse du meeting par l’agent Scribe...'
    loadingScribe.value = true

    const scribeRes: any = await $fetch('/api/ariane/agent/scribe', {
      method: 'POST',
      body: {
        transcript: transcript.value,
        context: { language: 'fr', source: 'meeting' },
      },
    })

    analysis.value = scribeRes
    status.value = 'done'
    debugMessage.value = 'Analyse terminée ✅'
  } catch (e: any) {
    console.error(e)
    status.value = 'error'
    error.value = e?.data || e?.message || 'Erreur pendant la transcription.'
    debugMessage.value = 'Erreur dans le pipeline transcription/analyse.'
  } finally {
    loadingTranscribe.value = false
    loadingScribe.value = false
  }
})
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-8 space-y-8">
    <!-- Header -->
    <header class="space-y-2">
      <h1 class="text-3xl font-semibold tracking-tight">
        Ariane – Meeting Scribe
      </h1>
      <p class="text-sm text-slate-500">
        Enregistre ton meeting, laisse Whisper transcrire et Ariane structurer
        tout ça comme un vrai consultant stratégique.
      </p>
    </header>

    <!-- Top status & timer -->
    <section
      class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3"
    >
      <div class="flex items-center gap-3">
        <span
          class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
          :class="statusColor"
        >
          <span
            v-if="status === 'recording'"
            class="h-2 w-2 rounded-full bg-red-500 animate-pulse"
          />
          <span
            v-else-if="isBusy"
            class="h-2 w-2 rounded-full bg-blue-500 animate-pulse"
          />
          <span
            v-else-if="status === 'done'"
            class="h-2 w-2 rounded-full bg-emerald-500"
          />
          <span
            v-else-if="status === 'error'"
            class="h-2 w-2 rounded-full bg-rose-500"
          />
          {{ statusLabel }}
        </span>

        <p class="text-xs text-slate-500">
          {{ debugMessage }}
        </p>
      </div>

      <div class="flex items-center gap-3">
        <div
          class="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-mono text-slate-50"
        >
          <span class="opacity-60">Durée</span>
          <span>{{ formattedTime }}</span>
        </div>
      </div>
    </section>

    <!-- Controls -->
    <section class="flex items-center gap-4">
      <button
        v-if="!isRecording"
        class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="isBusy"
        @click="startRecording"
      >
        🎙
        <span>Commencer l’enregistrement</span>
      </button>

      <button
        v-else
        class="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
        @click="stopRecording"
      >
        ⏹
        <span>Arrêter</span>
      </button>

      <p class="text-xs text-slate-400">
        Laisse tourner pendant tout le meeting, puis clique sur
        <strong>Arrêter</strong>.
      </p>
    </section>

    <!-- Error -->
    <p v-if="error" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
      {{ error }}
    </p>

    <!-- Transcript -->
    <section v-if="transcript" class="space-y-2">
      <h2 class="text-sm font-semibold text-slate-800">Transcription brute</h2>
      <div
        class="rounded-xl bg-slate-900 p-3 text-xs text-slate-100 shadow-inner max-h-72 overflow-auto"
      >
        <pre class="whitespace-pre-wrap font-mono text-[11px]">
{{ transcript }}
        </pre>
      </div>
    </section>

    <!-- Analysis -->
    <section v-if="analysis" class="space-y-3">
      <h2 class="text-sm font-semibold text-slate-800">
        Analyse Ariane – vue consultant
      </h2>

      <div
        class="grid gap-3 md:grid-cols-2"
      >
        <div class="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <h3 class="text-xs font-semibold text-slate-700">Résumé</h3>
          <p class="text-xs text-slate-600">
            {{ analysis.summary || analysis.resume || '—' }}
          </p>
        </div>

        <div class="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <h3 class="text-xs font-semibold text-slate-700">Objectifs client</h3>
          <ul class="list-disc pl-4 text-xs text-slate-600">
            <li v-for="(item, i) in analysis.client_goals || analysis.objectifs || []" :key="i">
              {{ item }}
            </li>
          </ul>
        </div>

        <div class="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <h3 class="text-xs font-semibold text-slate-700">Besoins implicites</h3>
          <ul class="list-disc pl-4 text-xs text-slate-600">
            <li v-for="(item, i) in analysis.implicit_needs || []" :key="i">
              {{ item }}
            </li>
          </ul>
        </div>

        <div class="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <h3 class="text-xs font-semibold text-slate-700">Actions proposées</h3>
          <ul class="list-disc pl-4 text-xs text-slate-600">
            <li v-for="(item, i) in analysis.action_items || analysis.actions || []" :key="i">
              {{ item }}
            </li>
          </ul>
        </div>
      </div>

      <details class="mt-2 text-xs">
        <summary class="cursor-pointer text-slate-500">
          Voir le JSON complet (debug)
        </summary>
        <pre
          class="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] text-slate-100"
        >
{{ analysis }}
        </pre>
      </details>
    </section>
  </div>
</template>
