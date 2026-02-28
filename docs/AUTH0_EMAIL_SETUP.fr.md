# Configuration du claim email Auth0

## Problème
Les access tokens Auth0 n’incluent pas le claim `email` par défaut. Cela fait échouer l’authentification admin car le backend ne peut pas vérifier l’email.

## Solution : ajouter l’email au token via Auth0 Actions

### Étape 1 : créer une Action Auth0

1. Aller sur le dashboard Auth0 : https://manage.auth0.com/
2. Aller dans **Actions** → **Flows** → **Login**
3. Cliquer sur **+** (Custom Action)
4. Créer une action :
   - **Name** : `Add Email to Access Token`
   - **Trigger** : `Login / Post Login`
   - **Runtime** : `Node 18` (recommandé)

### Étape 2 : ajouter le code de l’action

Remplacer le code par :

```javascript
/**
* Handler that will be called during the execution of a PostLogin flow.
*
* @param {Event} event - Details about the user and the context in which they are logging in.
* @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
*/
exports.onExecutePostLogin = async (event, api) => {
  // Only add email to access token if email exists
  if (event.user.email) {
    api.accessToken.setCustomClaim('email', event.user.email);
    
    // Also add email_verified for extra security (optional)
    api.accessToken.setCustomClaim('email_verified', event.user.email_verified);
  }
};
```

### Étape 3 : déployer l’action

1. Cliquer **Deploy** (en haut à droite)
2. Retourner dans **Actions** → **Flows** → **Login**
3. Glisser l’action dans le flow (entre **Start** et **Complete**)
4. Cliquer **Apply**

## Alternative : Auth0 Rules (legacy)

Si vous utilisez l’ancien système Rules :

1. Aller dans **Auth0 Dashboard** → **Auth Pipeline** → **Rules**
2. Créer une règle : **Add Email to Access Token**
3. Utiliser ce code :

```javascript
function addEmailToAccessToken(user, context, callback) {
  if (user.email) {
    context.accessToken['email'] = user.email;
    context.accessToken['email_verified'] = user.email_verified;
  }
  callback(null, user, context);
}
```

## Étape 4 : tester la configuration

### Option A : outil de test Auth0

1. Dans Auth0, ouvrir votre Application
2. Cliquer l’onglet **Test**
3. Cliquer **OAuth 2.0 Playground**
4. Obtenir un access token et le décoder sur https://jwt.io
5. Vérifier que le claim `email` est présent

### Option B : tester dans l’app

1. **Vider le cache navigateur et se déconnecter**
2. **Se reconnecter** pour obtenir un nouveau token
3. Vérifier le statut admin dans la console
4. Essayer de créer un tournoi

### Option C : tester via API Auth0

```bash
# Récupérer le token depuis DevTools → Network → requête /api/auth/me
# Copier Authorization: Bearer <TOKEN>, puis le décoder :
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq .
```

Doit afficher :
```json
{
  "email": "tangi.curet@gmail.com",
  "email_verified": true,
  ...
}
```

## Commandes de vérification

### Vérifier les logs backend

```bash
docker logs darts_tournament-backend-1 --tail 50 | grep "Admin Check"
```

Doit afficher :
```
[Admin Check] { userEmail: 'tangi.curet@gmail.com', isAdmin: true, configuredAdmins: ['tangi.curet@gmail.com', ...] }
```

### Tester l’endpoint admin

```bash
# Récupérer le token depuis le navigateur
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/auth/me
```

Doit retourner :
```json
{
  "user": {
    "id": "google-oauth2|...",
    "email": "tangi.curet@gmail.com",
    ...
  },
  "isAdmin": true
}
```

## Dépannage

### Erreur : "Admin access required"

**Cause** : claim email manquant dans l’access token

**Solution :**
1. Vérifier que l’action Auth0 est déployée et ajoutée au flow Login
2. **Se déconnecter totalement** de l’app
3. **Vider le Local Storage** (Application → Local Storage → Clear All)
4. **Se reconnecter** pour obtenir un token avec email

### Logs backend : "No email found in token"

**Cause** : action Auth0 non appliquée ou en erreur

**Solution :**
1. Vérifier l’action déployée (check vert)
2. Vérifier l’action dans le flow
3. Vérifier qu’il n’y a pas d’erreur de syntaxe
4. Décoder le token via jwt.io pour voir si email manque

### Admin check : email présent mais isAdmin=false

**Cause** : email ne correspond pas aux admins configurés

**Solution :**
1. Vérifier `backend/.env` : `AUTH_ADMIN_EMAILS=tangi.curet@gmail.com`
2. Vérifier l’orthographe (insensible à la casse)
3. Redémarrer le backend : `docker-compose restart backend`
4. Vérifier l’email dans la vue Account

## Notes de sécurité

1. **Custom claims** : Auth0 recommande des claims namespaced (`https://yourdomain.com/email`), mais `email` fonctionne
2. **Email vérifié** : vérifier `email_verified` avant d’accorder l’admin
3. **Expiration token** : les tokens expirent après 24h, re-auth nécessaire

## Prochaines étapes

Une fois l’email dans le token :
1. L’utilisateur peut créer des tournois
2. L’utilisateur peut gérer les réglages
3. L’utilisateur peut supprimer des tournois
4. Toutes les opérations admin fonctionnent
