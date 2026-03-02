# Guide de configuration Admin

## Vue d’ensemble
Ce guide explique comment configurer et utiliser le système admin du Gestionnaire de Tournois de Fléchettes.

## Configuration des emails admin

### 1. Configurer les emails admin côté backend

Éditez `backend/.env` et ajoutez vos adresses Gmail dans `AUTH_ADMIN_EMAILS` :

```env
AUTH_ADMIN_EMAILS=your-email@gmail.com,another-admin@gmail.com
```

**Important :**
- Utiliser une liste séparée par des virgules
- Utiliser l’email exact du login Google (visible dans Account)
- Pas d’espace entre les emails (ils seront trim)
- La correspondance est insensible à la casse

### 2. Redémarrer le backend

```bash
docker-compose restart backend
```

### 3. Optionnel : autologin admin en développement (sans callback Auth0)

Si votre tenant Auth0 gratuit ne peut pas autoriser votre URL frontend locale, vous pouvez activer un autologin admin uniquement en développement dans `backend/.env` :

```env
AUTH_DEV_AUTOLOGIN_ADMIN_EMAIL=your-email@gmail.com
```

Fonctionnement :
- Actif uniquement si `NODE_ENV=development`
- Actif uniquement si aucun header `Authorization: Bearer ...` n’est envoyé
- Injecte un utilisateur local authentifié avec rôle admin via l’email configuré

Important :
- Laisser cette variable vide en production
- Redémarrer le backend après modification du `.env`

## Utiliser les fonctionnalités admin

### Vérifier le statut admin

Tout utilisateur authentifié peut vérifier son statut admin :

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/auth/me
```

Réponse :
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

### Intégration frontend

Vous pouvez récupérer le statut admin dans vos composants React :

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

### Protéger des routes (backend)

#### Option 1 : Middleware admin obligatoire

Utiliser `requireAdmin` pour protéger une route entière :

```typescript
import { requireAuth, requireAdmin } from '../middleware/auth';

// Cette route requiert auth + admin
router.delete('/api/tournaments/:id', requireAuth, requireAdmin, async (req, res) => {
  // Seuls les admins peuvent atteindre ce code
  await deleteTournament(req.params.id);
  res.json({ success: true });
});
```

#### Option 2 : Vérifier admin dans le controller

Utiliser `isAdmin()` pour une logique conditionnelle :

```typescript
import { isAdmin } from '../middleware/auth';

router.patch('/api/tournaments/:id', requireAuth, async (req, res) => {
  const tournament = await getTournament(req.params.id);
  
  // Autoriser admin ou créateur du tournoi
  if (!isAdmin(req) && tournament.creatorId !== req.auth?.payload?.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Mettre à jour le tournoi
  await updateTournament(req.params.id, req.body);
  res.json({ success: true });
});
```

## Endpoints protégés

Les endpoints suivants requièrent admin (`requireAuth` + `requireAdmin`) :

### Gestion de tournoi
- **POST /api/tournaments** - Créer un tournoi
- **PUT /api/tournaments/:id** - Mettre à jour un tournoi
- **DELETE /api/tournaments/:id** - Supprimer un tournoi
- **POST /api/tournaments/:id/logo** - Téléverser un logo

### Gestion des joueurs
- **DELETE /api/tournaments/:id/register/:playerId** - Désinscrire un joueur
- **DELETE /api/tournaments/:id/players/:playerId** - Retirer un joueur

### Phases de poules
- **POST /api/tournaments/:id/pool-stages** - Créer une phase
- **PATCH /api/tournaments/:id/pool-stages/:stageId** - Mettre à jour une phase
- **POST /api/tournaments/:id/pool-stages/:stageId/complete** - Terminer une phase
- **DELETE /api/tournaments/:id/pool-stages/:stageId** - Supprimer une phase

### Tableaux
- **POST /api/tournaments/:id/brackets** - Créer un tableau
- **PATCH /api/tournaments/:id/brackets/:bracketId** - Mettre à jour un tableau
- **DELETE /api/tournaments/:id/brackets/:bracketId** - Supprimer un tableau
- **PATCH /api/tournaments/:id/brackets/:bracketId/rounds/:roundNumber/complete** - Terminer un tour

### Gestion des matchs
- **PATCH /api/tournaments/:id/matches/:matchId/status** - Mettre à jour le statut
- **PATCH /api/tournaments/:id/matches/:matchId/complete** - Terminer un match
- **PATCH /api/tournaments/:id/matches/:matchId/scores** - Mettre à jour les scores

### Statut du tournoi
- **PATCH /api/tournaments/:id/status** - Mettre à jour le statut
- **POST /api/tournaments/:id/open-registration** - Ouvrir les inscriptions
- **POST /api/tournaments/:id/start** - Démarrer le tournoi
- **POST /api/tournaments/:id/complete** - Terminer le tournoi

### Endpoints publics (sans auth)
- **GET /api/tournaments** - Lister les tournois
- **GET /api/tournaments/:id** - Détails d’un tournoi
- **POST /api/tournaments/:id/players** - Inscription (publique)
- **PATCH /api/tournaments/:id/players/:playerId** - Mettre à jour son joueur
- **PATCH /api/tournaments/:id/players/:playerId/check-in** - Check-in

## Exemple : suppression admin d’un tournoi

### Route backend (déjà implémentée)

```typescript
// backend/src/routes/tournaments.ts
import { requireAuth, requireAdmin } from '../middleware/auth';

router.delete(
  '/:id',
  requireAuth,      // Auth requise
  requireAdmin,     // Admin requis
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await tournamentController.deleteTournament(req, res);
    } catch (error) {
      next(error);
    }
  }
);
```

### Composant frontend

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
    // Succès
  } catch (err) {
    console.error('Delete error:', err);
  }
};
```

