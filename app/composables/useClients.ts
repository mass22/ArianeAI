// app/composables/useClients.ts

/** Sources possibles pour le suivi CRM */
export type ClientSource =
  | 'referral'
  | 'linkedin'
  | 'cold_outreach'
  | 'existing_client'
  | 'job_board'
  | 'community'
  | 'other'

export interface Client {
  id: string
  name: string
  companyName: string | null
  industry: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  source: ClientSource | null
  tags: string[]
  notes: string | null
  lastContactAt: string | null
  nextFollowUpAt: string | null
  status: 'active' | 'archived'
  archivedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ClientsResponse {
  items: Client[]
  total: number
}

export interface ClientsQuery {
  status?: 'active' | 'archived'
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export function useClients() {
  let toast: ReturnType<typeof useToast> | null = null
  try {
    toast = useToast()
  } catch {
    // useToast peut ne pas être disponible dans certains contextes
  }

  async function fetchClients(query?: ClientsQuery) {
    try {
      const params: Record<string, string> = {}
      if (query?.status) params.status = query.status
      if (query?.search) params.search = query.search
      if (query?.sort) params.sort = query.sort
      if (query?.order) params.order = query.order
      if (query?.limit != null) params.limit = String(query.limit)
      if (query?.offset != null) params.offset = String(query.offset)

      const data = await $fetch<ClientsResponse>('/api/clients', {
        query: params,
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

  async function archiveClient(id: string) {
    try {
      await $fetch(`/api/clients/${id}/archive`, {
        method: 'POST',
      })
      toast?.add({
        title: 'Succès',
        description: 'Client archivé',
        color: 'success',
      })
      return { error: null }
    } catch (err: any) {
      const error = err?.message || 'Erreur lors de l\'archivage'
      toast?.add({
        title: 'Erreur',
        description: error,
        color: 'error',
      })
      return { error }
    }
  }

  async function reactivateClient(id: string) {
    try {
      await $fetch(`/api/clients/${id}/reactivate`, {
        method: 'POST',
      })
      toast?.add({
        title: 'Succès',
        description: 'Client réactivé',
        color: 'success',
      })
      return { error: null }
    } catch (err: any) {
      const error = err?.message || 'Erreur lors de la réactivation'
      toast?.add({
        title: 'Erreur',
        description: error,
        color: 'error',
      })
      return { error }
    }
  }

  async function deleteClient(id: string) {
    try {
      await $fetch(`/api/clients/${id}`, {
        method: 'DELETE',
        query: { confirm: 'true' },
      })
      toast?.add({
        title: 'Succès',
        description: 'Client supprimé',
        color: 'success',
      })
      return { error: null }
    } catch (err: any) {
      const msg = err?.data?.message ?? err?.data?.error ?? err?.message ?? 'Erreur lors de la suppression'
      toast?.add({
        title: 'Erreur',
        description: String(msg),
        color: 'error',
      })
      return { error: String(msg) }
    }
  }

  return {
    fetchClients,
    fetchClient,
    createClient,
    updateClient,
    archiveClient,
    reactivateClient,
    deleteClient,
  }
}
