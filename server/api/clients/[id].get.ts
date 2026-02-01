// server/api/clients/[id].get.ts
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
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
    const response = await $fetch<{ ok: boolean; data: any }>(
      `${baseUrl}/crm/clients/${id}`,
    )

    if (!response.ok || !response.data) {
      throw createError({
        statusCode: 404,
        message: 'Client non trouvé',
      })
    }

    // Adapter la réponse CRM vers l'interface attendue
    const crmClient = response.data
    // Extraire nom et prénom du champ "name" (format: "Prénom Nom")
    const nameParts = (crmClient.name || '').split(' ')
    const prenom = nameParts[0] || ''
    const nom = nameParts.slice(1).join(' ') || ''

    return {
      id: crmClient.id,
      nom,
      prenom,
      email: '', // L'API CRM ne stocke pas l'email dans Client, il est dans Person
      telephone: crmClient.telephone || null,
      entreprise: crmClient.companyName || null,
      createdAt: crmClient.createdAt,
      updatedAt: crmClient.updatedAt,
    }
  } catch (err: any) {
    if (err.statusCode === 404) {
      throw err
    }
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.message || 'Erreur lors de la récupération du client',
    })
  }
})

