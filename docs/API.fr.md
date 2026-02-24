# 🔌 Documentation API

Référence API complète pour le backend du Gestionnaire de Tournois de Fléchettes.

## URL de base

```
Development: http://localhost:3000
Production: https://your-domain.com
```

## Authentification

La plupart des endpoints supportent l’authentification optionnelle. Les endpoints admin nécessitent un token JWT bearer valide.

### En-têtes

```http
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

### Obtenir le statut admin

```http
GET /api/auth/me
Authorization: Bearer YOUR_TOKEN
```

**Réponse :**
```json
{
  "user": {
    "id": "google-oauth2|123456789",
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "https://..."
  },
  "isAdmin": true
}
```

---

## Tournois

### Lister tous les tournois

```http
GET /api/tournaments
```

**Paramètres de requête :**
- `status` (optionnel) : filtrer par statut (DRAFT, OPEN, SIGNATURE, LIVE, FINISHED)
- `format` (optionnel) : filtrer par format (SINGLE, DOUBLE, TEAM_4_PLAYER)
- `name` (optionnel) : recherche par nom (match partiel)
- `page` (optionnel) : page (défaut : 1)
- `limit` (optionnel) : résultats par page (défaut : 10, max : 100)
- `sortBy` (optionnel) : champ de tri (name, startTime, createdAt)
- `sortOrder` (optionnel) : ordre de tri (asc, desc)

**Exemple :**
```bash
curl "http://localhost:3000/api/tournaments?status=LIVE&page=1&limit=10"
```

**Réponse :**
```json
{
  "tournaments": [
    {
      "id": "uuid",
      "name": "Spring Championship",
      "format": "SINGLE",
      "durationType": "FULL_DAY",
      "startTime": "2026-04-15T09:00:00Z",
      "endTime": "2026-04-15T18:00:00Z",
      "totalParticipants": 16,
      "targetCount": 4,
      "status": "LIVE",
      "logoUrl": "/uploads/logos/uuid.png",
      "createdAt": "2026-02-10T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

### Récupérer les tournois par intervalle de dates

```http
GET /api/tournaments/date-range?startDate=2026-04-01T00:00:00Z&endDate=2026-04-30T23:59:59Z
```

**Paramètres de requête :**
- `startDate` (requis) : datetime ISO 8601
- `endDate` (requis) : datetime ISO 8601

### Vérifier la disponibilité d’un nom de tournoi

```http
GET /api/tournaments/check-name/:name
```

**Réponse :**
```json
{
  "available": true
}
```

### Statistiques des tournois

```http
GET /api/tournaments/stats
```

**Réponse :**
```json
{
  "totalTournaments": 150,
  "activeTournaments": 5,
  "completedTournaments": 145,
  "totalPlayers": 850,
  "totalMatches": 2400
}
```

### Récupérer un tournoi par ID

```http
GET /api/tournaments/:id
```

**Réponse :**
```json
{
  "id": "uuid",
  "name": "Spring Championship",
  "format": "SINGLE",
  "durationType": "FULL_DAY",
  "startTime": "2026-04-15T09:00:00Z",
  "endTime": "2026-04-15T18:00:00Z",
  "totalParticipants": 16,
  "targetCount": 4,
  "status": "LIVE",
  "logoUrl": "/uploads/logos/uuid.png",
  "createdAt": "2026-02-10T10:00:00Z",
  "poolStages": [...],
  "brackets": [...],
  "players": [...]
}
```

### Récupérer la vue live d’un tournoi

```http
GET /api/tournaments/:id/live
```

**Réponse :** contient poolStages avec pools, matches, brackets, targets et status temps réel.

```json
{
  "id": "uuid",
  "name": "Spring Championship",
  "status": "LIVE",
  "poolStages": [
    {
      "id": "uuid",
      "stageNumber": 1,
      "name": "Group Stage",
      "pools": [
        {
          "id": "uuid",
          "poolNumber": 1,
          "name": "Pool A",
          "matches": [...]
        }
      ]
    }
  ],
  "brackets": [...],
  "targets": [
    {
      "id": "uuid",
      "targetNumber": 1,
      "targetCode": "T1",
      "status": "AVAILABLE",
      "currentMatchId": null
    }
  ]
}
```

### Créer un tournoi

```http
POST /api/tournaments
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json
```

**Corps de requête :**
```json
{
  "name": "Summer Championship",
  "format": "SINGLE",
  "durationType": "FULL_DAY",
  "startTime": "2026-06-15T09:00:00Z",
  "endTime": "2026-06-15T18:00:00Z",
  "totalParticipants": 32,
  "targetCount": 8
}
```

**Règles de validation :**
- `name` : 3-100 caractères
- `format` : SINGLE | DOUBLE | TEAM_4_PLAYER
- `durationType` : HALF_DAY_MORNING | HALF_DAY_AFTERNOON | HALF_DAY_NIGHT | FULL_DAY | TWO_DAY
- `startTime` : doit être dans le futur, format ISO 8601
- `endTime` : après startTime, durée 1-24 heures
- `totalParticipants` : 2-128
- `targetCount` : 1-32

**Réponse :** 201 Created avec l’objet tournoi

### Mettre à jour un tournoi

```http
PUT /api/tournaments/:id
Authorization: Bearer ADMIN_TOKEN
```

**Corps :** objet tournoi partiel (tous les champs optionnels)

### Mettre à jour le statut d’un tournoi

```http
PATCH /api/tournaments/:id/status
Authorization: Bearer ADMIN_TOKEN
```

**Corps de requête :**
```json
{
  "status": "LIVE",
  "force": false
}
```

**Transitions de statut :**
- DRAFT → OPEN (nécessite des poules ou tableaux configurés)
- OPEN → SIGNATURE (transition auto quand prêt)
- SIGNATURE → LIVE (action admin requise)
- LIVE → FINISHED (quand tous les matchs sont terminés)

### Téléverser un logo de tournoi

```http
POST /api/tournaments/:id/logo
Authorization: Bearer ADMIN_TOKEN
Content-Type: multipart/form-data
```

**Form Data :**
- `logo` : fichier image (JPG/PNG, max 5 Mo)

**Réponse :**
```json
{
  "logoUrl": "/uploads/logos/tournament-uuid.png"
}
```

### Supprimer un tournoi

```http
DELETE /api/tournaments/:id
Authorization: Bearer ADMIN_TOKEN
```

**Réponse :** 204 No Content

---

## Joueurs

### Récupérer les joueurs d’un tournoi

```http
GET /api/tournaments/:id/players
```

**Réponse :**
```json
{
  "players": [
    {
      "playerId": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "surname": "JD",
      "teamName": null,
      "email": "john@example.com",
      "phone": "+1234567890",
      "skillLevel": "ADVANCED",
      "checkedIn": true,
      "registeredAt": "2026-02-15T10:00:00Z"
    }
  ]
}
```

### Inscrire un joueur

```http
POST /api/tournaments/:id/players
```

**Corps de requête :**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "surname": "JD",
  "teamName": "Team Alpha",
  "email": "john@example.com",
  "phone": "+1234567890",
  "skillLevel": "ADVANCED"
}
```

**Validation :**
- `firstName` : 2-50 caractères (requis)
- `lastName` : 2-50 caractères (requis)
- `surname` : max 50 caractères (optionnel)
- `teamName` : max 100 caractères (optionnel)
- `email` : format email valide (optionnel)
- `phone` : 5-20 caractères (optionnel)
- `skillLevel` : BEGINNER | INTERMEDIATE | ADVANCED | EXPERT (optionnel)

**Réponse :** 201 Created avec l’objet joueur

### Mettre à jour un joueur

```http
PATCH /api/tournaments/:id/players/:playerId
```

**Corps :** objet joueur partiel

### Mettre à jour le check-in d’un joueur

```http
PATCH /api/tournaments/:id/players/:playerId/check-in
```

**Corps :**
```json
{
  "checkedIn": true
}
```

### Supprimer un joueur

```http
DELETE /api/tournaments/:id/players/:playerId
Authorization: Bearer ADMIN_TOKEN
```

**Réponse :** 204 No Content

### Récupérer les joueurs orphelins

```http
GET /api/tournaments/players/orphans
```

**Réponse :** liste des joueurs non assignés

---

## Phases de poules

### Récupérer les phases de poules

```http
GET /api/tournaments/:id/pool-stages
```

**Réponse :**
```json
{
  "poolStages": [
    {
      "id": "uuid",
      "stageNumber": 1,
      "name": "Group Stage",
      "poolCount": 4,
      "playersPerPool": 4,
      "advanceCount": 2,
      "losersAdvanceToBracket": false,
      "rankingDestinations": [
        { "position": 1, "destinationType": "BRACKET", "bracketId": "uuid" },
        { "position": 2, "destinationType": "POOL_STAGE", "poolStageId": "uuid" },
        { "position": 3, "destinationType": "ELIMINATED" },
        { "position": 4, "destinationType": "ELIMINATED" }
      ],
      "status": "IN_PROGRESS",
      "createdAt": "2026-02-15T10:00:00Z"
    }
  ]
}
```

### Créer une phase de poules

```http
POST /api/tournaments/:id/pool-stages
Authorization: Bearer ADMIN_TOKEN
```

**Corps :**
```json
{
  "stageNumber": 1,
  "name": "Group Stage",
  "poolCount": 4,
  "playersPerPool": 4,
  "advanceCount": 2,
  "losersAdvanceToBracket": false,
  "rankingDestinations": [
    { "position": 1, "destinationType": "BRACKET", "bracketId": "uuid" },
    { "position": 2, "destinationType": "POOL_STAGE", "poolStageId": "uuid" },
    { "position": 3, "destinationType": "ELIMINATED" },
    { "position": 4, "destinationType": "ELIMINATED" }
  ]
}
```

**Validation :**
- `stageNumber` : entier ≥ 1 (séquentiel)
- `name` : 1-100 caractères
- `poolCount` : 1-16
- `playersPerPool` : 2-16
- `advanceCount` : 1-16
- `losersAdvanceToBracket` : booléen (optionnel, défaut : false)
- `rankingDestinations` : tableau des destinations par rang (optionnel)
  - `position` : 1..playersPerPool
  - `destinationType` : BRACKET | POOL_STAGE | ELIMINATED
  - `bracketId` : requis si destinationType vaut BRACKET
  - `poolStageId` : requis si destinationType vaut POOL_STAGE

### Mettre à jour une phase de poules

```http
PATCH /api/tournaments/:id/pool-stages/:stageId
Authorization: Bearer ADMIN_TOKEN
```

**Corps :**
```json
{
  "name": "Updated Name",
  "poolCount": 4,
  "playersPerPool": 4,
  "advanceCount": 2,
  "rankingDestinations": [
    { "position": 1, "destinationType": "BRACKET", "bracketId": "uuid" },
    { "position": 2, "destinationType": "POOL_STAGE", "poolStageId": "uuid" },
    { "position": 3, "destinationType": "ELIMINATED" },
    { "position": 4, "destinationType": "ELIMINATED" }
  ],
  "status": "EDITION"
}
```

**Statuts :**
- `NOT_STARTED` : état initial
- `EDITION` : en configuration
- `IN_PROGRESS` : matchs en cours
- `COMPLETED` : matchs terminés

**Comportement live (UI admin) :**
- Envoyer `status: "EDITION"` sur une phase sans affectations déclenche la répartition automatique des joueurs dans les poules (équilibrée par niveau) et conserve la phase éditable.
- Envoyer `status: "IN_PROGRESS"` crée les matchs de poules (si nécessaire) et démarre la phase.
- Envoyer `status: "NOT_STARTED"` réinitialise les matchs de poules de la phase.

**Routing :**
- Si `rankingDestinations` est défini, la fin de phase route les joueurs par rang vers un arbre ou une autre phase.
- Cela remplace les règles `advanceCount` / `losersAdvanceToBracket` pour la phase.

### Terminer une phase de poules (scores aléatoires)

```http
POST /api/tournaments/:id/pool-stages/:stageId/complete
Authorization: Bearer ADMIN_TOKEN
```

**Réponse :** phase de poules terminée avec scores générés

### Supprimer une phase de poules

```http
DELETE /api/tournaments/:id/pool-stages/:stageId
```

### Récupérer les poules d’une phase

```http
GET /api/tournaments/:id/pool-stages/:stageId/pools
```

**Réponse :**
```json
{
  "pools": [
    {
      "id": "uuid",
      "poolNumber": 1,
      "name": "Pool A",
      "status": "IN_PROGRESS",
      "assignments": [
        {
          "id": "uuid",
          "playerId": "uuid",
          "assignmentType": "SEEDED",
          "seedNumber": 1,
          "player": {
            "id": "uuid",
            "firstName": "John",
            "lastName": "Doe"
          }
        }
      ]
    }
  ]
}
```

### Mettre à jour les affectations de poule

```http
PUT /api/tournaments/:id/pool-stages/:stageId/assignments
```

**Corps :**
```json
{
  "assignments": [
    {
      "poolId": "uuid",
      "playerId": "uuid",
      "assignmentType": "SEEDED",
      "seedNumber": 1
    }
  ]
}
```

**Types d’affectation :**
- `SEEDED` : seed selon niveau
- `RANDOM` : aléatoire
- `BYE` : emplacement libre

---

## Tableaux

### Récupérer les tableaux

```http
GET /api/tournaments/:id/brackets
```

**Réponse :**
```json
{
  "brackets": [
    {
      "id": "uuid",
      "name": "Winner Bracket",
      "bracketType": "SINGLE_ELIMINATION",
      "totalRounds": 4,
      "status": "IN_PROGRESS",
      "entries": [...],
      "matches": [...]
    }
  ]
}
```

### Peupler un arbre depuis les poules

```http
POST /api/tournaments/:id/brackets/:bracketId/populate-from-pools
Authorization: Bearer ADMIN_TOKEN
```

**Corps :**
```json
{
  "stageId": "uuid",
  "role": "WINNER"
}
```

**Notes :**
- `role` est optionnel (WINNER ou LOSER).
- Si la phase a `rankingDestinations`, seuls les joueurs routés vers cet arbre sont utilisés.

### Créer un tableau

```http
POST /api/tournaments/:id/brackets
Authorization: Bearer ADMIN_TOKEN
```

**Corps :**
```json
{
  "name": "Winner Bracket",
  "bracketType": "SINGLE_ELIMINATION",
  "totalRounds": 4
}
```

**Types de tableau :**
- `SINGLE_ELIMINATION` : simple élimination
- `DOUBLE_ELIMINATION` : double élimination (pas encore implémenté)

**Validation :**
- `name` : 1-100 caractères
- `bracketType` : SINGLE_ELIMINATION | DOUBLE_ELIMINATION
- `totalRounds` : 1-10

### Mettre à jour un tableau

```http
PATCH /api/tournaments/:id/brackets/:bracketId
Authorization: Bearer ADMIN_TOKEN
```

**Corps :**
```json
{
  "name": "Updated Bracket Name",
  "status": "COMPLETED"
}
```

### Supprimer un tableau

```http
DELETE /api/tournaments/:id/brackets/:bracketId
Authorization: Bearer ADMIN_TOKEN
```

### Terminer un tour de tableau (scores aléatoires)

```http
PATCH /api/tournaments/:id/brackets/:bracketId/rounds/:roundNumber/complete
Authorization: Bearer ADMIN_TOKEN
```

**Paramètres de chemin :**
- `roundNumber` : entier (1 = finales, 2 = demi-finales, etc.)

**Réponse :** matchs du tour terminés avec scores aléatoires, gagnants avancés

---

## Matchs

### Mettre à jour le statut d’un match

```http
PATCH /api/tournaments/:id/matches/:matchId/status
Authorization: Bearer ADMIN_TOKEN
```

**Corps :**
```json
{
  "status": "IN_PROGRESS",
  "targetId": "uuid"
}
```

**Statuts de match :**
- `SCHEDULED` : planifié
- `IN_PROGRESS` : en cours
- `COMPLETED` : terminé
- `CANCELLED` : annulé

**Notes :**
- Passer à `IN_PROGRESS` assigne le match à une cible
- La cible devient indisponible pendant le match
- Sortir de `IN_PROGRESS` libère la cible

### Terminer un match

```http
PATCH /api/tournaments/:id/matches/:matchId/complete
Authorization: Bearer ADMIN_TOKEN
```

**Corps :**
```json
{
  "scores": [
    {
      "playerId": "uuid",
      "scoreTotal": 301
    },
    {
      "playerId": "uuid",
      "scoreTotal": 187
    }
  ]
}
```

**Notes :**
- Passe le statut à `COMPLETED`
- Détermine le gagnant selon le score
- Libère la cible
- Avance le gagnant dans le tableau (si applicable)

### Mettre à jour les scores d’un match

```http
PATCH /api/tournaments/:id/matches/:matchId/scores
Authorization: Bearer ADMIN_TOKEN
```

**Corps :** identique à Terminer un match

**Notes :**
- Met à jour un match déjà terminé
- Recalcule le gagnant si besoin
- Ne change pas le statut

---

## Validation & erreurs

### Format de réponse d’erreur

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "name",
      "message": "Tournament name must be at least 3 characters long"
    }
  ]
}
```

### Codes HTTP

| Code | Signification |
|------|---------------|
| 200 | Succès |
| 201 | Créé |
| 204 | No Content (suppression) |
| 400 | Bad Request (validation) |
| 401 | Unauthorized (token manquant/invalid) |
| 403 | Forbidden (pas admin) |
| 404 | Not Found |
| 409 | Conflict (nom dupliqué, etc.) |
| 422 | Unprocessable Entity (transition invalide) |
| 500 | Internal Server Error |

### Erreurs de validation courantes

**UUID invalide :**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "id",
      "message": "Invalid UUID format"
    }
  ]
}
```

**Validation de dates :**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "endTime",
      "message": "End time must be after start time"
    }
  ]
}
```

