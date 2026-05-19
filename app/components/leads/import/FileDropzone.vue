<script setup lang="ts">
const model = defineModel<File | null>()
const props = withDefaults(
  defineProps<{
    accept?: string
    label?: string
    hint?: string
  }>(),
  {
    accept: '.csv,.txt',
    label: 'Déposez un fichier ou cliquez pour parcourir',
    hint: 'CSV ou TXT',
  },
)

const isDragOver = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

function onDrop(e: DragEvent) {
  isDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    model.value = file
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    model.value = file
  }
  input.value = ''
}

function browse() {
  inputRef.value?.click()
}
</script>

<template>
  <div
    class="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
    :class="[
      isDragOver ? 'border-primary bg-primary/5' : 'border-slate-300 dark:border-slate-600 hover:border-slate-400',
    ]"
    @drop.prevent="onDrop"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @click="browse"
  >
    <input
      ref="inputRef"
      type="file"
      :accept="accept"
      class="hidden"
      @change="onFileInput"
    >
    <div v-if="model" class="space-y-1">
      <p class="font-medium text-sm">
        {{ model.name }}
      </p>
      <p class="text-xs text-muted">
        {{ (model.size / 1024).toFixed(1) }} Ko
      </p>
      <UButton
        variant="ghost"
        size="xs"
        color="neutral"
        label="Changer"
        @click.stop="browse"
      />
    </div>
    <div v-else class="space-y-2">
      <p class="text-sm text-muted">
        {{ label }}
      </p>
      <p class="text-xs text-slate-400">
        {{ hint }}
      </p>
    </div>
  </div>
</template>
