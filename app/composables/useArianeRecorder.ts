// composables/useArianeRecorder.ts
import { useIntervalFn } from '@vueuse/core'
import { computed, ref } from 'vue'

export function useArianeRecorder() {
  const stream = ref<MediaStream | null>(null)
  const recorder = ref<MediaRecorder | null>(null)
  const chunks = ref<BlobPart[]>([])

  const isRecording = ref(false)
  const elapsedMs = ref(0)

  // timer (tick toutes les secondes)
  const { pause: pauseTimer, resume: startTimer } = useIntervalFn(
    () => {
      if (isRecording.value) {
        elapsedMs.value += 1000
      }
    },
    1000,
    { immediate: false },
  )

  const elapsedSeconds = computed(() => Math.floor(elapsedMs.value / 1000))

  const lastBlob = ref<Blob | null>(null)

  async function ensureStream() {
    if (stream.value) return

    const userStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    })

    stream.value = userStream
  }

  async function start() {
    await ensureStream()

    if (!stream.value) {
      throw new Error('Aucun flux audio disponible')
    }

    chunks.value = []
    lastBlob.value = null
    elapsedMs.value = 0

    recorder.value = new MediaRecorder(stream.value, {
      mimeType: 'audio/webm;codecs=opus',
    })

    recorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.value.push(event.data)
      }
    }

    recorder.value.onstop = () => {
      if (!chunks.value.length) {
        lastBlob.value = null
        return
      }
      lastBlob.value = new Blob(chunks.value, { type: 'audio/webm' })
    }

    recorder.value.start()
    isRecording.value = true
    startTimer()
  }

  async function stop() {
    if (!recorder.value || !isRecording.value) return

    recorder.value.stop()
    isRecording.value = false
    pauseTimer()
  }

  function resetTimer() {
    elapsedMs.value = 0
  }

  return {
    isRecording,
    lastBlob,
    elapsedSeconds,
    start,
    stop,
    resetTimer,
  }
}
