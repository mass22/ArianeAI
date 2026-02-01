# CRM Lite - Documentation

## Vue d'ensemble

Le module CRM Lite d'Ariane Core fournit une couche de contextualisation légère pour le RAG (Retrieval-Augmented Generation). Il permet de structurer et gérer les relations entre clients, dossiers, personnes et artifacts (documents, réunions, emails, etc.).

### Objectif

Créer une couche "CRM lite" pour contextualiser le RAG en permettant :
- L'organisation des données par client et dossier
- Le suivi des personnes et de leurs rôles
- La gestion des artifacts (réunions, PDFs, emails, notes) avec métadonnées
- La recherche et le filtrage contextualisé pour le RAG

## Architecture

### Modèle de données

```
Client (1) ──< (N) Dossier
  │
  ├──< (N) Person
  │
  └──< (N) Artifact
         │
         └──> (0..1) Dossier
```

#### Entités

**Client**
- `id` : Identifiant unique
- `name` : Nom du client (requis)
- `companyName` : Nom de l'entreprise (optionnel)
- `industry` : Secteur d'activité (optionnel)
- `tags` : Tableau de tags (optionnel)
- `createdAt` : Date de création
- `updatedAt` : Date de mise à jour

**Dossier (Project)**
- `id` : Identifiant unique
- `clientId` : ID du client propriétaire (requis)
- `name` : Nom du dossier (requis)
- `description` : Description (optionnel)
- `status` : Statut (`active` | `archived`)
- `createdAt` : Date de création
- `updatedAt` : Date de mise à jour

**Person**
- `id` : Identifiant unique
- `clientId` : ID du client (requis)
- `fullName` : Nom complet (requis)
- `role` : Rôle/fonction (optionnel)
- `email` : Email (optionnel, validé)
- `createdAt` : Date de création
- `updatedAt` : Date de mise à jour

**Artifact**
- `id` : Identifiant unique
- `clientId` : ID du client (requis)
- `dossierId` : ID du dossier (optionnel)
- `type` : Type (`meeting` | `pdf` | `email` | `note` | `other`)
- `title` : Titre (requis)
- `source` : Source (`upload` | `manual` | `import`)
- `fileName` : Nom du fichier (optionnel)
- `mimeType` : Type MIME (optionnel)
- `size` : Taille en octets (optionnel)
- `storagePath` : Chemin de stockage (optionnel)
- `textContent` : Contenu texte (optionnel)
- `metadata` : Objet JSON de métadonnées (optionnel)
- `createdAt` : Date de création

### Stockage

Le CRM utilise un stockage basé sur fichiers JSONL (JSON Lines) :
- Un fichier par entité : `data/crm/{entity}.jsonl`
- Format : une ligne JSON par enregistrement
- Pas de base de données requise

**Avantages** :
- Simple à déployer (pas de DB)
- Facile à migrer vers une vraie DB plus tard
- Versionnable avec Git
- Performant pour des volumes modérés

**Limitations** :
- Pas de transactions ACID
- Pas de requêtes complexes (jointures, etc.)
- Performance limitée pour très gros volumes (>100k enregistrements)

### Structure des fichiers

```
crm/
├── storage.mjs              # Utilitaires de stockage JSONL
├── models.mjs               # Définitions des modèles
├── repositories/            # Couche d'accès aux données
│   ├── clientRepository.mjs
│   ├── dossierRepository.mjs
│   ├── personRepository.mjs
│   └── artifactRepository.mjs
├── services/                # Logique métier + validation
│   ├── clientService.mjs
│   ├── dossierService.mjs
│   ├── personService.mjs
│   └── artifactService.mjs
└── validators.mjs           # Validation des payloads

api/routes/
├── crm.mjs                  # Routes Express
└── crm-handlers.mjs         # Handlers avec pagination et upload

tests/crm/                   # Tests unitaires
```

## Installation et Setup

### Prérequis

