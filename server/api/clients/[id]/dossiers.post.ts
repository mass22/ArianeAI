// server/api/clients/[id]/dossiers.post.ts
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const clientId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!clientId) {
    throw createError({
      statusCode: 400,
      message: 'ID client requis',
    })
  }

  // Validation basique
  if (!body.titre) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Le champ titre est requis',
    })
  }

  const config = useRuntimeConfig()
  const baseUrl =
    config.public?.arianeCoreUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  // Adapter les données pour l'API CRM
  // CRM utilise "name" et "status", on adapte depuis "titre" et "statut"
  const statusMap: Record<string, string> = {
    en_attente: 'active',
    en_cours: 'active',
    resolu: 'active',
    ferme: 'archived',
  }

  const crmPayload = {
    clientId,
    name: body.titre,
    description: body.description || undefined,
    status: statusMap[body.statut as string] || 'active',
  }

  try {
    const response = await $fetch<{ ok: boolean; data: any }>(
      `${baseUrl}/crm/dossiers`,
      {
        method: 'POST',
        body: crmPayload,
      },
    )

    if (!response.ok) {
      throw createError({
        statusCode: 500,
        message: 'Erreur lors de la création du dossier',
      })
    }

    // Adapter la réponse pour correspondre à l'interface attendue
    const crmDossier = response.data
    const statutMap: Record<string, string> = {
      active: 'en_cours',
      archived: 'ferme',
    }

    return {
      id: crmDossier.id,
      clientId: crmDossier.clientId,
      titre: crmDossier.name,
      description: crmDossier.description || null,
      statut: statutMap[crmDossier.status] || 'en_attente',
      createdAt: crmDossier.createdAt,
      updatedAt: crmDossier.updatedAt,
    }
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.message || 'Erreur lors de la création du dossier',
    })
  }
})

