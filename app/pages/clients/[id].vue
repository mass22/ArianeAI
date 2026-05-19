<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useEventBus } from '@vueuse/core'
import { h, resolveComponent } from 'vue'
import { useClients, type Client } from '~/composables/useClients'
import { useDossiers, type Dossier } from '~/composables/useDossiers'
import ClientInsightsPanel from '~/components/insights/ClientInsightsPanel.vue'

definePageMeta({
  ssr: false,
})

const SOURCE_LABELS: Record<string, string> = {
  referral: 'Bouche-à-oreille',
  linkedin: 'LinkedIn',
  cold_outreach: 'Prospection froide',
  existing_client: 'Client existant',
  job_board: 'Job board',
  community: 'Communauté',
  other: 'Autre',
}

const route = useRoute()
const router = useRouter()
const clientId = computed(() => route.params.id as string)

const { fetchClient, updateClient, archiveClient, reactivateClient, deleteClient } = useClients()
const { fetchDossiers, createDossier } = useDossiers()

const client = ref<Client | null>(null)
const dossiers = ref<Dossier[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const activeTab = ref((route.query.tab as string) || 'details')
const showEditModal = ref(false)
const showDossierModal = ref(false)
const showDeleteModal = ref(false)
const updating = ref(false)
const creatingDossier = ref(false)
const archiving = ref(false)
const reactivating = ref(false)
const deleting = ref(false)

const UBadge = resolveComponent('UBadge')

const statutColors: Record<string, any> = {
  en_attente: { color: 'warning', label: 'En attente' },
  en_cours: { color: 'info', label: 'En cours' },
  resolu: { color: 'success', label: 'Résolu' },
  ferme: { color: 'neutral', label: 'Fermé' },
}

const isNextFollowUpOverdue = computed(() => {
  const d = client.value?.nextFollowUpAt
  if (!d) return false
  const date = new Date(d)
  return date < new Date()
})

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
    refreshClientsEvent.emit()
  } finally {
    updating.value = false
  }
}

async function handleArchive() {
  archiving.value = true
  try {
    const { error: err } = await archiveClient(clientId.value)
    if (!err) {
      await loadClient()
      refreshClientsEvent.emit()
    }
  } finally {
    archiving.value = false
  }
}

async function handleReactivate() {
  reactivating.value = true
  try {
    const { error: err } = await reactivateClient(clientId.value)
    if (!err) {
      await loadClient()
      refreshClientsEvent.emit()
    }
  } finally {
    reactivating.value = false
  }
}