- Node.js 18+
- Express (déjà dans les dépendances)

### Migration initiale

Créer les fichiers de stockage vides :

```bash
node scripts/crm-migrate.mjs
```

Cela crée les fichiers suivants dans `data/crm/` :
- `clients.jsonl`
- `dossiers.jsonl`
- `persons.jsonl`
- `artifacts.jsonl`

### Configuration

Variables d'environnement optionnelles :

```bash
# Répertoire de stockage des données CRM
CRM_DATA_DIR=/path/to/crm/data

# Répertoire de stockage des fichiers uploadés
ARTIFACTS_UPLOAD_DIR=/path/to/uploads
```

Par défaut :
- `CRM_DATA_DIR` = `./data/crm`
- `ARTIFACTS_UPLOAD_DIR` = `./data/crm/uploads`

### Intégration dans le serveur

Les routes CRM sont déjà intégrées dans `api/server.mjs` :

```javascript
import { registerCrmRoutes } from './routes/crm.mjs'
registerCrmRoutes(app)
```

## API REST

### Base URL

Toutes les routes sont préfixées par `/crm`

### Format de réponse standard

**Succès** :
```json
{
  "ok": true,
  "data": { ... }
}
```

**Erreur** :
```json
{
  "ok": false,
  "error": "Message d'erreur"
}
```

### Pagination

Toutes les routes de liste supportent la pagination :

**Paramètres** :
- `limit` : Nombre d'éléments par page (1-1000, défaut: tous)
- `offset` : Nombre d'éléments à sauter (défaut: 0)

**Réponse paginée** :
```json
{
  "ok": true,
  "data": [...],
  "total": 50,
  "limit": 10,
  "offset": 0,
  "hasMore": true
}
```

### Codes HTTP

- `200` : Succès
- `201` : Créé
- `400` : Erreur de validation
- `404` : Ressource non trouvée
- `409` : Conflit (ex: suppression impossible)
- `500` : Erreur serveur

---

## Endpoints Clients

### GET /crm/clients

Liste tous les clients avec pagination.

**Query params** :
- `limit` : Nombre d'éléments (optionnel)
- `offset` : Offset (optionnel)

**Exemple** :
```bash
curl "http://localhost:4000/crm/clients?limit=10&offset=0"
```

**Réponse** :
```json
{
  "ok": true,
  "data": [
    {
      "id": "123-abc",
      "name": "Acme Corp",
      "companyName": "Acme Corporation",
      "industry": "Tech",
      "tags": ["vip", "important"],
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0,
  "hasMore": false
}
```

### GET /crm/clients/:id

Récupère un client par son ID.

**Exemple** :
```bash
curl "http://localhost:4000/crm/clients/123-abc"
```

### POST /crm/clients

Crée un nouveau client.

**Body** :
```json
{
  "name": "Acme Corp",
  "companyName": "Acme Corporation",
  "industry": "Tech",
  "tags": ["vip"]
}
```

**Champs requis** : `name`

**Exemple** :
```bash
curl -X POST "http://localhost:4000/crm/clients" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "industry": "Tech"}'
```

### PATCH /crm/clients/:id

Met à jour partiellement un client.

**Body** :
```json
{
  "industry": "Finance",
  "tags": ["vip", "urgent"]
}
```

**Exemple** :
```bash
curl -X PATCH "http://localhost:4000/crm/clients/123-abc" \
  -H "Content-Type: application/json" \
  -d '{"industry": "Finance"}'
```

### PUT /crm/clients/:id

Met à jour complètement un client (compatibilité arrière, même comportement que PATCH).

### DELETE /crm/clients/:id

Supprime un client. Échoue si le client a des dossiers, personnes ou artifacts liés.

**Exemple** :
```bash
curl -X DELETE "http://localhost:4000/crm/clients/123-abc"
```

---

## Endpoints Dossiers

### GET /crm/dossiers

Liste les dossiers avec pagination et filtrage.

