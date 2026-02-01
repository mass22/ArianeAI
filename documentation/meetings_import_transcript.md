# Documentation : Intégration de la transcription brute dans `/meetings/import`

## 📋 Résumé

Cette documentation décrit les modifications apportées pour enrichir l'endpoint `/meetings/import` avec la transcription brute et le résultat complet de l'agent Scribe. Ces données supplémentaires permettent à Ariane Core d'avoir accès à toutes les informations nécessaires pour un traitement optimal des réunions importées.

---

## 🎯 Objectif

Lors de l'import d'une réunion dans Ariane Core, le frontend envoie désormais :
- ✅ Le markdown formaté (existant)
- ✅ **La transcription brute** de Whisper (nouveau)
- ✅ **Le résultat complet de Scribe** (nouveau)
- ✅ Les métadonnées (existant)

Cela permet à Ariane Core de :
- Conserver la transcription originale pour référence
- Accéder aux données structurées de Scribe si nécessaire
- Améliorer la traçabilité et le débogage

---

## 📝 Modifications apportées

### 1. Frontend : `app/pages/meeting.vue`

**Fichier modifié :** `app/pages/meeting.vue`
**Lignes modifiées :** 355-361

#### Avant

```typescript
await $fetch('/api/ariane/meetings/import', {
  method: 'POST',
  body: {
    content: markdownContent,
    meta: { source, label: `import depuis Nuxt - ${source}` },
  },
})
```

#### Après

```typescript
await $fetch('/api/ariane/meetings/import', {
  method: 'POST',
  body: {
    content: markdownContent,
    transcript: transcript.value, // ⚠️ IMPORTANT : la transcription brute
    scribeResult: scribeRes, // Optionnel mais recommandé
    meta: { source, label: `import depuis Nuxt - ${source}` },
  },
})
```

#### Détails

- **`transcript.value`** : Contient la transcription brute retournée par Whisper via `/api/ariane/transcribe`
- **`scribeRes`** : Contient le résultat complet de l'agent Scribe (résumé, points clés, objectifs, actions, etc.)
- Ces valeurs sont disponibles dans le scope de la fonction `processAudio()` après les appels API respectifs

---

### 2. Backend : `server/api/ariane/meetings/import.post.ts`

**Fichier modifié :** `server/api/ariane/meetings/import.post.ts`
**Lignes modifiées :** 8-11, 28-29, 32-39

#### 2.1 Type du body enrichi

**Avant :**

```typescript
const body = await readBody<{
  content?: string
  meta?: Record<string, any>
}>(event)
```

**Après :**

```typescript
const body = await readBody<{
  content?: string
  transcript?: string
  scribeResult?: Record<string, any>
  meta?: Record<string, any>
}>(event)
```

#### 2.2 Logs améliorés

**Ajout d'un log pour la longueur de la transcription :**

```typescript
console.log('[Nuxt/api/ariane/meetings/import] Content length:', body.content?.length || 0)
console.log('[Nuxt/api/ariane/meetings/import] Transcript length:', body.transcript?.length || 0)
```

#### 2.3 Transmission à Ariane Core

**Avant :**

```typescript
const result = await $fetch(coreUrl + '/meetings/import', {
  method: 'POST',
  body: {
    content: body.content,
    meta: body.meta || { source: 'meeting', label: 'import depuis Nuxt' }
  }
})
```

**Après :**

```typescript
const result = await $fetch(coreUrl + '/meetings/import', {
  method: 'POST',
  body: {
    content: body.content,
    transcript: body.transcript, // ⚠️ IMPORTANT : la transcription brute
    scribeResult: body.scribeResult, // Optionnel mais recommandé
    meta: body.meta || { source: 'meeting', label: 'import depuis Nuxt' }
  }
})
```

---

## 📊 Structure des données envoyées

### Payload complet envoyé à Ariane Core

```json
{
  "content": "## Résumé\n\n...",
  "transcript": "Bonjour, je voudrais discuter de...",
  "scribeResult": {
    "summary": "...",
    "key_points": ["...", "..."],
    "client_goals": ["...", "..."],
    "implicit_needs": ["...", "..."],
    "risks": ["...", "..."],
    "action_items": ["...", "..."],
    "open_questions": ["...", "..."]
  },
  "meta": {
    "source": "meeting-recording",
    "label": "import depuis Nuxt - meeting-recording"
  }
}
```

