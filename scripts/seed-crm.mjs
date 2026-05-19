#!/usr/bin/env node
/**
 * Script de seed CRM : nettoie les clients existants et crée des clients fictifs avec dossiers.
 * Requiert Ariane Core en cours d'exécution (par défaut http://127.0.0.1:4000).
 *
 * Usage: node scripts/seed-crm.mjs
 *        ARIANE_CORE_URL=http://localhost:4000 node scripts/seed-crm.mjs
 */

const BASE_URL = process.env.ARIANE_CORE_URL || 'http://127.0.0.1:4000'
const CRM = `${BASE_URL}/crm`

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`)
  }
  return text ? JSON.parse(text) : {}
}

async function cleanClients() {
  console.log('📋 Récupération des clients existants...')
  const { ok, data: clients } = await fetchJson(`${CRM}/clients?limit=500`)
  if (!ok || !clients?.length) {
    console.log('   Aucun client à supprimer.')
    return
  }
  console.log(`   ${clients.length} client(s) trouvé(s).`)

  for (const client of clients) {
    const clientId = client.id
    const clientName = client.name || clientId

    // Récupérer les dossiers du client
    const { ok: dok, data: dossiers } = await fetchJson(`${CRM}/dossiers?clientId=${clientId}`)
    if (dok && dossiers?.length) {
      for (const dossier of dossiers) {
        // Récupérer les artifacts du dossier
        const { ok: aok, data: artifacts } = await fetchJson(
          `${CRM}/artifacts?dossierId=${dossier.id}&limit=100`,
        )
        if (aok && artifacts?.length) {
          for (const art of artifacts) {
            try {
              await fetchJson(`${CRM}/artifacts/${art.id}`, { method: 'DELETE' })
              console.log(`      → Artifact supprimé: ${art.id}`)
            } catch (e) {
              console.warn(`      ⚠ Artifact ${art.id}: ${e.message}`)
            }
          }
        }
        // Supprimer le dossier
        try {
          await fetchJson(`${CRM}/dossiers/${dossier.id}`, { method: 'DELETE' })
          console.log(`   → Dossier supprimé: ${dossier.name || dossier.id}`)
        } catch (e) {
          console.warn(`   ⚠ Dossier ${dossier.id}: ${e.message}`)
        }
      }
    }

    // Récupérer les persons du client
    const { ok: pok, data: persons } = await fetchJson(`${CRM}/persons?clientId=${clientId}`)
    if (pok && persons?.length) {
      for (const person of persons) {
        try {
          await fetchJson(`${CRM}/persons/${person.id}`, { method: 'DELETE' })
          console.log(`   → Personne supprimée: ${person.fullName || person.id}`)
        } catch (e) {
          console.warn(`   ⚠ Person ${person.id}: ${e.message}`)
        }
      }
    }

    // Artifacts orphelins (clientId sans dossier)
    const { ok: caok, data: clientArtifacts } = await fetchJson(
      `${CRM}/artifacts?clientId=${clientId}&limit=100`,
    )
    if (caok && clientArtifacts?.length) {
      for (const art of clientArtifacts) {
        try {
          await fetchJson(`${CRM}/artifacts/${art.id}`, { method: 'DELETE' })
          console.log(`   → Artifact supprimé: ${art.id}`)
        } catch (e) {
          console.warn(`   ⚠ Artifact ${art.id}: ${e.message}`)
        }
      }
    }

    // Supprimer le client
    try {
      await fetchJson(`${CRM}/clients/${clientId}?confirm=true`, {
        method: 'DELETE',
      })
      console.log(`   → Client supprimé: ${clientName}`)
    } catch (e) {
      console.warn(`   ⚠ Client ${clientName}: ${e.message}`)
    }
  }
  console.log('✅ Nettoyage terminé.')
}

const FICTIONAL_CLIENTS = [
  {
    name: 'Sophie Martin',
    companyName: 'TechVision Inc.',
    industry: 'Logiciel SaaS',
    email: 'sophie.martin@techvision.io',
    phone: '+33 6 12 34 56 78',
    website: 'https://techvision.io',
    address: '42 avenue des Champs-Élysées',
    city: 'Paris',
    postalCode: '75008',
    country: 'France',
    source: 'linkedin',
    tags: ['vip', 'prospect-chaud'],
    notes: 'Intéressée par une démo. Relancer la semaine prochaine.',
    lastContactAt: '2025-02-20',
    nextFollowUpAt: '2025-02-27',
    dossiers: [
      { name: 'Démo produit', description: 'Proposition démo Q1 2025', status: 'active' },
      { name: 'Contrat cadre', description: 'Négociation conditions commerciales', status: 'active' },
    ],
  },
  {
    name: 'Pierre Dubois',
    companyName: 'GreenEnergy SARL',
    industry: 'Energies renouvelables',
    email: 'p.dubois@greenenergy.fr',
    phone: '+33 1 23 45 67 89',
    website: 'https://greenenergy.fr',
    address: '15 rue du Commerce',
    city: 'Lyon',
    postalCode: '69002',
    country: 'France',
    source: 'referral',
    tags: ['partenaire'],
    notes: 'Recommandé par Jean Lefebvre. Premier contact réussi.',
    lastContactAt: '2025-02-18',
    nextFollowUpAt: '2025-03-01',
    dossiers: [
      { name: 'Audit énergétique', description: 'Étude de faisabilité installation', status: 'active' },
      { name: 'Formation équipe', description: 'Sensibilisation équipes techniques', status: 'en_attente' },
    ],
  },
  {
    name: 'Marie Lefèvre',
    companyName: 'Agence Créative',
    industry: 'Communication',
    email: 'marie@agencecreative.com',
    phone: '+33 4 56 78 90 12',
    website: 'https://agencecreative.com',
    address: '8 place de la Bourse',
    city: 'Bordeaux',
    postalCode: '33000',
    country: 'France',
    source: 'cold_outreach',
    tags: ['nouveau'],
    notes: 'Prospection LinkedIn. Réponse favorable.',
    lastContactAt: '2025-02-22',
    nextFollowUpAt: '2025-02-28',
    dossiers: [
      { name: 'Refonte site web', description: 'Projet refonte complète', status: 'active' },
    ],
  },
  {
    name: 'Thomas Bernard',
    companyName: 'LogiTrans Express',
    industry: 'Logistique',
    email: 't.bernard@logitrans.fr',
    phone: '+33 3 12 34 56 78',
    city: 'Lille',
    postalCode: '59000',
    country: 'France',
    source: 'existing_client',
    tags: ['client-historique', 'renouvellement'],
    notes: 'Contrat à renouveler en mars. Proposer offre fidélité.',
    lastContactAt: '2025-01-15',
    nextFollowUpAt: '2025-02-25',
    dossiers: [
      { name: 'Renouvellement annuel', description: 'Contrat 2025', status: 'active' },
      { name: 'Extension services', description: 'Nouveaux trajets à couvrir', status: 'en_cours' },
    ],
  },
]

async function createClients() {
  console.log('\n📦 Création des clients fictifs...')
  for (const data of FICTIONAL_CLIENTS) {
    const { dossiers, ...clientData } = data
    const payload = {
      name: clientData.name,
      companyName: clientData.companyName || undefined,
      industry: clientData.industry || undefined,
      email: clientData.email || undefined,
      phone: clientData.phone || undefined,
      website: clientData.website || undefined,
      address: clientData.address || undefined,
      city: clientData.city || undefined,
      postalCode: clientData.postalCode || undefined,
      country: clientData.country || undefined,
      source: clientData.source || undefined,
      tags: clientData.tags || undefined,
      notes: clientData.notes || undefined,
      lastContactAt: clientData.lastContactAt || undefined,
      nextFollowUpAt: clientData.nextFollowUpAt || undefined,
    }
    // Retirer les undefined
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k])
    const { ok, data: client } = await fetchJson(`${CRM}/clients`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!ok || !client?.id) {
      throw new Error(`Échec création client: ${clientData.name}`)
    }
    console.log(`   ✓ Client créé: ${client.name} (${client.id})`)
    for (const d of dossiers || []) {
      const dPayload = {
        clientId: client.id,
        name: d.name,
        description: d.description || undefined,
        status: d.status === 'ferme' ? 'archived' : 'active',
      }
      Object.keys(dPayload).forEach((k) => dPayload[k] === undefined && delete dPayload[k])
      const { ok: dok, data: dossier } = await fetchJson(`${CRM}/dossiers`, {
        method: 'POST',
        body: JSON.stringify(dPayload),
      })
      if (dok && dossier?.id) {
        console.log(`      → Dossier: ${dossier.name}`)
      }
    }
  }
  console.log('✅ Clients fictifs créés.')
}

async function main() {
  console.log('🌱 Seed CRM — Nettoyage et création de données fictives')
  console.log(`   Base URL: ${BASE_URL}\n`)
  try {
    await fetchJson(`${BASE_URL}/crm/clients?limit=1`)
  } catch (e) {
    console.error('❌ Impossible de contacter Ariane Core. Vérifiez que le serveur est démarré.')
    console.error(`   URL: ${BASE_URL}`)
    console.error(`   Erreur: ${e.message}`)
    process.exit(1)
  }
  await cleanClients()
  await createClients()
  console.log('\n✨ Terminé.')
}

main().catch((e) => {
  console.error('❌ Erreur:', e.message)
  process.exit(1)
})
