<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useEventBus } from '@vueuse/core'
import { h, resolveComponent } from 'vue'
import { useClients, type Client } from '~/composables/useClients'
import { useDossiers, type Dossier } from '~/composables/useDossiers'

definePageMeta({
  ssr: false,
})

const route = useRoute()
const router = useRouter()
const clientId = computed(() => route.params.id as string)


const { fetchClient, updateClient } = useClients()
const { fetchDossiers, createDossier } = useDossiers()
const toast = useToast()

const client = ref<Client | null>(null)
const dossiers = ref<Dossier[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const activeTab = ref('details')
const showEditModal = ref(false)
const showDossierModal = ref(false)
const updating = ref(false)
const creatingDossier = ref(false)

const UBadge = resolveComponent('UBadge')

const statutColors: Record<string, any> = {
  en_attente: { color: 'warning', label: 'En attente' },
  en_cours: { color: 'info', label: 'En cours' },
  resolu: { color: 'success', label: 'Résolu' },
  ferme: { color: 'neutral', label: 'Fermé' },
}

async function loadClient() {
  loading.value = true
  error.value = null

  try {
    const { data, error: fetchError } = await fetchClient(clientId.value)

    if (fetchError) {
      error.value = fetchError
      return
    }

    client.value = data
  } catch (err: any) {
    error.value = err?.message || 'Erreur lors du chargement du client'
  } finally {
    loading.value = false
  }
}

async function loadDossiers() {
  try {
    const { data, error: fetchError } = await fetchDossiers(clientId.value)

    if (fetchError) {
      return
    }

    dossiers.value = data?.items || []
  } catch (err: any) {
    console.error('Erreur lors du chargement des dossiers:', err)
  }
}

const refreshClientsEvent = useEventBus('refresh-clients')

async function handleUpdateClient(clientData: Partial<Client>) {
  updating.value = true

  try {
    const { error: updateError } = await updateClient(clientId.value, clientData)

    if (updateError) {
      return
    }

    showEditModal.value = false
    await loadClient()
    // Rafraîchir la liste des clients dans le ContextSwitcher
    refreshClientsEvent.emit()
  } finally {
    updating.value = false
  }
}

async function handleCreateDossier(dossierData: Partial<Dossier>) {
  creatingDossier.value = true

  try {
    const { error: createError } = await createDossier(clientId.value, dossierData)

    if (createError) {
      return
    }

    showDossierModal.value = false
    await loadDossiers()
  } finally {
    creatingDossier.value = false
  }
}

const dossierColumns: TableColumn<Dossier>[] = [
  {
    accessorKey: 'titre',
    header: 'Titre',
    cell: ({ row }) => {
      const dossier = row.original
      return h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'font-medium' }, dossier.titre),
        dossier.description
          ? h('span', { class: 'text-xs text-muted mt-1' }, dossier.description)
          : null,
      ])
    },
  },
  {
    accessorKey: 'statut',
    header: 'Statut',
    cell: ({ row }) => {
      const statut = row.getValue('statut') as string
      const config = statutColors[statut] || statutColors.en_attente
      return h(UBadge, {
        color: config.color,
        variant: 'subtle',
        class: 'capitalize',
      }, () => config.label)
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Créé le',
    cell: ({ row }) => {
      const date = new Date(row.getValue('createdAt') as string)
      return h('span', { class: 'text-sm' }, date.toLocaleDateString('fr-FR'))
    },
  },
]

const tabs = [
  {
    label: 'Détails',
    value: 'details',
    icon: 'i-lucide-user',
  },
  {
    label: 'Dossiers',
    value: 'dossiers',
    icon: 'i-lucide-folder',
    badge: dossiers.value.length > 0 ? String(dossiers.value.length) : undefined,
  },
]

watch(activeTab, (newTab) => {
  if (newTab === 'dossiers') {
    loadDossiers()
  }
})

watch(clientId, () => {
  loadClient()
  if (activeTab.value === 'dossiers') {
    loadDossiers()
  }
})

