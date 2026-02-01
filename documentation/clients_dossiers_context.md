# Documentation : Gestion des Clients, Dossiers et Context Switcher

## 📋 Vue d'ensemble

Ce système permet de gérer des clients et leurs dossiers associés, avec un contexte global persistant qui peut être utilisé dans toutes les pages de l'application (meetings, uploads, RAG, etc.).

---

## 🎯 Objectifs et Use Cases

### Objectifs principaux

1. **Gestion centralisée des clients** : Créer, lister, modifier et consulter les clients
2. **Gestion des dossiers par client** : Associer des dossiers à chaque client
3. **Contexte global persistant** : Sélectionner un client/dossier une fois et l'utiliser partout
4. **Intégration transparente** : Le contexte est automatiquement inclus dans tous les appels API

### Use Cases

- **Scénario 1 : Traitement d'un meeting pour un client**
  - L'utilisateur sélectionne un client dans le header
  - Il enregistre/upload un meeting
  - Le meeting est automatiquement associé au client sélectionné
  - Si un dossier est sélectionné, le meeting est aussi associé au dossier

- **Scénario 2 : Recherche RAG contextuelle**
  - L'utilisateur sélectionne un client et un dossier
  - Il pose une question dans le chat RAG
  - La recherche est automatiquement filtrée par le contexte client/dossier

- **Scénario 3 : Navigation entre clients**
  - L'utilisateur travaille sur le client A
  - Il change de client dans le header
  - Tous les appels suivants utilisent automatiquement le nouveau client
  - Le contexte est persisté dans localStorage

---

## 🏗️ Architecture

### Structure des fichiers

```
app/
├── composables/
│   ├── useClients.ts          # Gestion des clients (CRUD)
│   ├── useDossiers.ts         # Gestion des dossiers (CRUD)
│   └── useContext.ts          # Contexte global persistant
├── components/
│   ├── ClientForm.vue         # Formulaire client réutilisable
│   ├── DossierForm.vue        # Formulaire dossier réutilisable
│   ├── ContextSwitcher.vue    # Sélecteur de contexte dans le header
│   └── TheHeader.vue          # Header avec Context Switcher intégré
└── pages/
    ├── clients.vue             # Liste des clients
    └── clients/[id].vue       # Détail client + gestion dossiers

server/api/
├── clients.get.ts             # GET /api/clients (liste avec recherche)
├── clients.post.ts             # POST /api/clients (création)
├── clients/[id].get.ts         # GET /api/clients/:id (détail)
├── clients/[id].put.ts         # PUT /api/clients/:id (mise à jour)
└── clients/[id]/
    ├── dossiers.get.ts         # GET /api/clients/:id/dossiers
    └── dossiers.post.ts        # POST /api/clients/:id/dossiers
```

---

## 🔌 Endpoints API

### Clients

#### `GET /api/clients`

Récupère la liste des clients avec possibilité de recherche.

**Query Parameters :**
- `search` (optionnel) : Terme de recherche pour filtrer par nom, prénom, email ou entreprise

**Réponse :**
```json
{
  "items": [
    {
      "id": "1",
      "nom": "Dupont",
      "prenom": "Jean",
      "email": "jean.dupont@example.com",
      "telephone": "+33 6 12 34 56 78",
      "entreprise": "Acme Corp",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-20T14:30:00Z"
    }
  ],
  "total": 1
}
```

**Note :** Actuellement, cet endpoint fait un proxy vers Ariane Core (`${baseUrl}/clients`). Voir `server/api/clients.get.ts` pour la configuration.

#### `POST /api/clients`

Crée un nouveau client.

**Body :**
```json
{
  "nom": "Dupont",
  "prenom": "Jean",
  "email": "jean.dupont@example.com",
  "telephone": "+33 6 12 34 56 78",  // optionnel
  "entreprise": "Acme Corp"          // optionnel
}
```

**Validation :**
- `nom` : requis, string non vide
- `prenom` : requis, string non vide
- `email` : requis, format email valide

**Réponse :** Objet client créé avec `id`, `createdAt`, `updatedAt`