### Description des champs

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `content` | `string` | ✅ Oui | Markdown formaté contenant le résumé structuré de la réunion |
| `transcript` | `string` | ⚠️ Recommandé | Transcription brute de Whisper (texte non formaté) |
| `scribeResult` | `object` | ⚠️ Recommandé | Résultat complet de l'agent Scribe avec toutes les données structurées |
| `meta` | `object` | ❌ Non | Métadonnées optionnelles (source, label, etc.) |

---

## 🔍 Logs et débogage

### Logs côté backend

Les logs suivants sont maintenant disponibles dans la console Nuxt :

```
[Nuxt/api/ariane/meetings/import] → http://192.168.2.110:4000/meetings/import
[Nuxt/api/ariane/meetings/import] Content length: 100
[Nuxt/api/ariane/meetings/import] Transcript length: 85
[Nuxt/api/ariane/meetings/import] OK (22990 ms)
```

### Logs côté frontend

Les logs suivants sont disponibles dans la console du navigateur :

```javascript
[meeting.vue] Appel à /api/ariane/meetings/import avec contenu markdown: ...
[meeting.vue] Import réussi ✅
```

---

## 🔄 Flux de données

### Schéma du flux complet

```
1. Frontend (meeting.vue)
   └─> Enregistrement audio ou upload fichier
       └─> Conversion en base64
           └─> POST /api/ariane/transcribe
               └─> Retourne transcript.value

2. Frontend (meeting.vue)
   └─> POST /api/ariane/agent/scribe
       └─> Body: { transcript: transcript.value }
           └─> Retourne scribeRes

3. Frontend (meeting.vue)
   └─> formatScribeToMarkdown(scribeRes)
       └─> Génère markdownContent

4. Frontend (meeting.vue)
   └─> POST /api/ariane/meetings/import
       └─> Body: {
             content: markdownContent,
             transcript: transcript.value,      ← NOUVEAU
             scribeResult: scribeRes,           ← NOUVEAU
             meta: { ... }
           }

5. Backend (import.post.ts)
   └─> Proxy vers Ariane Core
       └─> POST http://192.168.2.110:4000/meetings/import
           └─> Body: {
                 content: ...,
                 transcript: ...,               ← NOUVEAU
                 scribeResult: ...,             ← NOUVEAU
                 meta: ...
               }
```

---

## ✅ Tests et validation

### Test manuel effectué

D'après les logs du terminal, la modification fonctionne correctement :

```
[Nuxt/api/ariane/transcribe] OK (9473 ms, transcript length=85)
[Nuxt/api/ariane/meetings/import] → http://192.168.2.110:4000/meetings/import
[Nuxt/api/ariane/meetings/import] Content length: 100
[Nuxt/api/ariane/meetings/import] Transcript length: 85
[Nuxt/api/ariane/meetings/import] OK (22990 ms)
```

✅ La transcription brute est bien transmise (85 caractères)
✅ Le contenu markdown est toujours présent (100 caractères)
✅ L'appel à Ariane Core réussit

---

## 🚀 Prochaines étapes

### Côté Ariane Core

Ariane Core doit être mis à jour pour :
1. ✅ Accepter les nouveaux champs `transcript` et `scribeResult`
2. ✅ Stocker la transcription brute pour référence
3. ✅ Utiliser les données structurées de Scribe si nécessaire
4. ✅ Documenter l'API `/meetings/import` avec les nouveaux champs

### Améliorations possibles

- [ ] Ajouter une validation côté backend pour vérifier la présence de `transcript`
- [ ] Ajouter des tests unitaires pour vérifier la transmission des données
- [ ] Documenter le format exact attendu par Ariane Core pour `scribeResult`

---

## 📚 Références

- **Fichier frontend modifié :** `app/pages/meeting.vue`
- **Fichier backend modifié :** `server/api/ariane/meetings/import.post.ts`
- **Endpoint Ariane Core :** `POST http://192.168.2.110:4000/meetings/import`
- **Date de modification :** 2024 (voir logs terminal ligne 1018)

---

## 📝 Notes

- Les champs `transcript` et `scribeResult` sont optionnels mais fortement recommandés
- Si `transcript` n'est pas fourni, Ariane Core peut toujours fonctionner avec le `content` markdown
- Le champ `scribeResult` permet à Ariane Core d'accéder aux données structurées sans avoir à parser le markdown

---

*Documentation générée automatiquement après les modifications du code*

