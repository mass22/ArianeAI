<script setup lang="ts">
import type { IngestionResult } from '~/types/ariane'
import { parseCsvPreview, checkLinkedInColumns } from '~/lib/importLeadsUtils'
import FileDropzone from './FileDropzone.vue'
import UrlsTextarea from './UrlsTextarea.vue'
import ImportResultSummary from './ImportResultSummary.vue'

const emit = defineEmits<{
  success: []
}>()

const open = defineModel<boolean>('open', { default: false })
const { ingestLinkedinCsv, ingestLinkedinUrls, ingestGenericCsv } = useArianeApi()
const toast = useToast()

const activeTab = ref<'linkedin-csv' | 'linkedin-urls' | 'advanced'>('linkedin-csv')
const file = ref<File | null>(null)
const urlsText = ref('')
const loading = ref(false)
const result = ref<IngestionResult | null>(null)
const validationWarnings = ref<string[]>([])

const tabItems = [
  { value: 'linkedin-csv', label: 'LinkedIn CSV' },
  { value: 'linkedin-urls', label: 'LinkedIn URLs' },
  { value: 'advanced', label: 'Avancé' },
]

// Client-side CSV preview (best effort)
const csvPreview = ref<string[][]>([])

watch(file, async (f) => {
  validationWarnings.value = []
  if (!f) {
    csvPreview.value = []
    return
  }
  if (activeTab.value === 'linkedin-urls' && f.name.endsWith('.txt')) {
    const text = await f.text()
    urlsText.value = text
    return
  }
  csvPreview.value = await parseCsvPreview(f)
  if (csvPreview.value.length > 0) {
    const warnings = checkLinkedInColumns(csvPreview.value[0])
    validationWarnings.value = warnings
  }
})

const urlList = computed(() => {
  return urlsText.value
    .split(/[\n,;]+/)
    .map((u) => u.trim())
    .filter(Boolean)
})

const canImport = computed(() => {
  if (activeTab.value === 'linkedin-csv' || activeTab.value === 'advanced') {
    return !!file.value
  }
  return urlList.value.length > 0
})

async function doImport() {
  if (!canImport.value || loading.value) return
  loading.value = true
  result.value = null

  const source = activeTab.value
  const filename = file.value?.name
  const size = file.value ? file.value.size : urlList.value.length

  if (import.meta.dev) {
    console.debug('[IMPORT] start', { source, filename, size })
  }

  const startAt = Date.now()
  try {
    let res: IngestionResult | null = null
    let ingestError: string | null = null

    if (activeTab.value === 'linkedin-csv' && file.value) {
      const out = await ingestLinkedinCsv(file.value)
      res = out.data ?? null
      ingestError = out.error ?? null
    } else if (activeTab.value === 'advanced' && file.value) {
      const out = await ingestGenericCsv(file.value)
      res = out.data ?? null
      ingestError = out.error ?? null
    } else if (activeTab.value === 'linkedin-urls') {
      const out = await ingestLinkedinUrls(urlList.value)
      res = out.data ?? null
      ingestError = out.error ?? null
    }

    if (ingestError) {
      if (import.meta.dev) {
        console.error('[IMPORT] error', { message: ingestError, details: { source } })
      }
    } else if (res) {
      const duration_ms = res.duration_ms ?? Date.now() - startAt
      if (import.meta.dev) {
        console.debug('[IMPORT] success', {
          created: res.created,
          merged: res.merged,
          skipped: res.skipped,
          errors: res.errors,
          duration_ms,
        })
      }
      result.value = res
      const total = res.created + res.merged
      if (res.errors > 0) {
        toast.add({
          title: 'Import avec avertissements',
          description: `${total} lead(s) traités, ${res.errors} erreur(s)`,
          color: 'warning',
        })
      } else {
        toast.add({
          title: 'Import terminé',
          description: `${res.created} créés, ${res.merged} fusionnés`,
          color: 'success',
        })
      }
      if (total > 0) emit('success')
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const details = err instanceof Error ? { stack: err.stack } : {}
    if (import.meta.dev) {
      console.error('[IMPORT] error', { message, details })
    }
    throw err
  } finally {
    loading.value = false
  }
}

function reset() {
  file.value = null
  urlsText.value = ''
  result.value = null
  validationWarnings.value = []
  csvPreview.value = []
  activeTab.value = 'linkedin-csv'
}

function close() {
  open.value = false
  reset()
}

watch(open, (v) => {
  if (!v) reset()
})
</script>

<template>
  <UModal v-model:open="open" title="Import leads" :ui="{ content: 'max-w-xl' }">
    <slot />
    <template #body="{ close: closeSlot }">
      <div class="space-y-4">
        <UTabs v-model="activeTab" :items="tabItems" />

        <!-- LinkedIn CSV -->
        <div v-if="activeTab === 'linkedin-csv'" class="space-y-4">
          <FileDropzone v-model="file" accept=".csv" label="Déposez connections.csv" hint="Export LinkedIn Connections" />
          <div v-if="validationWarnings.length" class="rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            {{ validationWarnings[0] }}
          </div>
          <div v-if="csvPreview.length" class="text-xs">
            <p class="font-medium mb-1">Aperçu (10 premières lignes)</p>
            <div class="overflow-x-auto max-h-32 overflow-y-auto rounded border">
              <table class="min-w-full text-[10px]">
                <tbody>
                  <tr v-for="(row, i) in csvPreview" :key="i" class="border-b last:border-0">
                    <td v-for="(cell, j) in row" :key="j" class="px-2 py-1 truncate max-w-[120px]" :title="cell">
                      {{ cell }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- LinkedIn URLs -->
        <div v-if="activeTab === 'linkedin-urls'" class="space-y-4">
          <UrlsTextarea v-model="urlsText" placeholder="https://linkedin.com/in/..." />
          <FileDropzone
            v-model="file"
            accept=".txt"
            label="Ou déposez un fichier .txt d'URLs"
            hint="Un URL par ligne"
          />
        </div>

        <!-- Advanced -->
        <div v-if="activeTab === 'advanced'" class="space-y-4">
          <FileDropzone v-model="file" accept=".csv" label="CSV générique" hint="Format libre" />
        </div>

        <!-- Result -->
        <ImportResultSummary v-if="result" :result="result" />

        <div class="flex gap-2 justify-end pt-2">
          <UButton variant="outline" color="neutral" label="Fermer" @click="closeSlot" />
          <UButton
            label="Importer"
            :loading="loading"
            :disabled="!canImport"
            @click="doImport"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