#### `GET /api/clients/:id`

Récupère les détails d'un client spécifique.

**Réponse :** Objet client complet

**Erreurs :**
- `404` : Client non trouvé

#### `PUT /api/clients/:id`

Met à jour un client existant.

**Body :** Même structure que POST (tous les champs optionnels sauf nom, prénom, email)

**Réponse :** Objet client mis à jour

### Dossiers

#### `GET /api/clients/:id/dossiers`

Récupère tous les dossiers d'un client.

**Réponse :**
```json
{
  "items": [
    {
      "id": "d1",
      "clientId": "1",
      "titre": "Dossier commercial",
      "description": "Négociation contrat annuel",
      "statut": "en_cours",
      "createdAt": "2024-01-20T10:00:00Z",
      "updatedAt": "2024-01-25T14:30:00Z"
    }
  ],
  "total": 1
}
```

#### `POST /api/clients/:id/dossiers`

Crée un nouveau dossier pour un client.

**Body :**
```json
{
  "titre": "Dossier commercial",
  "description": "Négociation contrat annuel",  // optionnel
  "statut": "en_attente"                         // optionnel, valeurs: en_attente, en_cours, resolu, ferme
}
```

**Validation :**
- `titre` : requis, string non vide

**Réponse :** Objet dossier créé avec `id`, `clientId`, `createdAt`, `updatedAt`

---

## 🧩 Composables

### `useClients()`

Composable pour gérer les opérations CRUD sur les clients.

**Fonctions exposées :**

```typescript
const {
  fetchClients,    // (search?: string) => Promise<{ data, error }>
  fetchClient,     // (id: string) => Promise<{ data, error }>
  createClient,    // (clientData: Partial<Client>) => Promise<{ data, error }>
  updateClient,    // (id: string, clientData: Partial<Client>) => Promise<{ data, error }>
} = useClients()
```

**Caractéristiques :**
- Gestion automatique des erreurs avec toasts
- Messages de succès automatiques
- Types TypeScript complets

**Exemple d'utilisation :**

```vue
<script setup>
const { fetchClients, createClient } = useClients()

// Lister les clients
const { data, error } = await fetchClients('Dupont')

// Créer un client
const { data: newClient } = await createClient({
  nom: 'Martin',
  prenom: 'Marie',
  email: 'marie@example.com'
})
</script>
```

### `useDossiers()`

Composable pour gérer les opérations CRUD sur les dossiers.

**Fonctions exposées :**

```typescript
const {
  fetchDossiers,   // (clientId: string) => Promise<{ data, error }>
  createDossier,   // (clientId: string, dossierData: Partial<Dossier>) => Promise<{ data, error }>
} = useDossiers()
```

**Exemple d'utilisation :**

```vue
<script setup>
const { fetchDossiers, createDossier } = useDossiers()
const clientId = '1'

// Lister les dossiers d'un client
const { data } = await fetchDossiers(clientId)

// Créer un dossier
const { data: newDossier } = await createDossier(clientId, {
  titre: 'Nouveau dossier',
  description: 'Description du dossier',
  statut: 'en_attente'
})
</script>
```

### `useContext()`

Composable global pour gérer le contexte client/dossier persistant.

**API exposée :**

```typescript
const {
  context,      // Computed<AppContext> - Contexte complet (clientId, dossierId, client, dossier)
  clientId,     // Readonly<Ref<string | null>> - ID du client sélectionné
  dossierId,   // Readonly<Ref<string | null>> - ID du dossier sélectionné
  client,       // Readonly<Ref<Client | null>> - Objet client chargé
  dossier,      // Readonly<Ref<Dossier | null>> - Objet dossier chargé
  loading,      // Readonly<Ref<boolean>> - État de chargement
  setClient,    // (id: string | null) => void - Définir le client
  setDossier,   // (id: string | null) => void - Définir le dossier
  clear,        // () => void - Réinitialiser le contexte
} = useContext()
```

**Interface AppContext :**

