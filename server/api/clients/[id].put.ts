// server/api/clients/[id].put.ts
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'ID client requis',
    })
  }

  // Validation basique
  if (!body.nom || !body.prenom) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Les champs nom et prénom sont requis',
    })
  }

  const config = useRuntimeConfig()
  const baseUrl =
    config.public?.arianeCoreUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  // Adapter les données pour l'API CRM
  // Note: L'API CRM ne stocke pas l'email dans Client, il faudrait mettre à jour une Person séparément
  const crmPayload: Record<string, any> = {}
  if (body.nom || body.prenom) {
    crmPayload.name = `${body.prenom} ${body.nom}`.trim()
  }
  if (body.entreprise !== undefined) {
    crmPayload.companyName = body.entreprise || undefined
  }
  if (body.telephone !== undefined) {
    crmPayload.telephone = body.telephone || undefined
  }

  console.log(`[PUT /api/clients/${id}] Envoi à Ariane Core:`, {
    url: `${baseUrl}/crm/clients/${id}`,
    payload: crmPayload,
  })

  try {
    const response = await $fetch<{ ok: boolean; data: any }>(
      `${baseUrl}/crm/clients/${id}`,
      {
        method: 'PATCH',
        body: crmPayload,
      },
    )

    console.log(`[PUT /api/clients/${id}] Réponse d'Ariane Core:`, response)

    if (!response.ok) {
      console.error(`[PUT /api/clients/${id}] Erreur: response.ok = false`)
      throw createError({
        statusCode: 500,
        message: 'Erreur lors de la mise à jour du client',
      })
    }

    // Adapter la réponse pour correspondre à l'interface attendue
    const crmClient = response.data
    const nameParts = (crmClient.name || '').split(' ')
    const prenom = nameParts[0] || ''
    const nom = nameParts.slice(1).join(' ') || ''

    return {
      id: crmClient.id,
      nom,
      prenom,
      email: body.email || '', // L'API CRM ne stocke pas l'email dans Client, on garde celui fourni
      telephone: crmClient.telephone || body.telephone || null,
      entreprise: crmClient.companyName || body.entreprise || null,
      createdAt: crmClient.createdAt,
      updatedAt: crmClient.updatedAt,
    }
  } catch (err: any) {
    console.error(`[PUT /api/clients/${id}] Erreur lors de la mise à jour:`, {
      statusCode: err.statusCode,
      message: err.message,
      data: err.data,
      stack: err.stack,
    })
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.message || 'Erreur lors de la mise à jour du client',
    })
  }
})

