# Admin Setup Guide

## Overview
This guide explains how to set up and use the admin system for the Darts Tournament Manager.

## Setting Admin Emails

### 1. Configure Admin Emails in Backend

Edit `backend/.env` and add your Gmail addresses to `AUTH_ADMIN_EMAILS`:

```env
AUTH_ADMIN_EMAILS=your-email@gmail.com,another-admin@gmail.com
```

**Important:**
- Use comma-separated list for multiple admins
- Use the exact email address from Google login (visible in Account view)
- No spaces between emails (they will be trimmed automatically)
- Matching is case-insensitive

### 2. Restart Backend

```bash
docker-compose restart backend
```

### 3. Optional: Development Admin Autologin (without Auth0 callback)

If your Auth0 free tenant cannot whitelist your local frontend URL, you can enable a development-only admin autologin in `backend/.env`:

```env
AUTH_DEV_AUTOLOGIN_ADMIN_EMAIL=your-email@gmail.com
```

How it works:
- Only active when `NODE_ENV=development`
- Only active when no `Authorization: Bearer ...` token is sent
- Injects a local authenticated admin user using the configured email

Important:
- Keep this variable empty in production
- Restart backend after changing `.env`

## Using Admin Features

### Check Admin Status

Any authenticated user can check their admin status:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/auth/me
```

Response:
```json
{
  "user": {
    "id": "google-oauth2|123456789",
    "email": "your-email@gmail.com",
    "name": "Your Name",
    "picture": "https://..."
  },
  "isAdmin": true
}
```

### Frontend Integration

You can fetch admin status in your React components:

```typescript
const checkAdminStatus = async () => {
  const token = await getAccessTokenSilently();
  const response = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  return data.isAdmin;
};
```

### Protecting Routes (Backend)

#### Option 1: Require Admin Middleware

Use `requireAdmin` middleware to protect entire routes:

```typescript
import { requireAuth, requireAdmin } from '../middleware/auth';

// This route requires authentication AND admin status
router.delete('/api/tournaments/:id', requireAuth, requireAdmin, async (req, res) => {
  // Only admins can reach this code
  await deleteTournament(req.params.id);
  res.json({ success: true });
});
```

#### Option 2: Check Admin in Controller

Use `isAdmin()` function for conditional logic:

```typescript
import { isAdmin } from '../middleware/auth';

