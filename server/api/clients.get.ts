// server/api/clients.get.ts
import { createError } from 'h3'

// Cache pour limiter les logs d'erreur répétés
let lastErrorLogTime = 0
const ERROR_LOG_INTERVAL = 60000 // Logger l'erreur max 1 fois par minute

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
  const query = getQuery(event)
  const search = query.search as string | undefined
  const status = query.status as 'active' | 'archived' | undefined
  const limit = query.limit as string | undefined
  const offset = query.offset as string | undefined
  const sort = query.sort as string | undefined
  const order = query.order as 'asc' | 'desc' | undefined

  const config = useRuntimeConfig()
  const baseUrl =
    config.public?.arianeCoreUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  const queryParams: Record<string, string> = {}
  if (status) queryParams.status = status
  if (limit) queryParams.limit = limit
  if (offset) queryParams.offset = offset

  try {
    const response = await $fetch<{ ok: boolean; data: any[]; total: number; limit?: number; offset?: number; hasMore?: boolean }>(
      `${baseUrl}/crm/clients`,
      {
        query: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      },
    )

    // Réinitialiser le cache d'erreur en cas de succès
    lastErrorLogTime = 0

    if (!response.ok) {
      throw createError({
        statusCode: 500,
        message: 'Erreur lors de la récupération des clients',
      })
    }

    let clients = (response.data || []).map(mapCrmClientToFrontend)

    // Fallback: filtre par status côté serveur si le backend ne le gère pas
    if (status) {
      clients = clients.filter((c: any) => c.status === status)
    }

    // Filtrer par recherche si fourni (l'API CRM ne supporte pas toujours le paramètre search)
    if (search) {
      const searchLower = search.toLowerCase()
      clients = clients.filter((c) => {
        const name = (c.name || '').toLowerCase()
        const company = (c.companyName || '').toLowerCase()
        const email = (c.email || '').toLowerCase()
        return name.includes(searchLower) || company.includes(searchLower) || email.includes(searchLower)
      })
    }

    // Tri côté serveur si demandé
    if (sort) {
      const dir = order === 'desc' ? -1 : 1
      clients.sort((a: any, b: any) => {
        let va = a[sort]
        let vb = b[sort]
        if (sort === 'name') {
          va = (va || '').toLowerCase()
          vb = (vb || '').toLowerCase()
        }
        if (sort === 'lastContactAt' || sort === 'nextFollowUpAt') {
          va = va ? new Date(va).getTime() : 0
          vb = vb ? new Date(vb).getTime() : 0
        }
        if (va < vb) return -dir
        if (va > vb) return dir
        return 0
      })
    }

    return {
      items: clients,
      total: clients.length,
    }
  } catch (err: any) {
    const now = Date.now()
    const isConnectionError = err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED') || err?.cause?.code === 'ENOTFOUND'

    // Logger l'erreur seulement si :
    // - Ce n'est pas une erreur de connexion connue, OU
    // - On n'a pas loggé d'erreur depuis ERROR_LOG_INTERVAL ms
    if (!isConnectionError || (now - lastErrorLogTime) > ERROR_LOG_INTERVAL) {
      if (isConnectionError) {
        console.warn(`[api/clients] Serveur Ariane Core inaccessible sur ${baseUrl}. Vérifiez que le serveur est démarré.`)
      } else {
        console.error('[api/clients] error:', err)
      }
      lastErrorLogTime = now
    }

    // Retourner une réponse vide plutôt que de faire planter l'application
    return {
      items: [],
      total: 0,
      error: true,
      message: 'Impossible de récupérer les clients',
    }
  }
})
