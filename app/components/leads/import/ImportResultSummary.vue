<script setup lang="ts">
import type { IngestionResult } from '~/types/ariane'

defineProps<{
  result: IngestionResult
}>()
</script>

<template>
  <div class="rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3">
    <div class="flex flex-wrap gap-4 text-sm">
      <span class="flex items-center gap-1">
        <span class="font-medium text-success">Créés:</span>
        {{ result.created }}
      </span>
      <span class="flex items-center gap-1">
        <span class="font-medium text-primary">Fusionnés:</span>
        {{ result.merged }}
      </span>
      <span class="flex items-center gap-1">
        <span class="font-medium text-muted">Ignorés:</span>
        {{ result.skipped }}
      </span>
      <span v-if="result.errors > 0" class="flex items-center gap-1">
        <span class="font-medium text-error">Erreurs:</span>
        {{ result.errors }}
      </span>
      <span class="text-muted">
        {{ result.duration_ms }} ms
      </span>
    </div>
    <div
      v-if="result.error_samples?.length"
      class="mt-2 space-y-1"
    >
      <p class="text-xs font-medium text-error">
        Exemples d'erreurs (max 10) :
      </p>
      <ul class="text-xs space-y-1 max-h-24 overflow-y-auto">
        <li
          v-for="(s, i) in result.error_samples?.slice(0, 10)"
          :key="i"
          class="text-slate-600 dark:text-slate-400"
        >
          <span v-if="s.row != null">Ligne {{ s.row }}:</span>
          {{ s.message }}
          <span v-if="s.value" class="italic">"{{ s.value }}"</span>
        </li>
      </ul>
    </div>
  </div>
</template>
