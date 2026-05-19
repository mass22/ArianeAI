# ArianeAI — Documentation générale du projet

> Document exhaustif : vision, architecture, features, technique, tooling et spécificités.  
> Dernière mise à jour : février 2025 (module Clients CRM enrichi)

---

## Table des matières

1. [Vision et contexte](#1-vision-et-contexte)
2. [Stack technique](#2-stack-technique)
3. [Architecture](#3-architecture)
4. [Structure du projet](#4-structure-du-projet)
5. [Fonctionnalités (features)](#5-fonctionnalités-features)
6. [API serveur](#6-api-serveur)
7. [Composables et logique métier](#7-composables-et-logique-métier)
8. [Types et modèles de données](#8-types-et-modèles-de-données)
9. [Utilitaires (lib)](#9-utilitaires-lib)
10. [Configuration et variables d'environnement](#10-configuration-et-variables-denvironnement)
11. [Tests](#11-tests)
12. [Tooling et développement](#12-tooling-et-développement)
13. [Documentation existante](#13-documentation-existante)
14. [Spécificités et conventions](#14-spécificités-et-conventions)
15. [Évolutions futures](#15-évolutions-futures)

---

## 1. Vision et contexte

### Origine

**ArianeAI** est une IA souveraine fonctionnant entièrement en local, initialement conçue pour tourner sur une machine Linux (ex. Dell Optiplex 3020) avec Ollama. Le projet a évolué vers une **application Nuxt frontend** qui se connecte à un backend **Ariane Core** et fournit une interface unifiée pour :

- La **prospection commerciale** (leads, pipeline, enrichissement LLM)
- La **gestion clients et dossiers** (CRM lite)
- Les **réunions** (transcription Whisper, agent Scribe, import)
- Le **chat LLM** et les **agents IA**

### Principes

- **Souveraineté** : Modèles locaux via Ollama / Ariane Core, pas de dépendance cloud obligatoire
- **Productivité** : Interface sobre, orientée action (leads à contacter, KPIs, brief quotidien)
- **Contextualisation** : Contexte client/dossier persistant pour RAG, meetings, uploads

### Relation avec Ariane Core

ArianeAI est le **frontend** ; **Ariane Core** est le backend. ArianeAI fait un **proxy** vers Ariane Core pour toutes les données (leads, daily, clients, agents, LLM, etc.). Les endpoints Nuxt (`/api/*`) redirigent vers `ARIANE_API_BASE_URL` ou `ARIANE_CORE_URL`.

---

## 2. Stack technique

### Framework et modules

| Technologie | Version | Rôle |
|-------------|---------|------|
| **Nuxt** | 4.x | Framework Vue full-stack |
| **Vue** | (via Nuxt) | Framework UI réactif |
| **@nuxt/ui** | 4.2.x | Composants UI |
| **shadcn-nuxt** | 2.4.x | Composants primitifs (collapsible, scroll-area, tooltip, etc.) + AI elements |
| **@vueuse/core / nuxt** | 14.x | Composables (useLocalStorage, useIntervalFn, etc.) |
| **AI SDK** | @ai-sdk/vue, ai 5.x | Chat IA, streaming |
| **Zod** | 4.x | Validation et schémas |

### Autres dépendances

- **lucide-vue-next** : Icônes
- **motion-v** : Animations
- **reka-ui** : Composants headless UI
- **streamdown-vue** : Markdown en streaming
- **vue-stick-to-bottom** : Scroll chat
- **class-variance-authority**, **clsx** : Gestion des classes CSS
- **shiki** : Highlighting de code
- **nuxt-mcp-dev** : Serveur MCP (Model Context Protocol) en développement

### DevDependencies

- **Vitest** : Tests unitaires
- **@nuxt/test-utils**, **@vue/test-utils** : Tests Vue/Nuxt
- **@nuxt/devtools** : Outils de développement
- **@types/node** : Types Node.js

---

## 3. Architecture

### Flux de données

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (Nuxt / Vue)                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │   Pages     │  │  Composables │  │   lib/       │  │  localStorage   │   │
│  │  (leads,    │  │ (useAriane   │  │ (dateUtils,  │  │ (context,       │   │
│  │   clients,  │  │  Api, useInsights) │  │  ingestion,  │  │  daily todos)   │   │
│  │   daily…)   │  │              │  │  apiLogger)  │  │                 │   │
│  └──────┬──────┘  └──────┬───────┘  └─────────────┘  └─────────────────┘   │
│         │                │                                                    │
│         └────────────────┼──────────────────── $fetch / useFetch             │
└──────────────────────────┼──────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Nuxt Server (Nitro) — server/api/                        │
│  GET /api/health, /api/leads, /api/daily, /api/clients, /api/memory/insights,  │
│  POST /api/llm/chat, /api/leads/:key/enrich, /api/ingest/*, …                │
└──────────────────────────┬──────────────────────────────────────────────────┘
                           │ Proxy vers Ariane Core
                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Ariane Core (Backend)                                │
│  http://127.0.0.1:4000 (ou ARIANE_API_BASE_URL)                              │
│  Leads, daily brief, clients, dossiers, agents, LLM, memory/insights, …       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Règles de route (SSR désactivé)

Les pages suivantes sont en **SPA** (`ssr: false`) :

- `/`
- `/meeting`
- `/observability/core`
- `/clients/**`
- `/leads/**`
- `/daily`

Cela évite les problèmes de chargement côté serveur pour les données dynamiques (API, localStorage).

---

## 4. Structure du projet

```
ArianeAI/
├── app/                          # Application Nuxt (layer app)
│   ├── app.vue                   # Root : UApp, TheHeader, NuxtPage
│   ├── assets/css/main.css       # Styles globaux
│   ├── components/               # Composants Vue
│   │   ├── ui/                   # shadcn primitives
│   │   ├── ai-elements/          # Composants chat IA (shimmer, prompt-input, etc.)
│   │   ├── leads/                # Lead-related
│   │   │   └── import/           # Modal import, dropzone, etc.
│   │   ├── meeting/               # Meeting workflow
│   │   │   └── MeetingWorkflowResult.vue  # Affichage résultat (résumé, todos, email, steps, status)
│   │   ├── insights/              # Insights mémoire client
│   │   │   └── ClientInsightsPanel.vue  # Overview, top topics, risques, décisions, tendance
│   │   ├── TheHeader.vue
│   │   ├── ContextSwitcher.vue
│   │   ├── ApiStatusBadge.vue
│   │   ├── LLMChat.vue
│   │   ├── ClientForm.vue
│   │   └── DossierForm.vue
│   ├── config/
│   │   ├── geo-priority.ts       # Mapping 0–4 (Unknown, Canada, USA, EU, Other)
│   │   └── prospection-kpi.ts    # Cibles KPI (weeklyMessages, weeklyCalls, etc.)
│   ├── composables/              # useArianeApi, useDailyTodos, useLlmChat, etc.
│   ├── lib/                      # Utilitaires purs
│   │   ├── apiLogger.ts
│   │   ├── dateUtils.ts
│   │   ├── importLeadsUtils.ts
│   │   └── ingestionUtils.ts
│   ├── pages/                    # File-based routing
│   └── types/                    # TypeScript (leads.ts, ariane.ts, meeting.ts, insights.ts)
├── server/
│   └── api/                      # Routes API Nitro
│       ├── health.get.ts
│       ├── daily.get.ts
│       ├── leads/                # index, [lead_key], enrich, ingest, rescore, etc.
│       ├── ingest/               # urls, linkedin/csv
│       ├── llm/chat.post.ts
│       ├── clients/              # CRUD clients (get, post, put, delete, archive, reactivate)
│       ├── clients/[id]/dossiers/
│       ├── memory/               # Proxy mémoire Ariane-Core
│       │   ├── insights.get.ts   # GET /memory/insights?clientId=&period=
│       │   └── search.get.ts     # GET /memory/search?query=&clientId=
│       └── ariane/               # metrics, logs, transcribe, meetings/import, agent/[name], workflows/meeting/import
├── documentation/                # Markdown docs
├── nuxt.config.ts
├── package.json
├── vitest.config.ts
├── vitest.setup.ts
└── README.md
```

---

## 5. Fonctionnalités (features)

### Pages et routes

| Route | Fichier | Description |
|-------|---------|-------------|
| `/` | `pages/index.vue` | **Accueil** : LLM chat, todolist daily (max 5 leads à contacter), KPIs (clients, agents, uptime), liens vers features |
| `/daily` | `pages/daily.vue` | **Brief quotidien** : top leads, followups du jour, pipeline summary |
| `/leads` | `pages/leads/index.vue` | **Liste leads** : KPI cards, filtres, tableau, pagination, import |
| `/leads/[lead_key]` | `pages/leads/[lead_key].vue` | **Détail lead** : enrichissement LLM, actions pipeline, messages générés |
| `/clients` | `pages/clients/index.vue` | **Liste clients** : filtre statut (Tous/Actifs/Archivés), recherche, tri (nom, lastContactAt, nextFollowUpAt), badge archivé, indicateur suivi dépassé, création |
| `/clients/[id]` | `pages/clients/[id].vue` | **Détail client** : fiche enrichie (identité, contact, adresse, suivi CRM), dossiers, **Insights**. Actions : Archiver, Réactiver, Supprimer (modale confirmation). Alerte si nextFollowUpAt dépassé |
| `/meeting` | `pages/meeting.vue` | **Réunions** : 1 clic → workflow unique (transcription + Scribe + import via `POST /workflows/meeting/import`). Utilise uniquement `runMeetingWorkflow` + `ContextSwitcher`. États : loading, ok, degraded, error. Retry en cas d'erreur. Warning si degraded. Toasts succès/erreur. **Bouton "Insights client"** : route vers `/clients/:id?tab=insights` si client sélectionné, sinon toast |
| `/observability/core` | `pages/observability/core.vue` | **Observabilité** |
| `/docs-chat` | `pages/docs-chat.vue` | **Chat RAG** sur documents (avec contexte client/dossier) |

### Composants principaux

| Composant | Rôle |
|-----------|------|
| **TheHeader** | En-tête global avec nav, ApiStatusBadge, ContextSwitcher |
| **ContextSwitcher** | Sélecteur client/dossier (persistance localStorage) ; clients actifs uniquement (exclut archivés) |
| **ApiStatusBadge** | Statut santé API (polling /api/health), latence |
| **LLMChat** | Chat LLM via `/api/llm/chat` (ou agent) |
| **DailyBrief** / **DailyBriefTodoList** | Pipeline résumé, leads à contacter (max 5/jour) |
| **LeadTable** | Tableau leads (status, pipeline, geo, actions) |
| **LeadFilters** | Filtres (type, status, pipeline_stage, minScore, sort, next_followup_at) |
| **LeadActions** | Boutons d’action (messaged, replied, scheduled, etc.) |
| **LeadsImportModal** | Import CSV LinkedIn, URLs, CSV générique |
| **MeetingWorkflowResult** | Résultat workflow meeting : (A) résumé markdown + copier + "Ouvrir le markdown" si path fourni ; (B) todos max 5 avec checkbox + copier todos (warning si backend envoie plus) ; (C) email follow-up subject+body + copier ; (D) steps debug (collapsible) ; (E) badge status ok/degraded/error |
| **ClientInsightsPanel** | Panel insights client : overview cards (réunions, décisions, actions, dernière réunion), top topics, risques récurrents, décisions récurrentes, tendance d'activité. Utilise `useInsights`. |
| **ClientForm**, **DossierForm** | Formulaires CRUD client / dossier. ClientForm : sections Identité (name*, companyName, industry), Contact (email, phone, website), Adresse, Suivi CRM (source, tags, notes, lastContactAt, nextFollowUpAt) |

### Leads

- **Pipeline stages** : `inbox`, `new`, `contacted`, `messaged`, `replied`, `scheduled`, `proposal`, `won`, `lost`
- **Geo priority** : 0=Unknown, 1=Canada, 2=USA, 3=EU, 4=Other
- **Pagination** : Chunks de 100 (offset), fusion frontend si backend supporte offset
- **Import** : LinkedIn CSV, URLs LinkedIn, CSV générique
- **Enrichissement** : Génération LLM de `generated_outreach`, `followup_j4`, `followup_j10`

### Module Clients CRM

- **Filtre statut** : Tous | Actifs | Archivés — `GET /api/clients?status=active|archived`
- **Actions** : Archiver (`POST /crm/clients/:id/archive`), Réactiver (`POST /crm/clients/:id/reactivate`), Supprimer (`DELETE /crm/clients/:id?confirm=true` avec modale obligatoire, gestion erreur 409)
- **Fiche enrichie** : name, companyName, industry, email, phone, website, address, city, postalCode, country, source, tags, notes, lastContactAt, nextFollowUpAt
- **Source** : referral, linkedin, cold_outreach, existing_client, job_board, community, other
- **UX** : badge « Archivé », pastille orange/rouge si nextFollowUpAt dépassé, tri sur colonnes, messages succès/erreur après actions

### Daily todos

- **Max 5 leads/jour** à contacter
- Report des non contactés de J-1 vers J
- Stockage `localStorage` clé `ariane-daily-todos`

### KPI Prospection

- `weeklyMessages: 25`
- `weeklyCalls: 2`
- `monthlyProposals: 4`
- `minActivePipeline: 5`

Config modifiable dans `app/config/prospection-kpi.ts`.

---

## 6. API serveur

### Endpoints (proxy vers Ariane Core)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/health` | Health check + latence |
| GET | `/api/daily?date=` | Brief quotidien |
| GET | `/api/leads` | Liste leads (limit, offset, filtres) |
| GET | `/api/leads/geo-options` | Options priorité géo |
| GET | `/api/leads/diagnostic` | Info diagnostic (path, count) |
| GET | `/api/leads/:lead_key` | Détail lead |
| PATCH | `/api/leads/:lead_key` | Mise à jour lead |
| POST | `/api/leads/:lead_key/enrich` | Enrichissement LLM (2 min timeout) |
| POST | `/api/leads/rescore` | Recalcul scoring |
| POST | `/api/leads/ingest/csv` | Import CSV générique |
| POST | `/api/leads/ingest/linkedin-csv` | Import CSV LinkedIn |
| POST | `/api/leads/ingest/linkedin-urls` | Import URLs LinkedIn |
| POST | `/api/ingest/urls` | Ingestion URLs |
| POST | `/api/ingest/linkedin/csv` | Ingestion CSV LinkedIn |
| POST | `/api/llm/chat` | Chat LLM → Ariane Core `/llm/chat` |
| GET | `/api/clients` | Liste clients (query: `status`, `search`, `sort`, `order`) |
| GET | `/api/clients/:id` | Détail client (fiche enrichie) |
| PUT | `/api/clients/:id` | Mise à jour client |
| POST | `/api/clients` | Création client |
| POST | `/api/clients/:id/archive` | Archivage client |
| POST | `/api/clients/:id/reactivate` | Réactivation client archivé |
| DELETE | `/api/clients/:id` | Suppression client (query: `confirm=true`, erreur 409 si dépendances) |
| GET | `/api/clients/:id/dossiers` | Dossiers client |
| POST | `/api/clients/:id/dossiers` | Création dossier |
| GET | `/api/memory/insights?clientId=&period=` | Insights mémoire → Ariane-Core `/memory/insights` |
| GET | `/api/memory/search?query=&clientId=` | Recherche mémoire → Ariane-Core `/memory/search` |
| GET | `/api/ariane/metrics` | Métriques (uptime, agents) |
| GET | `/api/ariane/logs` | Logs |
| POST | `/api/ariane/transcribe` | Transcription Whisper (standalone) |
| POST | `/api/ariane/meetings/import` | Import réunion (content, transcript, scribeResult) |
| POST | `/api/ariane/workflows/meeting/import` | **Workflow meeting** : audio → transcription + Scribe + import (1 appel, retourne workflow_id, status, steps, result) |
| POST | `/api/ariane/agent/:name` | Appel agent (ex. Scribe) standalone |

---

## 7. Composables et logique métier

| Composable | Rôle |
|------------|------|
| **useArianeApi** | Leads (fetch, patch, enrich, rescore, ingest), daily, health, **runMeetingWorkflow** ; expose `apiLatencyMs`, `apiUp` |
| **useApiStatus** | `apiLatencyMs`, `apiUp` (partagé avec useArianeApi) |
| **useDailyTodos** | Todolist daily (max 5), `getLeadsToContact`, `markContacted`, `refreshTrigger` |
| **useLlmChat** | Chat LLM via `/api/llm/chat` |
| **useContext** | Contexte client/dossier persistant (localStorage) |
| **useClients** | CRUD clients (fetchClients avec status/sort/order), archiveClient, reactivateClient, deleteClient |
| **useDossiers** | CRUD dossiers |
| **useInsights** | `fetchInsights(clientId?, period?)`, `searchMemory(query, clientId?)` ; loading, error, status, insights, searchResults ; reset |

### useArianeApi — Méthodes principales

- `fetchLeads`, `fetchGeoOptions`, `rescoreLeads`, `fetchLeadsDiagnostic`
- `fetchLead`, `patchLead`, `enrichLead`
- `markAsMessaged`, `markReplied`, `scheduleCall`, `markProposal`, `markWon`, `markLost`
- `fetchDaily`
- `ingestLinkedinCsv`, `ingestLinkedinUrls`, `ingestGenericCsv`
- `runMeetingWorkflow` — Workflow meeting (audio_base64 → transcription + Scribe + import). Pas de toasts dans le composable ; la page `/meeting` gère succès/erreur/dégradé selon le statut retourné
- `health`

---

## 8. Types et modèles de données

### `app/types/leads.ts`

- `Lead`, `LeadDetail`, `LeadsResponse`, `DailyBrief`, `LeadPatchPayload`
- `PipelineStage`, `GeoPriority` (0–4)

### `app/types/ariane.ts`

- `IngestionResult`, `IngestionErrorSample`

### `app/types/meeting.ts`

- `MeetingWorkflowResult`, `WorkflowStep`, `ScribeResult`, `MeetingResult`, `MeetingWorkflowImportPayload`
- `TodoItem` : alias string pour les todos
- `FollowupEmail` : `{ subject?: string; body?: string }`
- `MeetingResult.markdown_path` : chemin optionnel vers le fichier markdown
- `result.followup_email` : `string | FollowupEmail` (string brut ou objet structuré)
- Statut workflow : `ok` | `degraded` | `error`

### `app/types/insights.ts`

- `InsightsResponse`, `AggregatedInsights`, `TopicItem`, `RiskItem`, `DecisionItem`, `ActivityTrend`
- `SearchResult`, `SearchResponse` (recherche mémoire)

### Autres types

- **Client** (dans `useClients`) : id, name, companyName, industry, email, phone, website, address, city, postalCode, country, source, tags, notes, lastContactAt, nextFollowUpAt, status (active|archived), createdAt, updatedAt
- **ClientSource** : referral, linkedin, cold_outreach, existing_client, job_board, community, other
- **Dossier** : dans `useDossiers`
- **AppContext** : dans `useContext`
- **LlmChatMessage**, **LlmChatParams**, **LlmChatResponse** : dans `useLlmChat`

---

## 9. Utilitaires (lib)

| Fichier | Rôle |
|---------|------|
| **apiLogger** | `logApiRequest`, `logApiResponse`, `logApiError` (dev) |
| **dateUtils** | `todayMontreal`, `addDays`, `normalizeToYMD`, `formatDateDisplay`, `isInCurrentWeek`, `isInCurrentMonth`, `currentMonthProgress` |
| **importLeadsUtils** | `parseCsvPreview`, `checkLinkedInColumns` |
| **ingestionUtils** | `parseUrlsFromText`, `normalizeLinkedinUrls`, `normalizeIngestionError` |

---

## 10. Configuration et variables d'environnement

### Runtime config (`nuxt.config.ts`)

- `arianeCoreUrl` : URL Ariane Core (serveur)
- `arianeApiBaseUrl` : API Ariane (leads, daily, etc.) — peut différer
- `public.arianeCoreUrl` : URL exposée côté client

### Variables d'environnement

| Variable | Rôle |
|----------|------|
| `NUXT_PUBLIC_ARIANE_CORE_URL` | URL publique Ariane Core |
| `ARIANE_CORE_URL` | URL Ariane Core (serveur) |
| `ARIANE_API_BASE_URL` | URL API Ariane (leads, daily) |

Défaut : `http://127.0.0.1:4000`

### localStorage

- `ariane_context_clientId` : Client sélectionné
- `ariane_context_dossierId` : Dossier sélectionné
- `ariane-daily-todos` : Todolist daily (clés = dates YYYY-MM-DD)

---

## 11. Tests

### Config Vitest

- Fichiers : `**/*.spec.ts`, `**/*.spec.vue`
- Env : `node`
- Setup : `vitest.setup.ts` (mocks `useState`, `useToast`)
- Aliases : `~`, `@` → `app`, `#app` depuis Nuxt

### Scripts

```bash
npm run test        # Vitest run
npm run test:watch  # Vitest watch
```

### Couverture actuelle

| Fichier | Sujet |
|---------|-------|
| `useArianeApi.spec.ts` | ingest (LinkedIn CSV, URLs, CSV générique), gestion erreurs |
| `apiLogger.spec.ts` | Comportement sans exception |
| `dateUtils.spec.ts` | addDays, formatDateDisplay, todayMontreal |
| `importLeadsUtils.spec.ts` | parseCsvPreview, checkLinkedInColumns |
| `ingestionUtils.spec.ts` | parseUrlsFromText, normalizeLinkedinUrls, normalizeIngestionError |

---

## 12. Tooling et développement

### Scripts npm

- `dev` : `nuxt dev` — [http://localhost:3000](http://localhost:3000)
- `build` : `nuxt build`
- `generate` : `nuxt generate`
- `preview` : `nuxt preview`
- `test` : `vitest run`
- `test:watch` : `vitest`
- `postinstall` : `nuxt prepare`

### MCP (Model Context Protocol)

- Endpoint dev : [http://localhost:3000/__mcp/sse](http://localhost:3000/__mcp/sse)
- Module : `nuxt-mcp-dev`

### Mode sombre

Par défaut : `useColorMode().preference = 'dark'` dans `app.vue`.

---

## 13. Documentation existante

| Fichier | Contenu |
|---------|---------|
| `arianeai_setup.md` | Setup initial (Linux Mint, Ollama, Nuxt ↔ Ollama) |
| `ariane-leads-pagination.md` | Pagination API leads, paramètres limit/offset |
| `prompts_lead_enrichment.md` | Prompts LLM pour generated_outreach, followup_j4, followup_j10 |
| `clients_dossiers_context.md` | Clients, dossiers, contexte, ContextSwitcher, API |
| `ariane-core_crm.md` | CRM Lite Ariane Core (clients, dossiers, persons, artifacts) |
| `meetings_import_transcript.md` | Import réunions + transcript + scribeResult (endpoint standalone ; page meeting utilise désormais le workflow unique) |
---

## 14. Spécificités et conventions

### Contexte client/dossier

- Persistance `localStorage`
- Réinitialisation du dossier si changement de client
- Utilisation dans : page meeting (ContextSwitcher dans le header), workflow meeting (clientId, dossierId dans meta), transcribe, agent Scribe, import, docs-chat

### Timezone

- Montréal : `todayMontreal()` pour les dates métier (leads, daily).

### Erreurs

- Composables : toasts automatiques sur succès/erreur (hors `runMeetingWorkflow`, géré par la page meeting)
- Page meeting : toasts selon workflow status (ok → success, degraded → warning, error → error)
- Ingestion : messages via `normalizeIngestionError` (timeout, réseau, etc.)

### API Status

- `ApiStatusBadge` : poll `/api/health` (60 s, retry 10 s si erreur)
- `useState` global : `api-latency-ms`, `api-up`

### Pagination leads

- Backend : chunks 100, paramètre `offset` si supporté
- Frontend : fusion des résultats ; sinon limitation à 100 si backend ne gère pas offset (cf. `ariane-leads-pagination.md`)

---

## 15. Évolutions futures

- **Permissions** : Par client/dossier
- **Historique** : Changements de contexte
- **Notifications** : Sur changement de contexte
- **Multi-contexte** : Plusieurs contextes en parallèle
- **Filtres avancés** : Clients, leads
- **Export** : Données clients/dossiers, leads
- **Recherche globale** : Clients + dossiers
- **Statistiques** : Observabilité par client/dossier
- **Pagination backend** : Support complet `offset` côté Ariane Core

---

*Document généré pour ArianeAI — Toutes les fonctionnalités décrites reflètent l’état actuel du projet.*
