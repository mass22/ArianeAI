<script setup lang="ts">
import { useEventBus } from '@vueuse/core'
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { useClients, type Client } from '~/composables/useClients'

definePageMeta({
  ssr: false,
})

const { fetchClients, createClient } = useClients()
const toast = useToast()
const router = useRouter()

const searchQuery = ref('')
const clients = ref<Client[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const showCreateModal = ref(false)
const creating = ref(false)

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const NuxtLink = resolveComponent('NuxtLink')

// Recherche avec debounce
const debouncedSearch = refDebounced(searchQuery, 300)

watch(debouncedSearch, async () => {
  await loadClients()
})

async function loadClients() {
  loading.value = true
  error.value = null

  try {
    const { data, error: fetchError } = await fetchClients(
      searchQuery.value || undefined,
    )

    if (fetchError) {
      error.value = fetchError
      return
    }

    clients.value = data?.items || []
  } catch (err: any) {
    error.value = err?.message || 'Erreur lors du chargement des clients'
  } finally {
    loading.value = false
  }
}

const refreshClientsEvent = useEventBus('refresh-clients')

async function handleCreateClient(clientData: Partial<Client>) {
  creating.value = true

  try {
    const { data, error: createError } = await createClient(clientData)

    if (createError) {
      return
    }

    showCreateModal.value = false
    await loadClients()
    // Rafraîchir la liste des clients dans le ContextSwitcher
    refreshClientsEvent.emit()
  } finally {
    creating.value = false
  }
}

const columns: TableColumn<Client>[] = [
  {
    accessorKey: 'nom',
    header: 'Nom',
    cell: ({ row }) => {
      const client = row.original
      return h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'font-medium' }, `${client.prenom} ${client.nom}`),
        client.entreprise
          ? h('span', { class: 'text-xs text-muted' }, client.entreprise)
          : null,
      ])
    },
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.getValue('email')),
  },
  {
    accessorKey: 'telephone',
    header: 'Téléphone',
    cell: ({ row }) => {
      const tel = row.getValue('telephone') as string | null
      return h('span', { class: 'text-sm' }, tel || '—')
    },
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'text-right' }, 'Actions'),
    cell: ({ row }) => {
      const handleClick = async (e: MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        const url = `/clients/${row.original.id}`
        await router.push(url)
      }
      return h(
        'div',
        { class: 'text-right' },
        h(
          UButton,
          {
            onClick: handleClick,
            variant: 'ghost',
            color: 'neutral',
            size: 'sm',
          },
          () => 'Voir',
        ),
      )
    },
  },
]

onMounted(() => {
  loadClients()
})
</script>

<template>
  <div class="min-h-screen bg-default">
    <div class="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight">Clients</h1>
          <p class="text-sm text-muted mt-1">
            Gérez vos clients et leurs dossiers
          </p>
        </div>
        <UButton
          icon="i-lucide-plus"
          @click="showCreateModal = true"
        >
          Nouveau client
        </UButton>
      </div>

      <!-- Search -->
      <div class="flex gap-4">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Rechercher un client..."
          class="max-w-sm"
        />
      </div>

      <!-- Table -->
      <div class="border border-default rounded-lg bg-default">
        <UTable
          :data="clients"
          :columns="columns"
          :loading="loading"
          empty="Aucun client trouvé"
          class="flex-1"
          @select="(e, row) => navigateTo(`/clients/${row.original.id}`)"
        />
      </div>

      <!-- Error state -->
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :title="error"
        icon="i-lucide-alert-circle"
      />

      <!-- Create Modal -->
      <UModal
        v-model:open="showCreateModal"
        title="Nouveau client"
        description="Ajoutez un nouveau client à votre base de données"
      >
        <template #body>
          <ClientForm
            :loading="creating"
            @submit="handleCreateClient"
            @cancel="showCreateModal = false"
          />
        </template>
      </UModal>
    </div>
  </div>
</template>

