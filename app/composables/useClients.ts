// app/composables/useClients.ts
export interface Client {
  id: string
  nom: string
  prenom: string
  email: string
  telephone: string | null
  entreprise: string | null
  createdAt: string
  updatedAt: string
}

export interface ClientsResponse {
  items: Client[]
  total: number
}

export function useClients() {
  let toast: ReturnType<typeof useToast> | null = null
  try {
    toast = useToast()
  } catch {
    // useToast peut ne pas être disponible dans certains contextes
  }

  async function fetchClients(search?: string) {
    try {
      const query: Record<string, string> = {}
      if (search) {
        query.search = search
      }

      const data = await $fetch<ClientsResponse>('/api/clients', {
        query,
      })

      return { data, error: null }
    } catch (err: any) {
      const error = err?.message || 'Erreur lors de la récupération des clients'
      toast?.add({
        title: 'Erreur',
        description: error,
        color: 'error',
      })
      return { data: null, error }
    }
  }

  async function fetchClient(id: string) {
    try {
      const data = await $fetch<Client>(`/api/clients/${id}`)
      return { data, error: null }
    } catch (err: any) {
      const error = err?.message || 'Erreur lors de la récupération du client'
      toast?.add({
        title: 'Erreur',
        description: error,
        color: 'error',
      })
      return { data: null, error }
    }
  }

  async function createClient(clientData: Partial<Client>) {
    try {
      const data = await $fetch<Client>('/api/clients', {
        method: 'POST',
        body: clientData,
      })

      toast?.add({
        title: 'Succès',
        description: 'Client créé avec succès',
        color: 'success',
      })

      return { data, error: null }
    } catch (err: any) {
      const error = err?.message || 'Erreur lors de la création du client'
      toast?.add({
        title: 'Erreur',
        description: error,
        color: 'error',
      })
      return { data: null, error }
    }
  }

  async function updateClient(id: string, clientData: Partial<Client>) {
    try {
      const data = await $fetch<Client>(`/api/clients/${id}`, {
        method: 'PUT',
        body: clientData,
      })

      toast?.add({
        title: 'Succès',
        description: 'Client mis à jour avec succès',
        color: 'success',
      })

      return { data, error: null }
    } catch (err: any) {
      const error = err?.message || 'Erreur lors de la mise à jour du client'
      toast?.add({
        title: 'Erreur',
        description: error,
        color: 'error',
      })
      return { data: null, error }
    }
  }

  return {
    fetchClients,
    fetchClient,
    createClient,
    updateClient,
  }
}

