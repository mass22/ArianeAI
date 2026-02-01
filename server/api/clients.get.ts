// server/api/clients.get.ts
import { createError } from 'h3'

// Cache pour limiter les logs d'erreur répétés
let lastErrorLogTime = 0
const ERROR_LOG_INTERVAL = 60000 // Logger l'erreur max 1 fois par minute

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const search = query.search as string | undefined
  const limit = query.limit as string | undefined
  const offset = query.offset as string | undefined

  const config = useRuntimeConfig()
  const baseUrl =
    config.public?.arianeCoreUrl ||
    config.arianeCoreUrl ||
    'http://127.0.0.1:4000'

  const queryParams: Record<string, string> = {}
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

  // Adapter la réponse CRM vers l'interface attendue
  // CRM utilise "name" (format: "Prénom Nom"), on adapte vers "nom" et "prenom"
  let clients = (response.data || []).map((crmClient: any) => {
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
  })

    // Filtrer par recherche si fourni (l'API CRM ne supporte pas le paramètre search)
    if (search) {
      const searchLower = search.toLowerCase()
      clients = clients.filter((client) => {
        return (
          client.nom.toLowerCase().includes(searchLower) ||
          client.prenom.toLowerCase().includes(searchLower) ||
          (client.entreprise && client.entreprise.toLowerCase().includes(searchLower))
        )
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
