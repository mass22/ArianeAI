<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Client, ClientSource } from '~/composables/useClients'

const props = defineProps<{
  client?: Client | null
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [data: Partial<Client>]
  cancel: []
}>()

const SOURCE_OPTIONS: { value: ClientSource; label: string }[] = [
  { value: 'referral', label: 'Bouche-à-oreille' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'cold_outreach', label: 'Prospection froide' },
  { value: 'existing_client', label: 'Client existant' },
  { value: 'job_board', label: 'Job board' },
  { value: 'community', label: 'Communauté' },
  { value: 'other', label: 'Autre' },
]

const schema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  companyName: z.string().optional(),
  industry: z.string().optional(),
  email: z.union([z.string().email('Email invalide'), z.literal('')]).optional(),
  phone: z.string().optional(),
  website: z.union([z.string().url('URL invalide'), z.literal('')]).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  source: z.enum(['referral', 'linkedin', 'cold_outreach', 'existing_client', 'job_board', 'community', 'other']).optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  lastContactAt: z.string().optional(),
  nextFollowUpAt: z.string().optional(),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  name: props.client?.name ?? '',
  companyName: props.client?.companyName ?? '',
  industry: props.client?.industry ?? '',
  email: props.client?.email ?? '',
  phone: props.client?.phone ?? '',
  website: props.client?.website ?? '',
  address: props.client?.address ?? '',
  city: props.client?.city ?? '',
  postalCode: props.client?.postalCode ?? '',
  country: props.client?.country ?? '',
  source: props.client?.source ?? null,
  tags: props.client?.tags ?? [],
  notes: props.client?.notes ?? '',
  lastContactAt: props.client?.lastContactAt ?? '',
  nextFollowUpAt: props.client?.nextFollowUpAt ?? '',
})

watch(
  () => props.client,
  (newClient) => {
    if (newClient) {
      state.name = newClient.name
      state.companyName = newClient.companyName ?? ''
      state.industry = newClient.industry ?? ''
      state.email = newClient.email ?? ''
      state.phone = newClient.phone ?? ''
      state.website = newClient.website ?? ''
      state.address = newClient.address ?? ''
      state.city = newClient.city ?? ''
      state.postalCode = newClient.postalCode ?? ''
      state.country = newClient.country ?? ''
      state.source = newClient.source ?? null
      state.tags = [...(newClient.tags ?? [])]
      state.notes = newClient.notes ?? ''
      state.lastContactAt = newClient.lastContactAt ?? ''
      state.nextFollowUpAt = newClient.nextFollowUpAt ?? ''
    }
  },
  { immediate: true },
)

const tagInput = ref('')

function addTag() {
  const t = tagInput.value.trim()
  if (t && !state.tags?.includes(t)) {
    state.tags = [...(state.tags ?? []), t]
    tagInput.value = ''
  }
}

function removeTag(tag: string) {
  state.tags = (state.tags ?? []).filter((x) => x !== tag)
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  const data = { ...event.data }
  if (data.email === '') delete (data as any).email
  if (data.website === '') delete (data as any).website
  emit('submit', data)
}
</script>

<template>
  <UForm
    :schema="schema"
    :state="state"
    :disabled="loading"
    class="space-y-6"
    @submit="onSubmit"
  >
    <!-- Identité -->
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-muted uppercase">
        Identité
      </h3>
      <UFormField label="Nom" name="name" required>
        <UInput v-model="state.name" placeholder="Jean Dupont" />
      </UFormField>
      <UFormField label="Entreprise" name="companyName">
        <UInput v-model="state.companyName" placeholder="Acme Corp" />
      </UFormField>
      <UFormField label="Secteur" name="industry">
        <UInput v-model="state.industry" placeholder="Tech, Finance..." />
      </UFormField>
    </div>

    <!-- Contact -->
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-muted uppercase">
        Contact
      </h3>
      <UFormField label="Email" name="email">
        <UInput v-model="state.email" type="email" placeholder="jean@example.com" />
      </UFormField>
      <UFormField label="Téléphone" name="phone">
        <UInput v-model="state.phone" placeholder="+33 6 12 34 56 78" />
      </UFormField>
      <UFormField label="Site web" name="website">
        <UInput v-model="state.website" placeholder="https://example.com" />
      </UFormField>
    </div>

    <!-- Adresse -->
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-muted uppercase">
        Adresse
      </h3>
      <UFormField label="Adresse" name="address">
        <UInput v-model="state.address" placeholder="123 rue de la Paix" />
      </UFormField>
      <div class="grid grid-cols-2 gap-4">
        <UFormField label="Ville" name="city">
          <UInput v-model="state.city" placeholder="Paris" />
        </UFormField>
        <UFormField label="Code postal" name="postalCode">
          <UInput v-model="state.postalCode" placeholder="75001" />
        </UFormField>
      </div>
      <UFormField label="Pays" name="country">
        <UInput v-model="state.country" placeholder="France" />
      </UFormField>
    </div>

    <!-- Suivi CRM -->
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-muted uppercase">
        Suivi CRM
      </h3>
      <UFormField label="Source" name="source">
        <USelect
          v-model="state.source"
          :items="SOURCE_OPTIONS"
          placeholder="Sélectionner une source"
        />
      </UFormField>
      <UFormField label="Tags" name="tags">
        <div class="space-y-2">
          <div class="flex gap-2">
            <UInput
              v-model="tagInput"
              placeholder="Ajouter un tag"
              @keydown.enter.prevent="addTag"
            />
            <UButton type="button" variant="outline" size="sm" @click="addTag">
              Ajouter
            </UButton>
          </div>
          <div v-if="state.tags?.length" class="flex flex-wrap gap-1">
            <UBadge
              v-for="tag in state.tags"
              :key="tag"
              color="neutral"
              variant="subtle"
              size="sm"
              class="cursor-pointer"
              @click="removeTag(tag)"
            >
              {{ tag }} ×
            </UBadge>
          </div>
        </div>
      </UFormField>
      <UFormField label="Notes internes" name="notes">
        <UTextarea
          v-model="state.notes"
          :rows="3"
          placeholder="Notes libres..."
        />
      </UFormField>
      <div class="grid grid-cols-2 gap-4">
        <UFormField label="Dernier contact" name="lastContactAt">
          <UInput v-model="state.lastContactAt" type="date" />
        </UFormField>
        <UFormField label="Prochain suivi" name="nextFollowUpAt">
          <UInput v-model="state.nextFollowUpAt" type="date" />
        </UFormField>
      </div>
    </div>

    <div class="flex gap-2 justify-end pt-4">
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
