// server/api/clients.post.ts
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Validation basique
  if (!body.nom || !body.prenom || !body.email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Les champs nom, prénom et email sont requis',
    })
  }

  const config = useRuntimeConfig()
  const baseUrl =
    config.public?.arianeCoreUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  // Adapter les données pour l'API CRM (name = prenom + nom, companyName = entreprise)
  // Note: L'API CRM ne stocke pas l'email dans Client, il faudrait créer une Person séparément
  const crmPayload: Record<string, any> = {
    name: `${body.prenom} ${body.nom}`,
  }
  if (body.entreprise) {
    crmPayload.companyName = body.entreprise
  }
  if (body.telephone) {
    crmPayload.telephone = body.telephone
  }

  try {
    const response = await $fetch<{ ok: boolean; data: any }>(
      `${baseUrl}/crm/clients`,
      {
        method: 'POST',
        body: crmPayload,
      },
    )

    if (!response.ok) {
      throw createError({
        statusCode: 500,
        message: 'Erreur lors de la création du client',
      })
    }

    // Adapter la réponse pour correspondre à l'interface attendue
    const crmClient = response.data
    return {
      id: crmClient.id,
      nom: body.nom,
      prenom: body.prenom,
      email: body.email,
      telephone: crmClient.telephone || body.telephone || null,
      entreprise: crmClient.companyName || body.entreprise || null,
      createdAt: crmClient.createdAt,
      updatedAt: crmClient.updatedAt,
    }
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.message || 'Erreur lors de la création du client',
    })
  }
})

