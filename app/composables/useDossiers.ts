// app/composables/useDossiers.ts
export interface Dossier {
  id: string
  clientId: string
  titre: string
  description: string | null
  statut: 'en_attente' | 'en_cours' | 'resolu' | 'ferme'
  createdAt: string
  updatedAt: string
}

export interface DossiersResponse {
  items: Dossier[]
  total: number
}

export function useDossiers() {
  let toast: ReturnType<typeof useToast> | null = null
  try {
    toast = useToast()
  } catch {
    // useToast peut ne pas être disponible dans certains contextes
  }

  async function fetchDossiers(clientId: string) {
    try {
      const data = await $fetch<DossiersResponse>(
        `/api/clients/${clientId}/dossiers`,
      )

      return { data, error: null }
    } catch (err: any) {
      const error = err?.message || 'Erreur lors de la récupération des dossiers'
      toast?.add({
        title: 'Erreur',
        description: error,
        color: 'error',
      })
      return { data: null, error }
    }
  }

  async function createDossier(clientId: string, dossierData: Partial<Dossier>) {
    try {
      const data = await $fetch<Dossier>(`/api/clients/${clientId}/dossiers`, {
        method: 'POST',
        body: dossierData,
      })

      toast?.add({
        title: 'Succès',
        description: 'Dossier créé avec succès',
        color: 'success',
      })

      return { data, error: null }
    } catch (err: any) {
      const error = err?.message || 'Erreur lors de la création du dossier'
      toast?.add({
        title: 'Erreur',
        description: error,
        color: 'error',
      })
      return { data: null, error }
    }
  }

  return {
    fetchDossiers,
    createDossier,
  }
}