async function handleDelete() {
  deleting.value = true
  try {
    const { error: err } = await deleteClient(clientId.value)
    if (!err) {
      showDeleteModal.value = false
      await router.push('/clients')
      refreshClientsEvent.emit()
    }
  } finally {
    deleting.value = false
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR')
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

const tabs = computed(() => [
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
  {
    label: 'Insights',
    value: 'insights',
    icon: 'i-lucide-bar-chart-3',
  },
])

watch(activeTab, (newTab) => {
  if (newTab === 'dossiers') {
    loadDossiers()
  }
  router.replace({
    query: { ...route.query, tab: newTab },
  })
})

watch(() => route.query.tab, (tab) => {
  if (tab && ['details', 'dossiers', 'insights'].includes(tab)) {
    activeTab.value = tab
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
      <div class="flex flex-wrap items-center gap-4">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          @click="router.back()"
        >
          Retour
        </UButton>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-3xl font-semibold tracking-tight">
              {{ loading ? 'Chargement...' : client ? client.name : 'Client' }}
            </h1>
            <UBadge
              v-if="client?.status === 'archived'"
              color="neutral"
              variant="subtle"
            >
              Archivé
            </UBadge>
          </div>
          <p class="text-sm text-muted mt-1">
            Détails et dossiers du client
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="client"
            icon="i-lucide-edit"
            variant="outline"
            @click="showEditModal = true"
          >
            Modifier
          </UButton>
          <UButton
            v-if="client?.status === 'active'"
            icon="i-lucide-archive"
            variant="outline"
            color="neutral"
            :loading="archiving"
            @click="handleArchive"
          >
            Archiver
          </UButton>
          <UButton
            v-if="client?.status === 'archived'"
            icon="i-lucide-rotate-ccw"
            variant="outline"
            color="success"
            :loading="reactivating"
            @click="handleReactivate"
          >
            Réactiver
          </UButton>
          <UButton
            v-if="client"
            icon="i-lucide-trash-2"
            variant="outline"
            color="error"
            @click="showDeleteModal = true"
          >
            Supprimer
          </UButton>
        </div>
      </div>

      <!-- Alerte nextFollowUp dépassé -->
      <UAlert
        v-if="client && isNextFollowUpOverdue"
        color="warning"
        variant="soft"
        title="Prochain suivi dépassé"
        :description="`Le prochain suivi prévu le ${formatDate(client.nextFollowUpAt)} est dépassé.`"
        icon="i-lucide-calendar-clock"
      />

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
          <UCard title="Identité">
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Nom
                </p>
                <p class="text-sm font-medium">
                  {{ client.name }}
                </p>
              </div>
              <div v-if="client.companyName">
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Entreprise
                </p>
                <p class="text-sm">
                  {{ client.companyName }}
                </p>
              </div>
              <div v-if="client.industry">
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Secteur
                </p>
                <p class="text-sm">
                  {{ client.industry }}
                </p>
              </div>
            </div>
          </UCard>

          <UCard title="Contact">
            <div class="grid gap-4 md:grid-cols-2">
              <div v-if="client.email">
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
              <div v-if="client.phone">
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Téléphone
                </p>
                <p class="text-sm">
                  <a
                    :href="`tel:${client.phone}`"
                    class="text-primary hover:underline"
                  >
                    {{ client.phone }}
                  </a>
                </p>
              </div>
              <div v-if="client.website">
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Site web
                </p>
                <p class="text-sm">
                  <a
                    :href="client.website"
                    target="_blank"
                    rel="noopener"
                    class="text-primary hover:underline"
                  >
                    {{ client.website }}
                  </a>
                </p>
              </div>
            </div>
          </UCard>

          <UCard v-if="client.address || client.city || client.postalCode || client.country" title="Adresse">
            <div class="grid gap-4 md:grid-cols-2">
              <div v-if="client.address" class="md:col-span-2">
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Adresse
                </p>
                <p class="text-sm">
                  {{ client.address }}
                </p>
              </div>
              <div v-if="client.city">
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Ville
                </p>
                <p class="text-sm">
                  {{ client.city }}
                </p>
              </div>
              <div v-if="client.postalCode">
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Code postal
                </p>
                <p class="text-sm">
                  {{ client.postalCode }}
                </p>
              </div>
              <div v-if="client.country">
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Pays
                </p>
                <p class="text-sm">
                  {{ client.country }}
                </p>
              </div>
            </div>
          </UCard>

          <UCard title="Suivi CRM">
            <div class="grid gap-4 md:grid-cols-2">
              <div v-if="client.source">
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Source
                </p>
                <p class="text-sm">
                  {{ SOURCE_LABELS[client.source] || client.source }}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Dernier contact
                </p>
                <p class="text-sm">
                  {{ formatDate(client.lastContactAt) }}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Prochain suivi
                </p>
                <p class="text-sm" :class="{ 'text-warning font-medium': isNextFollowUpOverdue }">
                  {{ formatDate(client.nextFollowUpAt) }}
                </p>
              </div>
              <div v-if="client.tags?.length" class="md:col-span-2">
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Tags
                </p>
                <div class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="tag in client.tags"
                    :key="tag"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                  >
                    {{ tag }}
                  </UBadge>
                </div>
              </div>
              <div v-if="client.notes" class="md:col-span-2">
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Notes internes
                </p>
                <p class="text-sm whitespace-pre-wrap">
                  {{ client.notes }}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Créé le
                </p>
                <p class="text-sm">
                  {{ formatDate(client.createdAt) }}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold text-muted uppercase mb-1">
                  Modifié le
                </p>
                <p class="text-sm">
                  {{ formatDate(client.updatedAt) }}
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Insights Tab -->
        <div v-if="activeTab === 'insights'" class="space-y-4">
          <ClientInsightsPanel
            :key="client?.id ?? 'loading'"
            :client-id="client?.id ?? clientId"
          />
        </div>

        <!-- Dossiers Tab -->
        <div v-if="activeTab === 'dossiers'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">
              Dossiers
            </h2>
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

      <!-- Delete confirmation Modal -->
      <UModal
        v-model:open="showDeleteModal"
        title="Supprimer ce client ?"
      >
        <template #body>
          <p class="text-default mb-4">
            Supprimer définitivement ce client ? Cette action est irréversible. Il ne doit pas avoir de dossiers, personnes ou artifacts liés.
          </p>
          <div class="flex gap-2 justify-end">
            <UButton
              variant="outline"
              color="neutral"
              :disabled="deleting"
              @click="showDeleteModal = false"
            >
              Annuler
            </UButton>
            <UButton
              color="error"
              :loading="deleting"
              @click="handleDelete"
            >
              Supprimer définitivement
            </UButton>
          </div>
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
