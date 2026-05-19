<script setup lang="ts">
import { useEventBus } from '@vueuse/core'
import { useContext } from '~/composables/useContext'

const { context, setClient, setDossier, loading } = useContext()

const clients = ref<any[]>([])
const dossiers = ref<any[]>([])
const loadingClients = ref(false)
const loadingDossiers = ref(false)

// Charger la liste des clients (actifs uniquement pour le switcher)
async function loadClients() {
  loadingClients.value = true
  try {
    const data = await $fetch<{ items: any[]; total: number }>('/api/clients', {
      query: { status: 'active' },
    })
    clients.value = data?.items || []
  } catch (err) {
    console.error('Erreur lors du chargement des clients:', err)
  } finally {
    loadingClients.value = false
  }
}

// Charger les dossiers du client sélectionné
async function loadDossiers(clientId: string) {
  if (!clientId) {
    dossiers.value = []
    return
  }

  loadingDossiers.value = true
  try {
    const data = await $fetch<{ items: any[]; total: number }>(`/api/clients/${clientId}/dossiers`)
    dossiers.value = data?.items || []
  } catch (err) {
    console.error('Erreur lors du chargement des dossiers:', err)
    dossiers.value = []
  } finally {
    loadingDossiers.value = false
  }
}

// Options pour les selects
const clientOptions = computed(() => {
  return [
    { label: 'Sélectionner un client', value: null },
    ...clients.value
      .filter((c) => c.status !== 'archived')
      .map((c) => ({
        label: `${c.name}${c.companyName ? ` (${c.companyName})` : ''}`,
        value: c.id,
      })),
  ]
})

const dossierOptions = computed(() => {
  return [
    { label: 'Aucun dossier', value: null },
    ...dossiers.value.map((d) => ({
      label: d.titre,
      value: d.id,
    })),
  ]
})

// Gérer le changement de client
async function handleClientChange(newClientId: string | null) {
  setClient(newClientId)
  if (newClientId) {
    await loadDossiers(newClientId)
    // Réinitialiser le dossier si nécessaire
    if (context.value.dossierId) {
      const dossierExists = dossiers.value.some(
        (d) => d.id === context.value.dossierId,
      )
      if (!dossierExists) {
        setDossier(null)
      }
    }
  } else {
    dossiers.value = []
    setDossier(null)
  }
}

// Écouter les événements de rafraîchissement
const refreshClientsEvent = useEventBus('refresh-clients')
function onRefresh() {
  loadClients()
  if (context.value.clientId) {
    loadDossiers(context.value.clientId)
  }
}

onMounted(() => {
  refreshClientsEvent.on(onRefresh)
  loadClients()
  if (context.value.clientId) {
    loadDossiers(context.value.clientId)
  }
})
</script>

<template>
  <div class="flex items-center gap-3">
    <!-- Client Select -->
    <div class="flex items-center gap-2">
      <label class="text-xs font-medium text-muted whitespace-nowrap">
        Client:
      </label>
      <USelect
        :model-value="context.clientId"
        :items="clientOptions"
        :loading="loadingClients || loading"
        placeholder="Sélectionner un client"
        class="min-w-[200px]"
        @update:model-value="handleClientChange"
      />
    </div>

    <!-- Dossier Select -->
    <div
      v-if="context.clientId"
      class="flex items-center gap-2"
    >
      <label class="text-xs font-medium text-muted whitespace-nowrap">
        Dossier:
      </label>
      <USelect
        :model-value="context.dossierId"
        :items="dossierOptions"
        :loading="loadingDossiers || loading"
        placeholder="Sélectionner un dossier"
        class="min-w-[200px]"
        @update:model-value="setDossier"
      />
    </div>

    <!-- Badge de contexte actif -->
    <UBadge
      v-if="context.clientId"
      :color="context.dossierId ? 'success' : 'warning'"
      variant="subtle"
      class="text-xs"
    >
      {{ context.client ? context.client.name : 'Chargement...' }}
      <span v-if="context.dossier"> · {{ context.dossier.titre }}</span>
    </UBadge>
  </div>
</template>

