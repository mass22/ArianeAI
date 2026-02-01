// server/api/clients/[id]/dossiers.get.ts
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const clientId = getRouterParam(event, 'id')

  if (!clientId) {
    throw createError({
      statusCode: 400,
      message: 'ID client requis',
    })
  }

  const config = useRuntimeConfig()
  const baseUrl =
    config.public?.arianeCoreUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  try {
    const response = await $fetch<{ ok: boolean; data: any[]; total: number }>(
      `${baseUrl}/crm/dossiers`,
      {
        query: { clientId },
      },
    )

    if (!response.ok) {
      throw createError({
        statusCode: 500,
        message: 'Erreur lors de la récupération des dossiers',
      })
    }

    // Adapter la réponse CRM vers l'interface attendue
    // CRM utilise "name" et "status", on adapte vers "titre" et "statut"
    const dossiers = (response.data || []).map((dossier) => ({
      id: dossier.id,
      clientId: dossier.clientId,
      titre: dossier.name,
      description: dossier.description || null,
      statut: dossier.status === 'active' ? 'en_cours' : dossier.status === 'archived' ? 'ferme' : 'en_attente',
      createdAt: dossier.createdAt,
      updatedAt: dossier.updatedAt,
    }))

    return {
      items: dossiers,
      total: response.total || dossiers.length,
    }
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.message || 'Erreur lors de la récupération des dossiers',
    })
  }
})

