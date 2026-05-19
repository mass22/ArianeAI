// server/api/clients/[id].get.ts
import { createError } from 'h3'

function mapCrmClientToFrontend(crmClient: any) {
  return {
    id: crmClient.id,
    name: crmClient.name ?? '',
    companyName: crmClient.companyName ?? null,
    industry: crmClient.industry ?? null,
    email: crmClient.email ?? null,
    phone: crmClient.phone ?? crmClient.telephone ?? null,
    website: crmClient.website ?? null,
    address: crmClient.address ?? null,
    city: crmClient.city ?? null,
    postalCode: crmClient.postalCode ?? null,
    country: crmClient.country ?? null,
    source: crmClient.source ?? null,
    tags: Array.isArray(crmClient.tags) ? crmClient.tags : [],
    notes: crmClient.notes ?? null,
    lastContactAt: crmClient.lastContactAt ?? null,
    nextFollowUpAt: crmClient.nextFollowUpAt ?? null,
    status: crmClient.status ?? 'active',
    archivedAt: crmClient.archivedAt ?? null,
    createdAt: crmClient.createdAt,
    updatedAt: crmClient.updatedAt,
  }
}

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

    return mapCrmClientToFrontend(response.data)
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