onMounted(() => {
  loadClient()
  if (activeTab.value === 'dossiers') {
    loadDossiers()
  }
})
</script>

<template>
  <div class="min-h-screen bg-default">
    <div class="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <!-- Header -->
      <div class="flex items-center gap-4">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          @click="router.back()"
        >
          Retour
        </UButton>
        <div class="flex-1">
          <h1 class="text-3xl font-semibold tracking-tight">
            {{ loading ? 'Chargement...' : client ? `${client.prenom} ${client.nom}` : 'Client' }}
          </h1>
          <p class="text-sm text-muted mt-1">
            Détails et dossiers du client
          </p>
        </div>
        <UButton
          v-if="client"
          icon="i-lucide-edit"
          variant="outline"
          @click="showEditModal = true"
        >
          Modifier
        </UButton>
      </div>

      <!-- Error state -->
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :title="error"
        icon="i-lucide-alert-circle"
      />

      <!-- Loading state -->
      <div v-if="loading && !client" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-muted" />
      </div>

      <!-- Content -->
      <div v-else-if="client" class="space-y-6">
        <!-- Tabs -->
        <UTabs v-model="activeTab" :items="tabs" />

        <!-- Details Tab -->
        <div v-if="activeTab === 'details'" class="space-y-4">
          <UCard>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Nom complet
                </p>
                <p class="text-sm font-medium">
                  {{ client.prenom }} {{ client.nom }}
                </p>
              </div>

              <div>
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Email
                </p>
                <p class="text-sm">
                  <a
                    :href="`mailto:${client.email}`"
                    class="text-primary hover:underline"
                  >
                    {{ client.email }}
                  </a>
                </p>
              </div>

              <div v-if="client.telephone">
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Téléphone
                </p>
                <p class="text-sm">
                  <a
                    :href="`tel:${client.telephone}`"
                    class="text-primary hover:underline"
                  >
                    {{ client.telephone }}
                  </a>
                </p>
              </div>

              <div v-if="client.entreprise">
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Entreprise
                </p>
                <p class="text-sm">{{ client.entreprise }}</p>
              </div>

              <div>
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Créé le
                </p>
                <p class="text-sm">
                  {{ new Date(client.createdAt).toLocaleDateString('fr-FR') }}
                </p>
              </div>

              <div>
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Modifié le
                </p>
                <p class="text-sm">
                  {{ new Date(client.updatedAt).toLocaleDateString('fr-FR') }}
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Dossiers Tab -->
        <div v-if="activeTab === 'dossiers'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Dossiers</h2>
            <UButton
              icon="i-lucide-plus"
              @click="showDossierModal = true"
            >
              Nouveau dossier
            </UButton>
          </div>

          <div class="border border-default rounded-lg bg-default">
            <UTable
              :data="dossiers"
              :columns="dossierColumns"
              empty="Aucun dossier trouvé"
              class="flex-1"
            >
              <template #empty>
                <UEmpty
                  icon="i-lucide-folder"
                  title="Aucun dossier"
                  description="Ce client n'a pas encore de dossier. Créez-en un pour commencer."
                  :actions="[{
                    label: 'Créer un dossier',
                    icon: 'i-lucide-plus',
                    onClick: () => { showDossierModal = true }
                  }]"
                />
              </template>
            </UTable>
          </div>
        </div>
      </div>

      <!-- Edit Modal -->
      <UModal
        v-model:open="showEditModal"
        title="Modifier le client"
        description="Modifiez les informations du client"
      >
        <template #body>
          <ClientForm
            :client="client"
            :loading="updating"
            @submit="handleUpdateClient"
            @cancel="showEditModal = false"
          />
        </template>
      </UModal>

      <!-- Create Dossier Modal -->
      <UModal
        v-model:open="showDossierModal"
        title="Nouveau dossier"
        description="Créez un nouveau dossier pour ce client"
      >
        <template #body>
          <DossierForm
            :loading="creatingDossier"
            @submit="handleCreateDossier"
            @cancel="showDossierModal = false"
          />
        </template>
      </UModal>
    </div>
  </div>
</template>