**Query params** :
- `clientId` : Filtrer par client (optionnel)
- `limit` : Pagination (optionnel)
- `offset` : Pagination (optionnel)

**Exemple** :
```bash
curl "http://localhost:4000/crm/dossiers?clientId=123-abc&limit=10"
```

### GET /crm/dossiers/:id

Récupère un dossier par son ID.

### POST /crm/dossiers

Crée un nouveau dossier.

**Body** :
```json
{
  "clientId": "123-abc",
  "name": "Projet Alpha",
  "description": "Description du projet",
  "status": "active"
}
```

**Champs requis** : `clientId`, `name`

**Exemple** :
```bash
curl -X POST "http://localhost:4000/crm/dossiers" \
  -H "Content-Type: application/json" \
  -d '{"clientId": "123-abc", "name": "Projet Alpha", "status": "active"}'
```

### PATCH /crm/dossiers/:id

Met à jour partiellement un dossier.

**Body** :
```json
{
  "status": "archived",
  "description": "Projet terminé"
}
```

### DELETE /crm/dossiers/:id

Supprime un dossier. Échoue si le dossier a des artifacts liés.

---

## Endpoints Persons

### GET /crm/persons

Liste les personnes avec pagination et filtrage.

**Query params** :
- `clientId` : Filtrer par client (optionnel)
- `limit` : Pagination (optionnel)
- `offset` : Pagination (optionnel)

**Exemple** :
```bash
curl "http://localhost:4000/crm/persons?clientId=123-abc"
```

### GET /crm/persons/:id

Récupère une personne par son ID.

### POST /crm/persons

Crée une nouvelle personne.

**Body** :
```json
{
  "clientId": "123-abc",
  "fullName": "John Doe",
  "role": "CEO",
  "email": "john@example.com"
}
```

**Champs requis** : `clientId`, `fullName`

**Validation** : `email` doit être valide si fourni

**Exemple** :
```bash
curl -X POST "http://localhost:4000/crm/persons" \
  -H "Content-Type: application/json" \
  -d '{"clientId": "123-abc", "fullName": "John Doe", "email": "john@example.com"}'
```

### PATCH /crm/persons/:id

Met à jour partiellement une personne.

### DELETE /crm/persons/:id

Supprime une personne.

---

## Endpoints Artifacts

### GET /crm/artifacts

Liste les artifacts avec pagination et filtres multiples.

**Query params** :
- `clientId` : Filtrer par client (optionnel)
- `dossierId` : Filtrer par dossier (optionnel)
- `type` : Filtrer par type (optionnel)
- `limit` : Pagination (optionnel)
- `offset` : Pagination (optionnel)

**Exemple** :
```bash
curl "http://localhost:4000/crm/artifacts?clientId=123-abc&type=meeting&limit=20"
```

### GET /crm/artifacts/:id

Récupère un artifact par son ID.

### POST /crm/artifacts

Crée un nouvel artifact. Supporte l'upload de fichier optionnel.

**Body (sans fichier)** :
```json
{
  "clientId": "123-abc",
  "dossierId": "456-def",
  "type": "meeting",
  "title": "Réunion client",
  "source": "manual",
  "textContent": "Notes de la réunion...",
  "metadata": {
    "duration": 30,
    "participants": ["John", "Jane"]
  }
}
```

**Body (avec fichier base64)** :
```json
{
  "clientId": "123-abc",
  "type": "pdf",
  "title": "Contrat",
  "source": "upload",
  "fileName": "contrat.pdf",
  "mimeType": "application/pdf",
  "fileData": "base64EncodedFileContent..."
}
```

**Champs requis** : `clientId`, `type`, `title`, `source`

**Types supportés** : `meeting`, `pdf`, `email`, `note`, `other`

**Sources supportées** : `upload`, `manual`, `import`