router.patch('/api/tournaments/:id', requireAuth, async (req, res) => {
  const tournament = await getTournament(req.params.id);
  
  // Allow admins or tournament creator to edit
  if (!isAdmin(req) && tournament.creatorId !== req.auth?.payload?.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Update tournament
  await updateTournament(req.params.id, req.body);
  res.json({ success: true });
});
```

## Protected Endpoints

The following endpoints now require admin access (both `requireAuth` and `requireAdmin` middleware):

### Tournament Management
- **POST /api/tournaments** - Create tournament
- **PUT /api/tournaments/:id** - Update tournament
- **DELETE /api/tournaments/:id** - Delete tournament
- **POST /api/tournaments/:id/logo** - Upload tournament logo

### Player Management
- **DELETE /api/tournaments/:id/register/:playerId** - Unregister player
- **DELETE /api/tournaments/:id/players/:playerId** - Remove player from tournament

### Pool Stages
- **POST /api/tournaments/:id/pool-stages** - Create pool stage
- **PATCH /api/tournaments/:id/pool-stages/:stageId** - Update pool stage
- **POST /api/tournaments/:id/pool-stages/:stageId/complete** - Complete pool stage with scores
- **DELETE /api/tournaments/:id/pool-stages/:stageId** - Delete pool stage

### Brackets
- **POST /api/tournaments/:id/brackets** - Create bracket
- **PATCH /api/tournaments/:id/brackets/:bracketId** - Update bracket
- **DELETE /api/tournaments/:id/brackets/:bracketId** - Delete bracket
- **PATCH /api/tournaments/:id/brackets/:bracketId/rounds/:roundNumber/complete** - Complete bracket round

### Match Management
- **PATCH /api/tournaments/:id/matches/:matchId/status** - Update match status
- **PATCH /api/tournaments/:id/matches/:matchId/complete** - Complete match with scores
- **PATCH /api/tournaments/:id/matches/:matchId/scores** - Update match scores

### Tournament Status
- **PATCH /api/tournaments/:id/status** - Update tournament status
- **POST /api/tournaments/:id/open-registration** - Open tournament registration
- **POST /api/tournaments/:id/start** - Start tournament
- **POST /api/tournaments/:id/complete** - Complete tournament

### Public Endpoints (No Auth Required)
- **GET /api/tournaments** - List tournaments
- **GET /api/tournaments/:id** - Get tournament details
- **POST /api/tournaments/:id/players** - Register as player (anyone can register)
- **PATCH /api/tournaments/:id/players/:playerId** - Update own player details
- **PATCH /api/tournaments/:id/players/:playerId/check-in** - Check in for tournament

## Example: Admin-Only Tournament Deletion

Here's a complete example of protecting the tournament deletion endpoint:

### Backend Route (already implemented)

```typescript
// backend/src/routes/tournaments.ts
import { requireAuth, requireAdmin } from '../middleware/auth';

router.delete(
  '/:id',
  requireAuth,      // Must be authenticated
  requireAdmin,     // Must be admin
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await tournamentController.deleteTournament(req, res);
    } catch (error) {
      next(error);
    }
  }
);
```

### Frontend Component

```typescript
const deleteTournament = async (id: string) => {
  try {
    const token = await getAccessTokenSilently();
    const response = await fetch(`/api/tournaments/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.status === 403) {
      alert('Admin access required');
      return;
    }
    
    if (!response.ok) throw new Error('Delete failed');
    // Success
  } catch (err) {
    console.error('Delete error:', err);
  }
};
```

## Admin Status API

### GET /api/auth/me

Returns current user info and admin status.

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "user": {
    "id": "google-oauth2|123456789",
    "email": "user@gmail.com",
    "name": "User Name",
    "picture": "https://..."
  },
  "isAdmin": true
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Server error

## Security Notes

1. **Email Verification**: Admin emails are matched against the `email` claim in the Auth0 JWT
2. **Case Insensitive**: Email matching is case-insensitive
3. **No Database**: Admin list is stored in environment variables (no database dependency)
4. **JWT Required**: Admin checks require valid JWT tokens with email claim
5. **Audience Required**: Frontend must be configured with `VITE_AUTH0_AUDIENCE` to receive proper JWT tokens

## Troubleshooting

### "Admin access required" error

**Problem**: User is authenticated but not recognized as admin

**Solutions:**
1. Check that email in `AUTH_ADMIN_EMAILS` matches exactly with login email
2. Verify backend restarted after `.env` change
3. Check JWT contains email claim: `curl -H "Authorization: Bearer TOKEN" /api/auth/me`
4. Ensure `VITE_AUTH0_AUDIENCE` is set in frontend `.env`

### Admin status not working

**Check environment:**
```bash
docker exec darts_tournament-backend-1 printenv | grep AUTH_ADMIN_EMAILS
```

Should output:
```
AUTH_ADMIN_EMAILS=your-email@gmail.com,another-admin@gmail.com
```

### Test admin endpoint

```bash
# Get your token from browser DevTools (Application > Local Storage > @@auth0spajs@@...)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/auth/me
```

### Live views refresh tuning (optional)

To reduce read load for anonymous/player users while keeping admin updates more reactive, configure frontend polling intervals in `frontend/.env`:

```env
VITE_LIVE_REFRESH_INTERVAL_ADMIN_MS=10000
VITE_LIVE_REFRESH_INTERVAL_VIEWER_MS=60000
VITE_TARGETS_REFRESH_INTERVAL_ADMIN_MS=10000
VITE_TARGETS_REFRESH_INTERVAL_VIEWER_MS=60000
```

Notes:
- `VIEWER` applies to anonymous and player accounts.
- Minimum accepted value is `5000`; invalid values automatically fall back to defaults.

## Next Steps

1. Add admin-only UI components (e.g., admin panel, advanced settings)
2. Create admin badge in navigation bar
3. Hide/show admin-only features in frontend based on admin status
4. Add audit logging for admin actions
