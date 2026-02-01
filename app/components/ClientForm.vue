<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Client } from '~/composables/useClients'

const props = defineProps<{
  client?: Client | null
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [data: Partial<Client>]
  cancel: []
}>()

const schema = z.object({
  nom: z.string().min(1, 'Le nom est requis'),
  prenom: z.string().min(1, 'Le prénom est requis'),
  email: z.string().email('Email invalide'),
  telephone: z.string().optional().nullable(),
  entreprise: z.string().optional().nullable(),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  nom: props.client?.nom || '',
  prenom: props.client?.prenom || '',
  email: props.client?.email || '',
  telephone: props.client?.telephone || '',
  entreprise: props.client?.entreprise || '',
})

watch(
  () => props.client,
  (newClient) => {
    if (newClient) {
      state.nom = newClient.nom
      state.prenom = newClient.prenom
      state.email = newClient.email
      state.telephone = newClient.telephone || ''
      state.entreprise = newClient.entreprise || ''
    }
  },
  { immediate: true },
)

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
    <UFormField label="Nom" name="nom" required>
      <UInput v-model="state.nom" placeholder="Dupont" />
    </UFormField>

    <UFormField label="Prénom" name="prenom" required>
      <UInput v-model="state.prenom" placeholder="Jean" />
    </UFormField>

    <UFormField label="Email" name="email" required>
      <UInput v-model="state.email" type="email" placeholder="jean.dupont@example.com" />
    </UFormField>

    <UFormField label="Téléphone" name="telephone">
      <UInput v-model="state.telephone" placeholder="+33 6 12 34 56 78" />
    </UFormField>

    <UFormField label="Entreprise" name="entreprise">
      <UInput v-model="state.entreprise" placeholder="Acme Corp" />
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
        {{ client ? 'Mettre à jour' : 'Créer' }}
      </UButton>
    </div>
  </UForm>
</template>

