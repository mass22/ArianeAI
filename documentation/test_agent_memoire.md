# Guide de test : Agent Mémoire

## 🎯 Objectif

L'agent **Mémoire** permet d'accéder à l'historique et au contexte de vos clients et dossiers. Ce guide vous explique comment le tester.

## 📋 Prérequis

1. **Ariane Core** doit être démarré et accessible
2. Avoir au moins **un client** créé dans l'application
3. (Optionnel) Avoir des **dossiers** associés aux clients
4. (Optionnel) Avoir des **réunions** ou **documents** importés pour un client

## 🚀 Étapes de test

### 1. Accéder à la page Agents

1. Ouvrez votre navigateur et allez sur `/agents`
2. Vous devriez voir la sidebar avec les 4 agents disponibles

### 2. Sélectionner l'agent Mémoire

1. Cliquez sur **"Mémoire"** dans la sidebar
2. Le header devrait afficher : "Mémoire - Accès à ton historique"

### 3. Configurer le contexte (recommandé)

Pour que l'agent Mémoire puisse accéder à l'historique d'un client spécifique :

1. **Sélectionner un client** :
   - Utilisez le sélecteur de contexte dans le header de l'application
   - Choisissez un client existant
   - Le contexte s'affichera dans le header de la page agents

2. **Sélectionner un dossier** (optionnel) :
   - Si vous avez des dossiers pour ce client
   - Sélectionnez un dossier dans le sélecteur de contexte
   - Cela permettra à l'agent d'accéder à l'historique spécifique du dossier

### 4. Tester l'agent Mémoire

#### Test 1 : Question générale sur l'historique

**Question à poser :**
```
Quels sont les derniers échanges ou interactions avec ce client ?
```

**Résultat attendu :**
- L'agent devrait retourner un résumé des interactions récentes
- Peut inclure des réunions, documents, ou autres artifacts

#### Test 2 : Question sur un dossier spécifique

**Prérequis :** Avoir sélectionné un client ET un dossier

**Question à poser :**
```
Résume-moi l'historique de ce dossier
```

**Résultat attendu :**
- Résumé des éléments liés au dossier sélectionné
- Peut inclure des réunions, notes, documents associés

#### Test 3 : Recherche dans l'historique

**Question à poser :**
```
Quelles réunions avons-nous eues avec ce client le mois dernier ?
```

**Résultat attendu :**
- Liste des réunions correspondant aux critères
- Dates et sujets des réunions

#### Test 4 : Contexte sans client sélectionné

**Action :** Ne pas sélectionner de client dans le contexte

**Question à poser :**
```
Quel est mon historique récent ?
```

**Résultat attendu :**
- L'agent peut retourner un historique global
- Ou indiquer qu'un contexte client est nécessaire

## 🔍 Vérifications

### Vérifier que le contexte est bien envoyé

1. Ouvrez les **outils de développement** du navigateur (F12)
2. Allez dans l'onglet **Network** (Réseau)
3. Posez une question à l'agent Mémoire
4. Cherchez la requête vers `/api/ariane/agent/memory`
5. Vérifiez dans le **payload** que les champs suivants sont présents :
   ```json
   {
     "context": {
       "clientId": "...",
       "dossierId": "..."
     },
     "meta": {
       "clientId": "...",
       "dossierId": "..."
     }
   }
   ```

### Vérifier les logs côté serveur

Si vous avez accès aux logs d'Ariane Core, vérifiez que :
- La requête arrive bien avec le contexte
- L'agent Mémoire traite correctement le contexte
- Les réponses incluent bien les informations du client/dossier

## 🐛 Dépannage

### L'agent ne retourne pas d'historique

**Solutions :**
1. Vérifiez qu'un client est bien sélectionné dans le contexte
2. Vérifiez qu'Ariane Core est accessible et fonctionne
3. Vérifiez qu'il y a bien des données (réunions, documents) pour ce client
4. Consultez les logs d'Ariane Core pour voir les erreurs éventuelles

### Le contexte n'apparaît pas dans le header

**Solutions :**
1. Vérifiez que vous avez bien sélectionné un client dans le header principal
2. Rechargez la page `/agents`
3. Vérifiez la console du navigateur pour des erreurs JavaScript

### Erreur de connexion

**Solutions :**
1. Vérifiez qu'Ariane Core est démarré
2. Vérifiez l'URL dans `.env` ou `nuxt.config.ts`
3. Vérifiez les logs du serveur Nuxt

## 📝 Exemples de questions à tester

Voici une liste de questions que vous pouvez tester avec l'agent Mémoire :

1. **Questions générales :**
   - "Quel est l'historique de ce client ?"
   - "Résume-moi les dernières interactions"
   - "Quels sont les dossiers actifs pour ce client ?"

2. **Questions sur les réunions :**
   - "Quelles réunions avons-nous eues avec ce client ?"
   - "Résume-moi la dernière réunion"
   - "Quels étaient les points importants de la réunion du [date] ?"

3. **Questions sur les documents :**
   - "Quels documents avons-nous pour ce dossier ?"
   - "Résume-moi le document [nom]"
   - "Quels sont les derniers documents ajoutés ?"

4. **Questions contextuelles :**
   - "Quelle est la situation actuelle de ce dossier ?"
   - "Quels sont les prochaines étapes prévues ?"
   - "Y a-t-il des points d'attention pour ce client ?"

## 🎓 Comprendre le fonctionnement

L'agent Mémoire fonctionne en :

1. **Récupérant le contexte** : Client et dossier sélectionnés dans l'interface
2. **Interrogeant Ariane Core** : Envoie la question avec le contexte au backend
3. **Accédant à l'historique** : Ariane Core interroge sa base de données CRM
4. **Retournant une réponse** : L'agent synthétise les informations trouvées

Le contexte permet de :
- Filtrer les résultats par client
- Filtrer les résultats par dossier
- Accéder aux artifacts (réunions, documents, notes) associés
- Fournir des réponses pertinentes et contextualisées
