// server/api/clients/[id].put.ts
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
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'ID client requis',
    })
  }

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
  if (body.companyName !== undefined) crmPayload.companyName = body.companyName ? body.companyName.trim() : null
  if (body.industry !== undefined) crmPayload.industry = body.industry ? body.industry.trim() : null
  if (body.email !== undefined) crmPayload.email = body.email ? body.email.trim() : null
  if (body.phone !== undefined) crmPayload.phone = body.phone ? body.phone.trim() : null
  if (body.website !== undefined) crmPayload.website = body.website ? body.website.trim() : null
  if (body.address !== undefined) crmPayload.address = body.address ? body.address.trim() : null
  if (body.city !== undefined) crmPayload.city = body.city ? body.city.trim() : null
  if (body.postalCode !== undefined) crmPayload.postalCode = body.postalCode ? body.postalCode.trim() : null
  if (body.country !== undefined) crmPayload.country = body.country ? body.country.trim() : null
  if (body.source !== undefined) crmPayload.source = body.source
  if (Array.isArray(body.tags)) crmPayload.tags = body.tags
  if (body.notes !== undefined) crmPayload.notes = body.notes ? body.notes.trim() : null
  if (body.lastContactAt !== undefined) crmPayload.lastContactAt = body.lastContactAt
  if (body.nextFollowUpAt !== undefined) crmPayload.nextFollowUpAt = body.nextFollowUpAt

  try {
    const response = await $fetch<{ ok: boolean; data: any }>(
      `${baseUrl}/crm/clients/${id}`,
      {
        method: 'PATCH',
        body: crmPayload,
      },
    )

    if (!response.ok) {
      throw createError({
        statusCode: 500,
        message: 'Erreur lors de la mise à jour du client',
      })
    }

    return mapCrmClientToFrontend(response.data)
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.message || 'Erreur lors de la mise à jour du client',
    })
  }
})