---

## Rate limiting

Les endpoints sont limités pour éviter l’abus :

- **Endpoints généraux** : 100 requêtes par 15 minutes et par IP
- **Endpoints d’authentification** : 5 requêtes par 15 minutes et par IP
- **Endpoints d’upload** : 10 requêtes par heure et par IP

**En-têtes de limitation :**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1645545600
```

---

## Événements WebSocket

Connexion au serveur WebSocket pour les mises à jour temps réel :

```javascript
import io from 'socket.io-client';
const socket = io('http://localhost:3000');
```

### Événements

**Match démarré :**
```javascript
socket.on('match:started', (data) => {
  // data = { matchId, tournamentId, targetId, players }
});
```

**Match terminé :**
```javascript
socket.on('match:completed', (data) => {
  // data = { matchId, tournamentId, winnerId, scores }
});
```

**Changement de statut de cible :**
```javascript
socket.on('target:status', (data) => {
  // data = { targetId, status, currentMatchId }
});
```

**Changement de statut de tournoi :**
```javascript
socket.on('tournament:status', (data) => {
  // data = { tournamentId, status }
});
```

---

## Collection Postman

Importer la collection Postman fournie pour tester l’API plus facilement :

```bash
# Emplacement : docs/postman/Darts_Tournament_API.postman_collection.json
```

---

## Ressources additionnelles

- [Configuration Authentification](./ADMIN_SETUP.fr.md)
- [Configuration email Auth0](./AUTH0_EMAIL_SETUP.fr.md)
- [Référence des commandes](./COMMANDS.fr.md)
- [Documentation Architecture](./ARCHITECTURE.fr.md)
- [Documentation Frontend](./FRONTEND.fr.md)
