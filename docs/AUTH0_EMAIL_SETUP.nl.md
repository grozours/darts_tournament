# Auth0 e-mailclaim configureren

## Probleem
Auth0-toegangstokens bevatten standaard niet de claim `email`. Hierdoor mislukt de beheerdersverificatie omdat de backend het e-mailadres van de gebruiker niet kan verifiëren.

## Oplossing: voeg e-mail toe aan toegangstoken met behulp van Auth0-acties

### Stap 1: Maak een Auth0-actie

1. Ga naar uw Auth0-dashboard: https://manage.auth0.com/
2. Navigeer naar **Acties** → **Flows** → **Inloggen**
3. Klik op **+** (Aangepaste actie)
4. Maak een nieuwe actie met deze details:
- **Naam**: `Add Email to Access Token`
- **Trigger**: `Login / Post Login`
- **Runtime**: `Node 18` (aanbevolen)

### Stap 2: Voeg de actiecode toe

Vervang de standaardcode door:

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

### Stap 3: Implementeer de actie

1. Klik op **Implementeren** (rechtsboven)
2. Ga terug naar **Acties** → **Flows** → **Inloggen**
3. Sleep je nieuwe actie van de rechterzijbalk naar de stroom (tussen **Start** en **Voltooid**)
4. Klik op **Toepassen**

## Alternatief: gebruik Auth0-regels (verouderd)

Als u het oudere Auth0 Rules-systeem gebruikt:

1. Ga naar **Auth0 Dashboard** → **Auth Pipeline** → **Regels**
2. Maak een nieuwe regel: **E-mail toevoegen aan toegangstoken**
3. Gebruik deze code:

```javascript
function addEmailToAccessToken(user, context, callback) {
  if (user.email) {
    context.accessToken['email'] = user.email;
    context.accessToken['email_verified'] = user.email_verified;
  }
  callback(null, user, context);
}
```

## Stap 4: Test de configuratie

### Optie A: Gebruik de Auth0-testtool

1. Ga in Auth0 Dashboard naar uw applicatie
2. Klik op het tabblad **Test**
3. Klik op **OAuth 2.0 Speeltuin**
4. Verkrijg een toegangstoken en decodeer deze op https://jwt.io
5. Controleer of de claim `email` aanwezig is

### Optie B: Test in uw app

1. **Wis uw browsercache en log uit**
2. **Log opnieuw in** om een ​​nieuw token te krijgen
3. Controleer de browserconsole op beheerdersstatus
4. Probeer een toernooi te maken

### Optie C: Testen met Auth0 API

```bash
# Get your token from browser DevTools → Network → request to /api/auth/me
# Copy Authorization: Bearer <TOKEN>, then decode it:
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq .
```

Moet weergeven:
```json
{
  "email": "admin@example.com",
  "email_verified": true,
  ...
}
```

## Verificatieopdrachten

### Controleer backendlogboeken

```bash
docker logs darts_tournament-backend-1 --tail 50 | grep "Admin Check"
```

Moet weergeven:
```
[Admin Check] { userEmail: 'admin@example.com', isAdmin: true, configuredAdmins: ['admin@example.com', ...] }
```

### Eindpunt beheerdersstatus testen

```bash
# Get your token from browser (see above)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/auth/me
```

Moet terugkeren:
```json
{
  "user": {
    "id": "google-oauth2|...",
    "email": "admin@example.com",
    ...
  },
  "isAdmin": true
}
```

## Problemen oplossen

### Fout: "Beheerdertoegang vereist"

**Oorzaak**: e-mailclaim ontbreekt in toegangstoken

**Oplossing**:
1. Controleer of de Auth0-actie is geïmplementeerd en toegevoegd aan de inlogstroom
2. **Meld u volledig af** bij uw app
3. **Browser lokale opslag wissen** (tabblad Applicatie → Lokale opslag → Alles wissen)
4. **Meld u opnieuw aan** om een ​​nieuw token met e-mailclaim te ontvangen

### Backend-logboeken tonen: "Geen e-mailadres gevonden in token"

**Oorzaak**: Auth0-actie niet toegepast of werkt niet

**Oplossing**:
1. Controleer of Auth0 Actie is **geïmplementeerd** (groen vinkje)
2. Controleer of de actie **in de stroom** zit (zichtbaar in het inlogstroomdiagram)
3. Controleer of de actiecode geen syntaxisfouten bevat
4. Probeer jwt.io te gebruiken om uw token te decoderen en te controleren of de e-mail ontbreekt

### Beheerderscontrole toont e-mail, maar isAdmin: false

**Oorzaak**: E-mail komt niet overeen met geconfigureerde beheerders-e-mailadressen

**Oplossing**:
1. Controleer `backend/.env`: `AUTH_ADMIN_EMAILS=admin@example.com`
2. Controleer of de spelling exact overeenkomt (niet hoofdlettergevoelig)
3. Start de backend opnieuw: `docker-compose restart backend`
4. Controleer of de e-mail in de accountweergave exact overeenkomt met `.env`

## Beveiligingsopmerkingen

1. **Aangepaste claims**: Auth0 raadt aan om naamruimteclaims zoals `https://yourdomain.com/email` te gebruiken, maar voor eenvoudige instellingen werkt `email` prima
2. **E-mailverificatie**: controleer de claim `email_verified` voordat u beheerderstoegang verleent
3. **Token vervalt**: Toegangstokens verlopen standaard na 24 uur, de gebruiker moet zich opnieuw authenticeren

## Volgende stappen

Zodra e-mail in het token zit:
1. De gebruiker kan toernooien maken
2. De gebruiker kan toernooi-instellingen beheren
3. De gebruiker kan toernooien verwijderen
4. Alle bewerkingen die alleen voor beheerders gelden, werken correct
