<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Dossier } from '~/composables/useDossiers'

const props = defineProps<{
  dossier?: Dossier | null
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [data: Partial<Dossier>]
  cancel: []
}>()

const schema = z.object({
  titre: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional().nullable(),
  statut: z.enum(['en_attente', 'en_cours', 'resolu', 'ferme']).optional(),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  titre: props.dossier?.titre || '',
  description: props.dossier?.description || '',
  statut: props.dossier?.statut || 'en_attente',
})

watch(
  () => props.dossier,
  (newDossier) => {
    if (newDossier) {
      state.titre = newDossier.titre
      state.description = newDossier.description || ''
      state.statut = newDossier.statut
    }
  },
  { immediate: true },
)

const statutOptions = [
  { label: 'En attente', value: 'en_attente' },
  { label: 'En cours', value: 'en_cours' },
  { label: 'Résolu', value: 'resolu' },
  { label: 'Fermé', value: 'ferme' },
]

async function onSubmit(event: FormSubmitEvent<Schema>) {
  emit('submit', event.data)
}
</script>

<template>
  <UForm
    :schema="schema"
    :state="state"
    :disabled="loading"
    class="space-y-4"
    @submit="onSubmit"
  >
    <UFormField label="Titre" name="titre" required>
      <UInput v-model="state.titre" placeholder="Dossier commercial" />
    </UFormField>

    <UFormField label="Description" name="description">
      <UTextarea
        v-model="state.description"
        placeholder="Description du dossier..."
        :rows="4"
      />
    </UFormField>

    <UFormField label="Statut" name="statut">
      <USelect
        v-model="state.statut"
        :items="statutOptions"
        placeholder="Sélectionner un statut"
      />
    </UFormField>

    <div class="flex gap-2 justify-end">
      <UButton
        variant="outline"
        color="neutral"
        :disabled="loading"
        @click="emit('cancel')"
      >
        Annuler
      </UButton>
      <UButton type="submit" :loading="loading">
        {{ dossier ? 'Mettre à jour' : 'Créer' }}
      </UButton>
    </div>
  </UForm>
</template>