## API statut admin

### GET /api/auth/me

Retourne l’utilisateur courant et le statut admin.

**Authentification :** requise (Bearer token)

**Réponse :**
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

**Codes de statut :**
- `200 OK` - Succès
- `401 Unauthorized` - Non authentifié
- `500 Internal Server Error` - Erreur serveur

## Notes de sécurité

1. **Vérification email** : email comparé avec le claim `email` du JWT
2. **Insensible à la casse** : matching case-insensitive
3. **Pas de DB** : liste admin dans variables d’environnement
4. **JWT requis** : tokens valides avec claim email
5. **Audience requise** : `VITE_AUTH0_AUDIENCE` doit être défini

## Dépannage

### Erreur "Admin access required"

**Problème** : utilisateur authentifié mais non admin

**Solutions :**
1. Vérifier que l’email dans `AUTH_ADMIN_EMAILS` correspond exactement
2. Redémarrer backend après modification de `.env`
3. Vérifier le JWT : `curl -H "Authorization: Bearer TOKEN" /api/auth/me`
4. Vérifier `VITE_AUTH0_AUDIENCE` dans frontend `.env`

### Statut admin ne fonctionne pas

**Vérifier l’environnement :**
```bash
docker exec darts_tournament-backend-1 printenv | grep AUTH_ADMIN_EMAILS
```

Doit afficher :
```
AUTH_ADMIN_EMAILS=your-email@gmail.com,another-admin@gmail.com
```

### Tester l’endpoint admin

```bash
# Récupérer le token depuis le navigateur (DevTools)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/auth/me
```

### Ajuster le refresh des vues live (optionnel)

Pour réduire la charge de lecture côté comptes anonymes/joueurs tout en gardant un rafraîchissement rapide pour les admins, configure les intervalles de polling dans `frontend/.env` :

```env
VITE_LIVE_REFRESH_INTERVAL_ADMIN_MS=10000
VITE_LIVE_REFRESH_INTERVAL_VIEWER_MS=60000
VITE_TARGETS_REFRESH_INTERVAL_ADMIN_MS=10000
VITE_TARGETS_REFRESH_INTERVAL_VIEWER_MS=60000
```

Notes :
- `VIEWER` s’applique aux comptes anonymes et joueurs.
- Valeur minimale acceptée : `5000` ; une valeur invalide revient automatiquement aux défauts.

## Prochaines étapes

1. Ajouter des composants UI admin-only
2. Ajouter un badge admin dans la navigation
3. Masquer/afficher les fonctionnalités admin selon le statut
4. Ajouter des logs d’audit pour les actions admin
