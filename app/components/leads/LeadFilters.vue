<script setup lang="ts">
import type { LeadsQuery } from '~/composables/useArianeApi'

const model = defineModel<LeadsQuery>({ required: true })

const ALL_VALUE = '__all__' // Combobox n'accepte pas value="" pour les items

const pipelineStages = [
  { value: ALL_VALUE, label: 'Tous' },
  { value: 'inbox', label: 'Inbox' },
  { value: 'new', label: 'Nouveau' },
  { value: 'contacted', label: 'Contacté' },
  { value: 'messaged', label: 'Message envoyé' },
  { value: 'replied', label: 'Répondu' },
  { value: 'scheduled', label: 'RDV planifié' },
  { value: 'proposal', label: 'Proposition' },
  { value: 'won', label: 'Gagné' },
  { value: 'lost', label: 'Perdu' },
]

// Les nouveaux leads ont status: inbox — inclure inbox pour voir les leads après import
const statusOptions = [
  { value: ALL_VALUE, label: 'Tous' },
  { value: 'inbox', label: 'Inbox' },
  { value: 'messaged', label: 'Message envoyé' },
  { value: 'replied', label: 'Répondu' },
]

const sortOptions = [
  { value: 'priority_score', label: 'Score priorité', order: 'desc' as const },
  { value: 'next_followup_at', label: 'Prochain suivi', order: 'asc' as const },
]

function setSort(sort: string, order: 'asc' | 'desc') {
  model.value = { ...model.value, sort, order }
}
</script>

<template>
  <div class="flex flex-wrap items-end gap-3">
    <div class="flex flex-col gap-1">
      <label class="text-xs font-medium text-slate-500">Nom</label>
      <UInput
        v-model="model.search"
        placeholder="Rechercher par nom..."
        size="sm"
        class="w-48"
        icon="i-lucide-search"
        clearable
      />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-xs font-medium text-slate-500">Type</label>
      <UInput
        v-model="model.type"
        placeholder="Type"
        size="sm"
        class="w-32"
      />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-xs font-medium text-slate-500">Statut</label>
      <USelectMenu
        :model-value="model.status ?? ALL_VALUE"
        :items="statusOptions"
        value-key="value"
        size="sm"
        class="w-40"
        placeholder="Tous"
        @update:model-value="(v: string) => model = { ...model, status: v === ALL_VALUE ? undefined : v }"
      />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-xs font-medium text-slate-500">Pipeline</label>
      <USelectMenu
        :model-value="model.pipeline_stage ?? ALL_VALUE"
        :items="pipelineStages"
        value-key="value"
        size="sm"
        class="w-40"
        placeholder="Tous"
        @update:model-value="(v: string) => model = { ...model, pipeline_stage: v === ALL_VALUE ? undefined : v }"
      />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-xs font-medium text-slate-500">Score min</label>
      <UInput
        v-model.number="model.minScore"
        type="number"
        placeholder="0"
        size="sm"
        class="w-24"
      />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-xs font-medium text-slate-500">Tri</label>
      <div class="flex gap-1">
        <UButton
          v-for="opt in sortOptions"
          :key="opt.value"
          :variant="model.sort === opt.value ? 'solid' : 'ghost'"
          size="xs"
          @click="setSort(opt.value, opt.order)"
        >
          {{ opt.label }}
        </UButton>
      </div>
    </div>
  </div>
</template>
