// server/api/clients.post.ts
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
  const body = await readBody(event)

  if (!body.name?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Le champ nom est requis',
    })
  }

  const config = useRuntimeConfig()
  const baseUrl =
    config.public?.arianeCoreUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  const crmPayload: Record<string, any> = {
    name: body.name.trim(),
  }
  if (body.companyName) crmPayload.companyName = body.companyName.trim()
  if (body.industry) crmPayload.industry = body.industry.trim()
  if (body.email) crmPayload.email = body.email.trim()
  if (body.phone) crmPayload.phone = body.phone.trim()
  if (body.website) crmPayload.website = body.website.trim()
  if (body.address) crmPayload.address = body.address.trim()
  if (body.city) crmPayload.city = body.city.trim()
  if (body.postalCode) crmPayload.postalCode = body.postalCode.trim()
  if (body.country) crmPayload.country = body.country.trim()
  if (body.source) crmPayload.source = body.source
  if (Array.isArray(body.tags)) crmPayload.tags = body.tags
  if (body.notes) crmPayload.notes = body.notes.trim()
  if (body.lastContactAt) crmPayload.lastContactAt = body.lastContactAt
  if (body.nextFollowUpAt) crmPayload.nextFollowUpAt = body.nextFollowUpAt

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

    return mapCrmClientToFrontend(response.data)
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.message || 'Erreur lors de la création du client',
    })
  }
})
