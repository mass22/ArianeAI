# Import LinkedIn URLs — enrichissement des champs

## Problème actuel

Lors de l'import de leads via **URLs LinkedIn** (onglet "LinkedIn URLs" de l'import), les champs suivants restent vides :

- **Nom** (contact_name / name)
- **Poste / Rôle** (role)
- **Entreprise** (company)

Seuls sont renseignés :
- `lead_key` : extrait du slug de l'URL (ex. `chloe-genet10` pour `linkedin.com/in/chloe-genet10`)
- `linkedin_url` : URL du profil
- `source` : `"urls"`

L'**enrichissement** (`POST /api/leads/:lead_key/enrich`) ne peut alors pas générer les messages de prospection, car les prompts LLM attendent au minimum `name`, `company` et `role` (cf. `prompts_lead_enrichment.md`).

---

## Solutions attendues côté Ariane Core

### Option A : Enrichir à l'ingestion

Lors de `POST /api/ingest/urls` ou `POST /api/leads/ingest/linkedin-urls` :

1. Pour chaque URL LinkedIn valide (`linkedin.com/in/...`) :
2. Extraire le slug (ex. `chloe-genet10`)
3. **Récupérer les données du profil** via :
   - Service tiers (Proxycurl, PhantomBuster, Apollo, etc.)
   - Ou scraping (limité par les conditions d'utilisation LinkedIn)
4. Créer le lead avec :
   - `lead_key` : slug
   - `contact_name` / `name` : nom du contact
   - `company` : entreprise
   - `role` : poste / titre
   - `linkedin_url` : URL
   - `source` : `"urls"` ou `"linkedin_urls"`

### Option B : Enrichir à la demande (recommandé)

Lors de `POST /api/leads/:lead_key/enrich` :

1. Si `contact_name`, `company`, `role` sont vides **mais** `linkedin_url` est présent :
2. Appeler un service d'enrichissement LinkedIn (Proxycurl, etc.) pour récupérer le profil
3. Mettre à jour le lead avec ces champs
4. Puis exécuter la génération LLM des messages (outreach, J+4, J+10)

Cette approche évite d'enrichir tous les leads à l'import (coût, latence) et permet de ne récupérer que les profils quand l'utilisateur le demande.

### Option C : Saisie manuelle (implémenté)

Le frontend ArianeAI permet désormais de modifier manuellement les champs Nom, Poste, Entreprise, Type et LinkedIn. Le PATCH du lead doit accepter : `contact_name`, `company`, `role`, `type`, `linkedin_url`.

---

## Services d'enrichissement LinkedIn

| Service      | Description                          | API |
|-------------|--------------------------------------|-----|
| **Proxycurl** | Enrichissement profil LinkedIn      | `https://nubela.co/proxycurl/docs#people-api-person-profile-endpoint` |
| **PhantomBuster** | Scraping LinkedIn (automation)  | |
| **Apollo**   | Base de contacts + enrichissement   | |

---

## Endpoints concernés

| Frontend (ArianeAI)     | Backend (Ariane Core)                  |
|-------------------------|----------------------------------------|
| `POST /api/ingest/urls` | `POST {ARIANE_API}/api/ingest/urls`   |
| `POST /api/leads/ingest/linkedin-urls` | `POST {ARIANE_API}/api/leads/ingest/linkedin-urls` |
| `POST /api/leads/:key/enrich` | `POST {ARIANE_API}/api/leads/:key/enrich` |

Le frontend utilise actuellement `/api/leads/ingest/linkedin-urls` pour l'onglet "LinkedIn URLs" (spécifique).

---

## Format attendu du lead enrichi

```json
{
  "lead_key": "chloe-genet10",
  "contact_name": "Chloé Genet",
  "company": "Acme Corp",
  "role": "CTO",
  "linkedin_url": "https://linkedin.com/in/chloe-genet10",
  "source": "urls",
  "type": "cto_or_head_of_engineering",
  "generated_outreach": "...",
  "followup_j4": "...",
  "followup_j10": "..."
}
```
