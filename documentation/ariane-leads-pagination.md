# Pagination de l'API leads Ariane

## Problème

L'API `GET /api/leads` d'Ariane Core retourne au maximum **100 leads** par requête et ne semble pas honorer les paramètres de pagination (`offset`, `skip`, `page`). Avec 2500+ leads, seuls les 100 premiers sont visibles dans ArianeAI.

## Solution requise

**Il faut modifier le backend Ariane** (le serveur exposé sur `ARIANE_API_BASE_URL` ou `ARIANE_CORE_URL`) pour :

1. **Accepter le paramètre `offset`** (ou `skip`) dans `GET /api/leads`
2. **Respecter une limite configurable** : si le client demande `limit=500`, retourner jusqu'à 500 éléments à partir de `offset`

### Exemple d'implémentation (pseudo-code)

```javascript
// GET /api/leads?limit=100&offset=200
const limit = parseInt(req.query.limit) || 100
const offset = parseInt(req.query.offset) || 0

const leads = await db.query(
  'SELECT * FROM leads ORDER BY priority_score DESC LIMIT ? OFFSET ?',
  [limit, offset]
)

return { leads, total: await getTotalCount() }
```

### Paramètres à supporter

| Paramètre | Description | Exemple |
|-----------|-------------|---------|
| `limit` | Nombre max d'éléments (défaut: 100) | `limit=100` |
| `offset` | Nombre d'éléments à sauter | `offset=200` |
| ou `skip` | Alias de offset (style MongoDB) | `skip=200` |

## Vérification

Une fois le backend modifié, ArianeAI fera automatiquement des requêtes chunkées (100 par 100) et fusionnera les résultats. Aucun changement côté frontend n'est nécessaire.

Pour tester manuellement :

```bash
# Première page (1-100)
curl "http://localhost:4000/api/leads?limit=100&offset=0"

# Deuxième page (101-200)
curl "http://localhost:4000/api/leads?limit=100&offset=100"
```

Les deux requêtes doivent retourner des leads différents.