```typescript
interface AppContext {
  clientId: string | null
  dossierId: string | null
  client: Client | null      // Objet client complet (chargé automatiquement)
  dossier: Dossier | null    // Objet dossier complet (chargé automatiquement)
}
```

**Fonctionnalités :**

1. **Persistance automatique** : Les valeurs sont sauvegardées dans `localStorage` avec les clés :
   - `ariane_context_clientId`
   - `ariane_context_dossierId`

2. **Chargement automatique** : Quand `clientId` ou `dossierId` change, les objets complets sont automatiquement chargés

3. **Réinitialisation intelligente** : Si le client change, le dossier est automatiquement réinitialisé

4. **Réactivité globale** : Tous les composants utilisant `useContext()` reçoivent automatiquement les mises à jour

**Exemple d'utilisation :**

```vue
<script setup>
import { useContext } from '~/composables/useContext'

const { context, setClient, setDossier } = useContext()

// Accéder au contexte
console.log(context.value.clientId)  // "1"
console.log(context.value.client)    // { id: "1", nom: "Dupont", ... }

// Modifier le contexte
setClient('2')
setDossier('d3')

// Le contexte est automatiquement persisté et chargé
</script>
```

---

## 🎨 Composants

### `ClientForm.vue`

Formulaire réutilisable pour créer ou modifier un client.

**Props :**
- `client` (optionnel) : `Client | null` - Client à modifier (si null, mode création)
- `loading` (optionnel) : `boolean` - État de chargement

**Events :**
- `@submit` : Émis avec les données du formulaire validées
- `@cancel` : Émis quand l'utilisateur annule

**Validation :**
- Utilise Zod pour la validation
- Champs requis : nom, prénom, email
- Email validé au format standard

**Exemple d'utilisation :**

```vue
<template>
  <ClientForm
    :client="selectedClient"
    :loading="saving"
    @submit="handleSubmit"
    @cancel="handleCancel"
  />
</template>

<script setup>
function handleSubmit(clientData) {
  // clientData est validé et prêt à être envoyé
  console.log(clientData)
}
</script>
```

### `DossierForm.vue`

Formulaire réutilisable pour créer ou modifier un dossier.

**Props :**
- `dossier` (optionnel) : `Dossier | null` - Dossier à modifier
- `loading` (optionnel) : `boolean` - État de chargement

**Events :**
- `@submit` : Émis avec les données du formulaire validées
- `@cancel` : Émis quand l'utilisateur annule

**Champs :**
- `titre` : Requis
- `description` : Optionnel, textarea
- `statut` : Select avec options (en_attente, en_cours, resolu, ferme)

### `ContextSwitcher.vue`

Composant affiché dans le header pour sélectionner le contexte client/dossier.

**Fonctionnalités :**
- Select client (obligatoire) avec chargement automatique de la liste
- Select dossier (optionnel, apparaît seulement si un client est sélectionné)
- Badge affichant le contexte actif
- États de chargement gérés
- Réinitialisation automatique du dossier si le client change

**Intégration :**
Le composant est automatiquement intégré dans `TheHeader.vue` et visible sur toutes les pages.

---

## 📄 Pages

### `/clients` - Liste des clients

**Fonctionnalités :**
- Liste des clients dans un tableau avec colonnes : Nom/Prénom, Email, Téléphone, Actions
- Recherche en temps réel avec debounce (300ms)
- Bouton "Nouveau client" ouvrant un modal
- Empty state si aucun client trouvé
- Gestion des erreurs avec alertes
- États de chargement

**Navigation :**
- Clic sur une ligne ou bouton "Voir" → `/clients/:id`

### `/clients/:id` - Détail client

**Fonctionnalités :**
- Affichage des informations du client (nom, email, téléphone, entreprise, dates)
- Onglets :
  - **Détails** : Informations complètes du client
  - **Dossiers** : Liste des dossiers avec possibilité de création
- Bouton "Modifier" ouvrant un modal avec `ClientForm`
- Bouton "Nouveau dossier" dans l'onglet Dossiers
- Empty state pour les dossiers avec action de création

