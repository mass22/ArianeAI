// app/composables/useContext.ts
// Import des types uniquement (pas d'exécution de code)
import type { Client } from '~/composables/useClients'
import type { Dossier } from '~/composables/useDossiers'

const STORAGE_KEY_CLIENT = 'ariane_context_clientId'
const STORAGE_KEY_DOSSIER = 'ariane_context_dossierId'

export interface AppContext {
  clientId: string | null
  dossierId: string | null
  client: Client | null
  dossier: Dossier | null
}

// État partagé (singleton pattern)
let sharedState: {
  clientId: any
  dossierId: any
  client: Ref<Client | null>
  dossier: Ref<Dossier | null>
  loading: Ref<boolean>
  initialized: boolean
} | null = null

export function useContext() {
  // Initialiser l'état partagé une seule fois
  if (!sharedState) {

    const clientId = useLocalStorage<string | null>(STORAGE_KEY_CLIENT, null)
    const dossierId = useLocalStorage<string | null>(STORAGE_KEY_DOSSIER, null)
    const client = ref<Client | null>(null)
    const dossier = ref<Dossier | null>(null)
    const loading = ref(false)

    // Fonctions fetch sans useToast pour éviter les erreurs inject()
    async function fetchClientWithoutToast(id: string): Promise<{ data: Client | null; error: string | null }> {
      try {
        const data = await $fetch<Client>(`/api/clients/${id}`)
        return { data, error: null }
      } catch (err: any) {
        const error = err?.message || 'Erreur lors de la récupération du client'
        return { data: null, error }
      }
    }

    async function fetchDossiersWithoutToast(clientId: string): Promise<{ data: { items: Dossier[]; total: number } | null; error: string | null }> {
      try {
        const data = await $fetch<{ items: Dossier[]; total: number }>(`/api/clients/${clientId}/dossiers`)
        return { data, error: null }
      } catch (err: any) {
        const error = err?.message || 'Erreur lors de la récupération des dossiers'
        return { data: null, error }
      }
    }

    // Charger le client quand clientId change
    watch(clientId, async (newClientId) => {
      if (newClientId) {
        loading.value = true
        try {
          const { data } = await fetchClientWithoutToast(newClientId)
          client.value = data
        } catch (err) {
          console.error('Erreur lors du chargement du client:', err)
          client.value = null
        } finally {
          loading.value = false
        }
      } else {
        client.value = null
        dossier.value = null
        dossierId.value = null
      }
    }, { immediate: true })

    // Charger le dossier quand dossierId change
    watch(
      [dossierId, clientId],
      async ([newDossierId, newClientId]) => {
        if (newDossierId && newClientId) {
          loading.value = true
          try {
            const { data } = await fetchDossiersWithoutToast(newClientId)
            dossier.value = data?.items?.find((d) => d.id === newDossierId) || null

            // Si le dossier n'existe pas, réinitialiser
            if (!dossier.value) {
              dossierId.value = null
            }
          } catch (err) {
            console.error('Erreur lors du chargement du dossier:', err)
            dossier.value = null
          } finally {
            loading.value = false
          }
        } else {
          dossier.value = null
        }
      },
      { immediate: true },
    )

    sharedState = {
      clientId,
      dossierId,
      client,
      dossier,
      loading,
      initialized: true,
    }
  }

  const { clientId, dossierId, client, dossier, loading } = sharedState!
  function setClient(id: string | null) {
    const previousClientId = clientId.value
    clientId.value = id
    // Réinitialiser le dossier si on change de client
    if (id !== previousClientId) {
      dossierId.value = null
    }
  }

  function setDossier(id: string | null) {
    if (!clientId.value) {
      console.warn('Impossible de définir un dossier sans client')
      return
    }
    dossierId.value = id
  }

  function clear() {
    clientId.value = null
    dossierId.value = null
  }

  const context = computed<AppContext>(() => ({
    clientId: clientId.value,
    dossierId: dossierId.value,
    client: client.value,
    dossier: dossier.value,
  }))

  return {
    context,
    clientId: readonly(clientId),
    dossierId: readonly(dossierId),
    client: readonly(client),
    dossier: readonly(dossier),
    loading: readonly(loading),
    setClient,
    setDossier,
    clear,
  }
}

