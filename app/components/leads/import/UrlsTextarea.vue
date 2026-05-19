<script setup lang="ts">
const model = defineModel<string>({ default: '' })

defineProps<{
  placeholder?: string
  rows?: number
}>()

const urls = computed({
  get: () => model.value,
  set: (v: string) => { model.value = v },
})

const urlList = computed(() => {
  return model.value
    .split(/[\n,;]+/)
    .map((u) => u.trim())
    .filter(Boolean)
})

const urlCount = computed(() => urlList.value.length)
</script>

<template>
  <div class="space-y-2">
    <textarea
      v-model="urls"
      :placeholder="placeholder ?? 'Une URL par ligne ou séparées par des virgules'"
      :rows="rows ?? 6"
      class="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
    />
    <p v-if="urlCount > 0" class="text-xs text-muted">
      {{ urlCount }} URL(s) détectée(s)
    </p>
  </div>
</template>