**Exemple (sans fichier)** :
```bash
curl -X POST "http://localhost:4000/crm/artifacts" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "123-abc",
    "type": "meeting",
    "title": "Réunion client",
    "source": "manual",
    "textContent": "Notes..."
  }'
```

**Exemple (avec fichier)** :
```bash
# Encoder le fichier en base64
FILE_B64=$(base64 -i contrat.pdf)

curl -X POST "http://localhost:4000/crm/artifacts" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"123-abc\",
    \"type\": \"pdf\",
    \"title\": \"Contrat\",
    \"source\": \"upload\",
    \"fileName\": \"contrat.pdf\",
    \"mimeType\": \"application/pdf\",
    \"fileData\": \"$FILE_B64\"
  }"
```

### PATCH /crm/artifacts/:id

Met à jour partiellement un artifact.

**Exemple** :
```bash
curl -X PATCH "http://localhost:4000/crm/artifacts/789-ghi" \
  -H "Content-Type: application/json" \
  -d '{"title": "Nouveau titre", "metadata": {"updated": true}}'
```

### DELETE /crm/artifacts/:id

Supprime un artifact (et le fichier associé si présent).

---

## Use Cases

### 1. Créer un client et son premier dossier

```bash
# 1. Créer le client
CLIENT=$(curl -s -X POST "http://localhost:4000/crm/clients" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "industry": "Tech"}')

CLIENT_ID=$(echo $CLIENT | jq -r '.data.id')

# 2. Créer un dossier pour ce client
curl -X POST "http://localhost:4000/crm/dossiers" \
  -H "Content-Type: application/json" \
  -d "{\"clientId\": \"$CLIENT_ID\", \"name\": \"Projet Alpha\", \"status\": \"active\"}"
```

### 2. Importer une réunion comme artifact

```bash
# Créer un artifact de type "meeting" avec transcription
curl -X POST "http://localhost:4000/crm/artifacts" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "123-abc",
    "dossierId": "456-def",
    "type": "meeting",
    "title": "Réunion du 15 janvier",
    "source": "import",
    "textContent": "Transcription complète de la réunion...",
    "metadata": {
      "date": "2025-01-15",
      "duration": 45,
      "participants": ["John Doe", "Jane Smith"]
    }
  }'
```

### 3. Rechercher tous les artifacts d'un client pour le RAG

```bash
# Récupérer tous les artifacts d'un client (pour contextualiser le RAG)
curl "http://localhost:4000/crm/artifacts?clientId=123-abc&limit=100" | jq '.data[] | {id, type, title, textContent}'
```

### 4. Lister les personnes d'un client

```bash
curl "http://localhost:4000/crm/persons?clientId=123-abc" | jq '.data[] | {fullName, role, email}'
```

### 5. Archiver un dossier et ses artifacts

```bash
# 1. Archiver le dossier
curl -X PATCH "http://localhost:4000/crm/dossiers/456-def" \
  -H "Content-Type: application/json" \
  -d '{"status": "archived"}'

# 2. Filtrer les artifacts archivés (via metadata si nécessaire)
curl "http://localhost:4000/crm/artifacts?dossierId=456-def"
```

---

## Intégration avec le RAG

Le CRM peut être utilisé pour contextualiser les requêtes RAG :

### Exemple : Recherche contextualisée par client

```javascript
// 1. Récupérer le contexte du client
const client = await fetch('/crm/clients/123-abc').then(r => r.json())
const artifacts = await fetch('/crm/artifacts?clientId=123-abc').then(r => r.json())

// 2. Construire le contexte pour le RAG
const context = {
  client: client.data.name,
  industry: client.data.industry,
  recentArtifacts: artifacts.data.slice(0, 10).map(a => ({
    type: a.type,
    title: a.title,
    content: a.textContent
  }))
}

// 3. Utiliser ce contexte dans la requête RAG
const ragQuery = `Client: ${context.client} (${context.industry})
Documents récents: ${context.recentArtifacts.map(a => a.title).join(', ')}

