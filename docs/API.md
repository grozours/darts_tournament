# \ud83d\udd0c API Documentation

Complete API reference for the Darts Tournament Manager backend.

## Base URL

```
Development: http://localhost:3000
Production: https://your-domain.com
```

## Authentication

Most endpoints support optional authentication. Admin-only endpoints require a valid JWT bearer token.

### Headers

```http
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

### Get Admin Status

```http
GET /api/auth/me
Authorization: Bearer YOUR_TOKEN
```

**Response:**
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

## Tournaments

### List All Tournaments

```http
GET /api/tournaments
```

**Query Parameters:**
- `status` (optional): Filter by status (DRAFT, OPEN, SIGNATURE, LIVE, FINISHED)
- `format` (optional): Filter by format (SINGLE, DOUBLE, TEAM_4_PLAYER)
- `name` (optional): Search by name (partial match)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 10, max: 100)
- `sortBy` (optional): Sort field (name, startTime, createdAt)
- `sortOrder` (optional): Sort order (asc, desc)

**Example:**
```bash
curl "http://localhost:3000/api/tournaments?status=LIVE&page=1&limit=10"
```

**Response:**
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

### Get Tournaments by Date Range

```http
GET /api/tournaments/date-range?startDate=2026-04-01T00:00:00Z&endDate=2026-04-30T23:59:59Z
```

**Query Parameters:**
- `startDate` (required): ISO 8601 datetime
- `endDate` (required): ISO 8601 datetime

### Check Tournament Name Availability

```http
GET /api/tournaments/check-name/:name
```

**Response:**
```json
{
  "available": true
}
```

### Get Tournament Statistics

```http
GET /api/tournaments/stats
```

**Response:**
```json
{
  "totalTournaments": 150,
  "activeTournaments": 5,
  "completedTournaments": 145,
  "totalPlayers": 850,
  "totalMatches": 2400
}
```

### Get Tournament by ID

```http
GET /api/tournaments/:id
```

**Response:**
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

### Get Tournament Live View

```http
GET /api/tournaments/:id/live
```

**Response:** Includes poolStages with pools, matches, brackets, targets, and real-time status.

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

### Create Tournament

```http
POST /api/tournaments
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json
```

**Request Body:**
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

**Validation Rules:**
- `name`: 3-100 characters
- `format`: SINGLE | DOUBLE | TEAM_4_PLAYER
- `durationType`: HALF_DAY_MORNING | HALF_DAY_AFTERNOON | HALF_DAY_NIGHT | FULL_DAY | TWO_DAY
- `startTime`: Must be in the future, ISO 8601 format
- `endTime`: Must be after startTime, duration 1-24 hours
- `totalParticipants`: 2-128
- `targetCount`: 1-32

**Response:** 201 Created with tournament object

### Update Tournament

```http
PUT /api/tournaments/:id
Authorization: Bearer ADMIN_TOKEN
```

**Request Body:** Partial tournament object (all fields optional)

### Update Tournament Status

```http
PATCH /api/tournaments/:id/status
Authorization: Bearer ADMIN_TOKEN
```

**Request Body:**
```json
{
  "status": "LIVE",
  "force": false
}
```

**Status Transitions:**
- DRAFT → OPEN (requires pool stages or brackets configured)
- OPEN → SIGNATURE (auto-transition when ready)
- SIGNATURE → LIVE (requires admin action)
- LIVE → FINISHED (when all matches completed)

### Upload Tournament Logo

```http
POST /api/tournaments/:id/logo
Authorization: Bearer ADMIN_TOKEN
Content-Type: multipart/form-data
```

**Form Data:**
- `logo`: Image file (JPG/PNG, max 5MB)

**Response:**
```json
{
  "logoUrl": "/uploads/logos/tournament-uuid.png"
}
```

### Delete Tournament

```http
DELETE /api/tournaments/:id
Authorization: Bearer ADMIN_TOKEN
```

**Response:** 204 No Content

---

## Players

### Get Tournament Players

```http
GET /api/tournaments/:id/players
```

**Response:**
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

### Register Player

```http
POST /api/tournaments/:id/players
```

**Request Body:**
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

**Validation:**
- `firstName`: 2-50 characters (required)
- `lastName`: 2-50 characters (required)
- `surname`: Max 50 characters (optional)
- `teamName`: Max 100 characters (optional)
- `email`: Valid email format (optional)
- `phone`: 5-20 characters (optional)
- `skillLevel`: BEGINNER | INTERMEDIATE | ADVANCED | EXPERT (optional)

**Response:** 201 Created with player object

### Update Player

```http
PATCH /api/tournaments/:id/players/:playerId
```

**Request Body:** Partial player object

### Update Player Check-in Status

```http
PATCH /api/tournaments/:id/players/:playerId/check-in
```

**Request Body:**
```json
{
  "checkedIn": true
}
```

### Delete Player

```http
DELETE /api/tournaments/:id/players/:playerId
Authorization: Bearer ADMIN_TOKEN
```

**Response:** 204 No Content

### Get Orphan Players

```http
GET /api/tournaments/players/orphans
```

**Response:** List of players not assigned to any tournament

---

## Pool Stages

### Get Pool Stages

```http
GET /api/tournaments/:id/pool-stages
```

**Response:**
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

### Create Pool Stage

```http
POST /api/tournaments/:id/pool-stages
Authorization: Bearer ADMIN_TOKEN
```

**Request Body:**
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

**Validation:**
- `stageNumber`: Integer ≥ 1 (sequential)
- `name`: 1-100 characters
- `poolCount`: 1-16
- `playersPerPool`: 2-16
- `advanceCount`: 1-16
- `losersAdvanceToBracket`: Boolean (optional, default: false)
- `rankingDestinations`: Array of per-rank destinations (optional)
  - `position`: 1..playersPerPool
  - `destinationType`: BRACKET | POOL_STAGE | ELIMINATED
  - `bracketId`: Required when destinationType is BRACKET
  - `poolStageId`: Required when destinationType is POOL_STAGE

### Update Pool Stage

```http
PATCH /api/tournaments/:id/pool-stages/:stageId
Authorization: Bearer ADMIN_TOKEN
```

**Request Body:**
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

**Status Values:**
- `NOT_STARTED`: Initial state
- `EDITION`: Being edited/configured
- `IN_PROGRESS`: Matches being played
- `COMPLETED`: All matches finished

**Live behavior (admin UI):**
- Sending `status: "EDITION"` on a stage with no assignments triggers automatic player distribution into pools (balanced by skill level) and keeps the stage editable.
- Sending `status: "IN_PROGRESS"` creates pool matches (if needed) and starts the stage.
- Sending `status: "NOT_STARTED"` resets pool matches for that stage.

**Routing:**
- When `rankingDestinations` is defined, stage completion routes players by rank to brackets or pool stages.
- This overrides default `advanceCount` / `losersAdvanceToBracket` behavior for that stage.

### Complete Pool Stage (with Random Scores)

```http
POST /api/tournaments/:id/pool-stages/:stageId/complete
Authorization: Bearer ADMIN_TOKEN
```

**Response:** Pool stage completed with randomly generated match scores

### Delete Pool Stage

```http
DELETE /api/tournaments/:id/pool-stages/:stageId
Authorization: Bearer ADMIN_TOKEN
```

### Get Pools for Stage

```http
GET /api/tournaments/:id/pool-stages/:stageId/pools
```

**Response:**
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

### Update Pool Assignments

```http
PUT /api/tournaments/:id/pool-stages/:stageId/assignments
```

**Request Body:**
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

**Assignment Types:**
- `SEEDED`: Player seeded based on skill level
- `RANDOM`: Random assignment
- `BYE`: Placeholder for bye/empty slot

---

## Brackets

### Get Brackets

```http
GET /api/tournaments/:id/brackets
```

**Response:**
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

### Populate Bracket from Pool Results

```http
POST /api/tournaments/:id/brackets/:bracketId/populate-from-pools
Authorization: Bearer ADMIN_TOKEN
```

**Request Body:**
```json
{
  "stageId": "uuid",
  "role": "WINNER"
}
```

**Notes:**
- `role` is optional (WINNER or LOSER).
- If the pool stage has `rankingDestinations`, only entries routed to this bracket are used.

### Create Bracket

```http
POST /api/tournaments/:id/brackets
Authorization: Bearer ADMIN_TOKEN
```

**Request Body:**
```json
{
  "name": "Winner Bracket",
  "bracketType": "SINGLE_ELIMINATION",
  "totalRounds": 4
}
```

**Bracket Types:**
- `SINGLE_ELIMINATION`: Single elimination bracket
- `DOUBLE_ELIMINATION`: Double elimination (not yet implemented)

**Validation:**
- `name`: 1-100 characters
- `bracketType`: SINGLE_ELIMINATION | DOUBLE_ELIMINATION
- `totalRounds`: 1-10

### Update Bracket

```http
PATCH /api/tournaments/:id/brackets/:bracketId
Authorization: Bearer ADMIN_TOKEN
```

**Request Body:**
```json
{
  "name": "Updated Bracket Name",
  "status": "COMPLETED"
}
```

### Delete Bracket

```http
DELETE /api/tournaments/:id/brackets/:bracketId
Authorization: Bearer ADMIN_TOKEN
```

### Complete Bracket Round (with Random Scores)

```http
PATCH /api/tournaments/:id/brackets/:bracketId/rounds/:roundNumber/complete
Authorization: Bearer ADMIN_TOKEN
```

**Path Parameters:**
- `roundNumber`: Integer (1 = finals, 2 = semi-finals, etc.)

**Response:** All matches in round completed with random scores, winners advanced

---

## Matches

### Update Match Status

```http
PATCH /api/tournaments/:id/matches/:matchId/status
Authorization: Bearer ADMIN_TOKEN
```

**Request Body:**
```json
{
  "status": "IN_PROGRESS",
  "targetId": "uuid"
}
```

**Match Status Values:**
- `SCHEDULED`: Match scheduled but not started
- `IN_PROGRESS`: Currently being played
- `COMPLETED`: Match finished
- `CANCELLED`: Match cancelled

**Notes:**
- Setting status to `IN_PROGRESS` assigns match to a target
- Target becomes unavailable while match is in progress
- Changing from `IN_PROGRESS` releases the target

### Complete Match

```http
PATCH /api/tournaments/:id/matches/:matchId/complete
Authorization: Bearer ADMIN_TOKEN
```

**Request Body:**
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

**Notes:**
- Sets match status to `COMPLETED`
- Determines winner based on highest score
- Releases assigned target
- Advances winner in bracket (if applicable)

### Update Match Scores

```http
PATCH /api/tournaments/:id/matches/:matchId/scores
Authorization: Bearer ADMIN_TOKEN
```

**Request Body:** Same as Complete Match

**Notes:**
- Updates scores for an already completed match
- Recalculates winner if scores change
- Does not change match status

---

<a id="validation--errors"></a>
## Validation & Errors

### Error Response Format

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

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (not admin) |
| 404 | Not Found |
| 409 | Conflict (duplicate name, etc.) |
| 422 | Unprocessable Entity (invalid state transition) |
| 500 | Internal Server Error |

### Common Validation Errors

**Invalid UUID:**
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

**Date Validation:**
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

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **General Endpoints**: 100 requests per 15 minutes per IP
- **Authentication Endpoints**: 5 requests per 15 minutes per IP
- **Upload Endpoints**: 10 requests per hour per IP

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1645545600
```

---

## WebSocket Events

Connect to WebSocket server for real-time updates:

```javascript
import io from 'socket.io-client';
const socket = io('http://localhost:3000');
```

### Events

**Match Started:**
```javascript
socket.on('match:started', (data) => {
  // data = { matchId, tournamentId, targetId, players }
});
```

**Match Completed:**
```javascript
socket.on('match:completed', (data) => {
  // data = { matchId, tournamentId, winnerId, scores }
});
```

**Target Status Changed:**
```javascript
socket.on('target:status', (data) => {
  // data = { targetId, status, currentMatchId }
});
```

**Tournament Status Changed:**
```javascript
socket.on('tournament:status', (data) => {
  // data = { tournamentId, status }
});
```

---

## Postman Collection

Import the provided Postman collection for easier API testing:

```bash
# Located at: docs/postman/Darts_Tournament_API.postman_collection.json
```

---

## Additional Resources

- [Authentication Setup](./ADMIN_SETUP.md)
- [Auth0 Email Configuration](./AUTH0_EMAIL_SETUP.md)
- [Commands Reference](./COMMANDS.md)
- [Architecture Documentation](./ARCHITECTURE.md)
- [Frontend Documentation](./FRONTEND.md)