**Tableau des dossiers :**
- Colonnes : Titre (avec description), Statut (badge coloré), Date de création
- Badges de statut avec couleurs :
  - `en_attente` : warning (jaune)
  - `en_cours` : info (bleu)
  - `resolu` : success (vert)
  - `ferme` : neutral (gris)

---

## 🔄 Intégration du contexte dans les pages

### Page Meeting (`/meeting`)

Le contexte est automatiquement inclus dans tous les appels API :

1. **Transcription** (`/api/ariane/transcribe`) :
   ```typescript
   meta: {
     clientId: context.value.clientId || undefined,
     dossierId: context.value.dossierId || undefined,
   }
   ```

2. **Agent Scribe** (`/api/ariane/agent/scribe`) :
   ```typescript
   context: {
     clientId: context.value.clientId || undefined,
     dossierId: context.value.dossierId || undefined,
   },
   meta: {
     clientId: context.value.clientId || undefined,
     dossierId: context.value.dossierId || undefined,
   }
   ```

3. **Import meeting** (`/api/ariane/meetings/import`) :
   ```typescript
   meta: {
     clientId: context.value.clientId || undefined,
     dossierId: context.value.dossierId || undefined,
   }
   ```

### Page Docs Chat (`/docs-chat`)

Le contexte est inclus dans les appels à l'agent docs :

```typescript
body: {
  query: query.value,
  top_k: 5,
  context: {
    clientId: context.value.clientId || undefined,
    dossierId: context.value.dossierId || undefined,
  },
  meta: {
    clientId: context.value.clientId || undefined,
    dossierId: context.value.dossierId || undefined,
  },
}
```

---

## 💾 Persistance et Stockage

### localStorage

Le contexte est persisté dans le `localStorage` du navigateur avec les clés suivantes :

- `ariane_context_clientId` : ID du client sélectionné
- `ariane_context_dossierId` : ID du dossier sélectionné

**Avantages :**
- Le contexte est restauré au rechargement de la page
- Persiste entre les sessions
- Synchronisé automatiquement entre tous les onglets

**Utilisation de `useLocalStorage` :**
Le composable `useContext` utilise `useLocalStorage` de VueUse pour une gestion réactive et persistante.

---

## 🎨 UI/UX

### Design sobre et productif

- **Interface minimaliste** : Focus sur la productivité
- **Recherche rapide** : Debounce pour éviter trop de requêtes
- **Empty states** : Messages clairs avec actions pour guider l'utilisateur
- **Feedback visuel** : Toasts pour les succès/erreurs, états de chargement
- **Badges de statut** : Couleurs intuitives pour les statuts de dossiers

### Composants Nuxt UI utilisés

- `UTable` : Tableaux avec tri, recherche, pagination
- `UForm` / `UFormField` : Formulaires avec validation Zod
- `UModal` : Modales pour création/édition
- `USelect` : Sélecteurs dans le Context Switcher
- `UBadge` : Badges de statut et contexte actif
- `UEmpty` : Empty states
- `UAlert` : Alertes d'erreur
- `UButton` : Boutons d'action
- `UInput` / `UTextarea` : Champs de formulaire
- `UTabs` : Onglets dans la page détail client
- `UCard` : Cartes pour afficher les informations

---

## 🔧 Configuration

### Configuration API

Les endpoints clients font un proxy vers Ariane Core. La configuration se fait dans `nuxt.config.ts` :

```typescript
runtimeConfig: {
  arianeCoreUrl: process.env.ARIANE_CORE_URL || 'http://192.168.2.110:4000',
}
```

Les endpoints utilisent cette configuration pour appeler Ariane Core :

```typescript
const config = useRuntimeConfig()
const baseUrl = config.public?.arianeCoreUrl || config.arianeCoreUrl || 'http://127.0.0.1:4000'
```

### Variables d'environnement

Pour configurer l'URL d'Ariane Core, définir dans `.env` :

```bash
ARIANE_CORE_URL=http://192.168.2.110:4000
```

---

## 🚀 Utilisation

### Pour un développeur

1. **Utiliser le contexte dans une nouvelle page** :
   ```vue
   <script setup>
   import { useContext } from '~/composables/useContext'

   const { context } = useContext()

   // Le contexte est automatiquement disponible
   console.log(context.value.clientId)
   </script>
   ```

