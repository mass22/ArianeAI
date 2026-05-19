<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useEventBus } from '@vueuse/core'
import { h, resolveComponent } from 'vue'
import { useClients, type Client } from '~/composables/useClients'

definePageMeta({
  ssr: false,
})

const { fetchClients, createClient } = useClients()
const router = useRouter()

const searchQuery = ref('')
const statusFilter = ref<'all' | 'active' | 'archived'>('active')
const clients = ref<Client[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const showCreateModal = ref(false)
const creating = ref(false)
const sortBy = ref<'name' | 'lastContactAt' | 'nextFollowUpAt'>('name')
const sortOrder = ref<'asc' | 'desc'>('asc')

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')

const statusTabs = [
  { label: 'Tous', value: 'all' },
  { label: 'Actifs', value: 'active' },
  { label: 'Archivés', value: 'archived' },
]

const debouncedSearch = refDebounced(searchQuery, 300)

watch([debouncedSearch, statusFilter, sortBy, sortOrder], async () => {
  await loadClients()
})

async function loadClients() {
  loading.value = true
  error.value = null

  try {
    const status = statusFilter.value === 'all' ? undefined : statusFilter.value
    const { data, error: fetchError } = await fetchClients({
      search: searchQuery.value || undefined,
      status,
      sort: sortBy.value,
      order: sortOrder.value,
    })

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

function toggleSort(field: 'name' | 'lastContactAt' | 'nextFollowUpAt') {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'asc'
  }
  loadClients()
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date() && new Date(dateStr).toDateString() !== new Date().toDateString()
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
    refreshClientsEvent.emit()
  } finally {
    creating.value = false
  }
}

const columns: TableColumn<Client>[] = [
  {
    accessorKey: 'name',
    header: () => h('button', {
      class: 'flex items-center gap-1 font-medium hover:underline',
      onClick: () => toggleSort('name'),
    }, [
      'Nom',
      h('span', { class: 'text-xs' }, sortBy.value === 'name' ? (sortOrder.value === 'asc' ? '↑' : '↓') : ''),
    ]),
    cell: ({ row }) => {
      const client = row.original
      return h('div', { class: 'flex flex-col gap-0.5' }, [
        h('div', { class: 'flex items-center gap-2' }, [
          h('span', { class: 'font-medium' }, client.name),
          client.status === 'archived'
            ? h(UBadge, {
              color: 'neutral',
              variant: 'subtle',
              size: 'xs',
            }, () => 'Archivé')
            : null,
        ]),
        client.companyName
          ? h('span', { class: 'text-xs text-muted' }, client.companyName)
          : null,
      ])
    },
  },
  {
    accessorKey: 'status',
    header: 'Statut',
    cell: ({ row }) => {
      const status = row.original.status
      return h(UBadge, {
        color: status === 'archived' ? 'neutral' : 'success',
        variant: 'subtle',
        size: 'xs',
      }, () => status === 'archived' ? 'Archivé' : 'Actif')
    },
  },
  {
    accessorKey: 'lastContactAt',
    header: () => h('button', {
      class: 'font-medium hover:underline',
      onClick: () => toggleSort('lastContactAt'),
    }, 'Dernier contact'),
    cell: ({ row }) => h('span', { class: 'text-sm' }, formatDate(row.original.lastContactAt)),
  },
  {
    accessorKey: 'nextFollowUpAt',
    header: () => h('button', {
      class: 'font-medium hover:underline',
      onClick: () => toggleSort('nextFollowUpAt'),
    }, 'Prochain suivi'),
    cell: ({ row }) => {
      const client = row.original
      const date = formatDate(client.nextFollowUpAt)
      const overdue = isOverdue(client.nextFollowUpAt)
      return h('div', { class: 'flex items-center gap-2' }, [
        h('span', { class: overdue ? 'text-warning font-medium' : 'text-sm' }, date),
        overdue ? h('span', {
          class: 'size-2 rounded-full bg-warning',
          title: 'Suivi dépassé',
        }) : null,
      ])
    },
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'text-right' }, 'Actions'),
    cell: ({ row }) => {
      const handleClick = async (e: MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        await router.push(`/clients/${row.original.id}`)
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
          <h1 class="text-3xl font-semibold tracking-tight">
            Clients
          </h1>
          <p class="text-sm text-muted mt-1">
            Gérez vos clients et leurs dossiers
          </p>
        </div>
        <UButton
          icon="i-lucide-plus"
          :disabled="statusFilter === 'archived'"
          @click="showCreateModal = true"
        >
          Nouveau client
        </UButton>
      </div>

      <!-- Search + Status tabs -->
      <div class="flex flex-wrap items-center gap-4">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Rechercher un client..."
          class="max-w-sm"
        />
        <UTabs
          v-model="statusFilter"
          :items="statusTabs"
          class="flex-1"
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