Question: ${userQuestion}`
```

### Exemple : Filtrage par dossier

```javascript
// Récupérer uniquement les artifacts d'un dossier spécifique
const dossierArtifacts = await fetch('/crm/artifacts?dossierId=456-def').then(r => r.json())

// Utiliser ces artifacts pour enrichir le contexte RAG
const dossierContext = dossierArtifacts.data
  .filter(a => a.textContent)
  .map(a => a.textContent)
  .join('\n\n')
```

---

## Tests

### Exécuter tous les tests CRM

```bash
npm test -- tests/crm/
```

### Exécuter un fichier de test spécifique

```bash
npm test -- tests/crm/clientService.test.mjs
npm test -- tests/crm/handlers.test.mjs
```

### Tests disponibles

- `clientService.test.mjs` : Tests du service Client
- `dossierService.test.mjs` : Tests du service Dossier
- `personService.test.mjs` : Tests du service Person
- `artifactService.test.mjs` : Tests du service Artifact
- `routes.test.mjs` : Tests des routes API
- `handlers.test.mjs` : Tests des handlers (pagination, PATCH, upload)

---

## Migration vers une vraie base de données

Le système est conçu pour faciliter une migration future vers une base de données (PostgreSQL, MongoDB, etc.) :

1. **Repositories** : La couche repository peut être remplacée sans changer les services
2. **Format JSONL** : Facile à exporter vers une DB
3. **Services** : La logique métier reste identique

### Script d'export (exemple)

```javascript
// scripts/crm-export-to-db.mjs
import { readJsonl } from '../crm/storage.mjs'
import { getStorePath } from '../crm/storage.mjs'

const clients = await readJsonl(getStorePath('clients'))
// Insérer dans votre DB...
```

---

## Limitations et considérations

### Performance

- **Recommandé** : < 10 000 enregistrements par entité
- **Acceptable** : 10 000 - 100 000 enregistrements
- **Non recommandé** : > 100 000 enregistrements (considérer une vraie DB)

### Concurrence

- Les fichiers JSONL ne supportent pas les écritures concurrentes
- Pour la production avec haute concurrence, migrer vers une DB

### Sauvegarde

- Les fichiers JSONL peuvent être sauvegardés simplement (copie de fichiers)
- Recommandation : sauvegarde quotidienne de `data/crm/`

### Sécurité

- **Upload de fichiers** : Valider les types MIME et limiter la taille
- **Validation** : Tous les inputs sont validés côté serveur
- **Authentification** : À ajouter selon vos besoins (non inclus dans cette implémentation)

---

## Troubleshooting

### Erreur "Client not found"

Vérifier que le `clientId` existe avant de créer un dossier/person/artifact.

### Erreur "Validation failed"

Vérifier le format des données envoyées. Les messages d'erreur indiquent les champs problématiques.

### Fichiers uploadés non trouvés

Vérifier que le répertoire `ARTIFACTS_UPLOAD_DIR` existe et est accessible en écriture.

### Tests qui échouent

Les tests utilisent des répertoires uniques par test. Si des tests échouent :
1. Vérifier que `data/test-crm*` peut être créé/supprimé
2. Relancer les tests : `rm -rf data/test-crm* && npm test -- tests/crm/`

---

## Évolutions futures possibles

- [ ] Authentification et autorisation
- [ ] Recherche full-text dans les artifacts
- [ ] Relations supplémentaires (tags, catégories)
- [ ] Historique des modifications
- [ ] Export/Import en CSV/JSON
- [ ] Webhooks pour les événements
- [ ] Intégration avec le système de transcription existant
- [ ] Indexation automatique des artifacts dans le RAG

---

## Support

Pour toute question ou problème, consulter :
- Les tests unitaires pour des exemples d'utilisation
- Le code source dans `crm/` et `api/routes/crm*.mjs`
- Les logs serveur pour les erreurs détaillées