2. **Inclure le contexte dans un appel API** :
   ```typescript
   await $fetch('/api/endpoint', {
     method: 'POST',
     body: {
       // ... autres données
       meta: {
         clientId: context.value.clientId || undefined,
         dossierId: context.value.dossierId || undefined,
       }
     }
   })
   ```

3. **Créer un nouveau client** :
   ```vue
   <script setup>
   const { createClient } = useClients()

   async function handleCreate(data) {
     const { data: client, error } = await createClient(data)
     if (!error) {
       // Succès, toast automatique affiché
     }
   }
   </script>
   ```

### Pour un utilisateur

1. **Sélectionner un contexte** :
   - Ouvrir l'application
   - Dans le header, sélectionner un client dans le dropdown "Client"
   - Optionnellement, sélectionner un dossier dans le dropdown "Dossier"
   - Le contexte est automatiquement sauvegardé

2. **Travailler avec le contexte** :
   - Tous les meetings, uploads, et recherches RAG utilisent automatiquement le contexte sélectionné
   - Le badge dans le header affiche le contexte actif
   - Le contexte persiste entre les pages et les sessions

3. **Gérer les clients** :
   - Aller sur `/clients` pour voir la liste
   - Cliquer sur "Nouveau client" pour créer
   - Cliquer sur un client pour voir ses détails et dossiers
   - Créer des dossiers depuis la page détail client

---

## 📝 Notes techniques

### Gestion des erreurs

- Tous les composables gèrent les erreurs avec des toasts automatiques
- Les erreurs réseau sont capturées et affichées de manière user-friendly
- Les validations de formulaire affichent les erreurs directement dans les champs

### Performance

- Debounce sur la recherche (300ms)
- Chargement lazy des données client/dossier dans le contexte
- Utilisation de `useAsyncData` pour le cache côté Nuxt

### TypeScript

- Tous les types sont définis et exportés
- Interfaces complètes pour Client, Dossier, AppContext
- Autocomplétion complète dans l'IDE

### Réactivité

- Utilisation de `ref`, `computed`, `watch` pour la réactivité
- Le contexte est réactif et se met à jour automatiquement
- Tous les composants utilisant `useContext()` reçoivent les mises à jour

---

## 🔮 Évolutions futures possibles

1. **Permissions** : Ajouter des permissions par client/dossier
2. **Historique** : Tracker l'historique des changements de contexte
3. **Notifications** : Notifier quand le contexte change
4. **Multi-contexte** : Permettre de travailler sur plusieurs contextes en parallèle
5. **Filtres avancés** : Ajouter plus de filtres dans la liste des clients
6. **Export** : Exporter les données clients/dossiers
7. **Recherche globale** : Recherche unifiée clients + dossiers
8. **Statistiques** : Dashboard avec statistiques par client/dossier

---

## 🐛 Dépannage

### Le contexte ne persiste pas

- Vérifier que le localStorage est activé dans le navigateur
- Vérifier la console pour des erreurs JavaScript
- Les clés utilisées sont : `ariane_context_clientId` et `ariane_context_dossierId`

### Les données ne se chargent pas

- Vérifier que l'API Ariane Core est accessible
- Vérifier la configuration `ARIANE_CORE_URL`
- Vérifier les logs du serveur Nuxt

### Le Context Switcher ne s'affiche pas

- Vérifier que `ContextSwitcher.vue` est bien dans `app/components/`
- Vérifier que `TheHeader.vue` inclut bien `<ContextSwitcher />`
- Vérifier la console pour des erreurs de rendu

---

## 📚 Références

- [Nuxt UI Documentation](https://ui.nuxt.com)
- [VueUse useLocalStorage](https://vueuse.org/core/uselocalstorage/)
- [Zod Validation](https://zod.dev)
- [Nuxt Composables](https://nuxt.com/docs/guide/directory-structure/composables)

---

**Dernière mise à jour :** 2024-01-XX
**Version :** 1.0.0

