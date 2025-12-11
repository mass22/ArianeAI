<script setup lang="ts">
const transcript = ref('')
const context = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const result = ref<any | null>(null)

const runScribe = async () => {
  error.value = null
  result.value = null

  if (!transcript.value.trim()) {
    error.value = 'Merci de coller une transcription.'
    return
  }

  loading.value = true

  try {
    const { data, error: fetchError } = await useFetch('/api/ai/scribe', {
      method: 'POST',
      body: {
        transcript: transcript.value,
        context: context.value || undefined,
      },
    })

    if (fetchError.value) {
      throw fetchError.value
    }

    result.value = data.value
  } catch (e: any) {
    error.value = e?.message ?? 'Erreur lors de l’appel à Scribe.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen p-6 md:p-10 bg-slate-950 text-slate-100">
    <div class="max-w-5xl mx-auto space-y-6">
      <header class="space-y-1">
        <h1 class="text-3xl font-bold">ArianeAI – Agent Scribe</h1>
        <p class="text-sm text-slate-400">
          Colle la transcription d’un meeting, Scribe te renvoie un résumé stratégique structuré.
        </p>
      </header>

      <section class="grid gap-6 md:grid-cols-[2fr,3fr]">
        <!-- Colonne gauche : input -->
        <div class="space-y-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-slate-300">
              Contexte (optionnel)
            </label>
            <textarea
              v-model="context"
              rows="3"
              class="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ex : Meeting découverte avec client SaaS B2B, sujet : refonte produit + IA locale..."
            />
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-slate-300">
              Transcription brute du meeting
            </label>
            <textarea
              v-model="transcript"
              rows="14"
              class="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Colle ici la transcription générée par Whisper..."
            />
          </div>

          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            :disabled="loading || !transcript.trim()"
            @click="runScribe"
          >
            <span v-if="loading">Analyse en cours…</span>
            <span v-else>Lancer l’analyse Scribe</span>
          </button>

          <p v-if="error" class="text-sm text-red-400">
            {{ error }}
          </p>
        </div>

        <!-- Colonne droite : output -->
        <div class="space-y-3">
          <h2 class="text-lg font-semibold">Résultat</h2>

          <div
            v-if="!result"
            class="rounded-md border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-500"
          >
            Colle une transcription à gauche et lance l’analyse pour voir le résumé structuré ici.
          </div>

          <div
            v-else
            class="space-y-4"
          >
            <!-- Résumé lisible -->
            <div class="rounded-md border border-slate-700 bg-slate-900 p-4 space-y-2">
              <h3 class="text-sm font-semibold text-emerald-400">Résumé</h3>
              <p class="text-sm whitespace-pre-line">
                {{ result.summary || '—' }}
              </p>
            </div>

            <!-- Points clés, actions, etc. -->
            <div class="grid gap-3 md:grid-cols-2">
              <div class="rounded-md border border-slate-700 bg-slate-900 p-3 space-y-1">
                <h3 class="text-sm font-semibold text-slate-200">Points clés</h3>
                <ul class="list-disc list-inside text-xs text-slate-300 space-y-1">
                  <li v-for="(p, i) in result.key_points || []" :key="'kp-' + i">
                    {{ p }}
                  </li>
                  <li v-if="!result.key_points?.length" class="text-slate-500">—</li>
                </ul>
              </div>

              <div class="rounded-md border border-slate-700 bg-slate-900 p-3 space-y-1">
                <h3 class="text-sm font-semibold text-slate-200">Objectifs client</h3>
                <ul class="list-disc list-inside text-xs text-slate-300 space-y-1">
                  <li v-for="(p, i) in result.client_goals || []" :key="'cg-' + i">
                    {{ p }}
                  </li>
                  <li v-if="!result.client_goals?.length" class="text-slate-500">—</li>
                </ul>
              </div>

              <div class="rounded-md border border-slate-700 bg-slate-900 p-3 space-y-1">
                <h3 class="text-sm font-semibold text-slate-200">Besoins implicites</h3>
                <ul class="list-disc list-inside text-xs text-slate-300 space-y-1">
                  <li v-for="(p, i) in result.implicit_needs || []" :key="'in-' + i">
                    {{ p }}
                  </li>
                  <li v-if="!result.implicit_needs?.length" class="text-slate-500">—</li>
                </ul>
              </div>

              <div class="rounded-md border border-slate-700 bg-slate-900 p-3 space-y-1">
                <h3 class="text-sm font-semibold text-slate-200">Risques / Objections</h3>
                <ul class="list-disc list-inside text-xs text-slate-300 space-y-1">
                  <li v-for="(p, i) in result.risks || []" :key="'rk-' + i">
                    {{ p }}
                  </li>
                  <li v-if="!result.risks?.length" class="text-slate-500">—</li>
                </ul>
              </div>

              <div class="rounded-md border border-slate-700 bg-slate-900 p-3 space-y-1">
                <h3 class="text-sm font-semibold text-slate-200">Actions proposées</h3>
                <ul class="list-disc list-inside text-xs text-slate-300 space-y-1">
                  <li v-for="(p, i) in result.action_items || []" :key="'ai-' + i">
                    {{ p }}
                  </li>
                  <li v-if="!result.action_items?.length" class="text-slate-500">—</li>
                </ul>
              </div>

              <div class="rounded-md border border-slate-700 bg-slate-900 p-3 space-y-1">
                <h3 class="text-sm font-semibold text-slate-200">Questions ouvertes</h3>
                <ul class="list-disc list-inside text-xs text-slate-300 space-y-1">
                  <li v-for="(p, i) in result.open_questions || []" :key="'oq-' + i">
                    {{ p }}
                  </li>
                  <li v-if="!result.open_questions?.length" class="text-slate-500">—</li>
                </ul>
              </div>
            </div>

            <!-- JSON brut pour debug ou export -->
            <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
              <h3 class="text-xs font-semibold text-slate-500 mb-1">
                JSON brut (pour debug / export)
              </h3>
              <pre class="text-[11px] text-emerald-300 whitespace-pre-wrap overflow-x-auto">
{{ JSON.stringify(result, null, 2) }}
              </pre>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
