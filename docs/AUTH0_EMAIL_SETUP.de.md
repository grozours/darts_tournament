# Auth0-E-Mail-Anspruchseinrichtung

## Problem
Auth0-Zugriffstoken enthalten standardmäßig nicht den Anspruch `email`. Dies führt dazu, dass die Administratorauthentifizierung fehlschlägt, da das Backend die E-Mail-Adresse des Benutzers nicht überprüfen kann.

## Lösung: E-Mail zum Zugriffstoken mithilfe von Auth0-Aktionen hinzufügen

### Schritt 1: Erstellen Sie eine Auth0-Aktion

1. Gehen Sie zu Ihrem Auth0-Dashboard: https://manage.auth0.com/
2. Navigieren Sie zu **Aktionen** → **Flows** → **Anmelden**
3. Klicken Sie auf ***** (Benutzerdefinierte Aktion)
4. Erstellen Sie eine neue Aktion mit diesen Details:
- **Name**: `Add Email to Access Token`
- **Auslöser**: `Login / Post Login`
- **Laufzeit**: `Node 18` (empfohlen)

### Schritt 2: Fügen Sie den Aktionscode hinzu

Ersetzen Sie den Standardcode durch:

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

### Schritt 3: Bereitstellen der Aktion

1. Klicken Sie auf **Bereitstellen** (oben rechts).
2. Gehen Sie zurück zu **Aktionen** → **Flows** → **Anmelden**
3. Ziehen Sie Ihre neue Aktion aus der rechten Seitenleiste in den Flow (zwischen **Start** und **Abschließen**).
4. Klicken Sie auf **Übernehmen**

## Alternative: Auth0-Regeln verwenden (Legacy)

Wenn Sie das ältere Auth0-Regelsystem verwenden:

1. Gehen Sie zu **Auth0-Dashboard** → **Auth-Pipeline** → **Regeln**
2. Erstellen Sie eine neue Regel: **E-Mail zum Zugriffstoken hinzufügen**
3. Verwenden Sie diesen Code:

```javascript
function addEmailToAccessToken(user, context, callback) {
  if (user.email) {
    context.accessToken['email'] = user.email;
    context.accessToken['email_verified'] = user.email_verified;
  }
  callback(null, user, context);
}
```

## Schritt 4: Testen Sie die Konfiguration

### Option A: Verwenden Sie das Auth0-Testtool

1. Gehen Sie im Auth0-Dashboard zu Ihrer Anwendung
2. Klicken Sie auf die Registerkarte **Test**
3. Klicken Sie auf **OAuth 2.0 Playground**
4. Holen Sie sich ein Zugriffstoken und entschlüsseln Sie es unter https://jwt.io
5. Stellen Sie sicher, dass der Anspruch `email` vorhanden ist

### Option B: Testen Sie in Ihrer App

1. **Leeren Sie Ihren Browser-Cache und melden Sie sich ab**
2. **Melden Sie sich erneut an**, um ein neues Token zu erhalten
3. Überprüfen Sie die Browserkonsole auf den Administratorstatus
4. Versuchen Sie, ein Turnier zu erstellen

### Option C: Testen Sie mit der Auth0-API

```bash
# Get your token from browser DevTools → Network → request to /api/auth/me
# Copy Authorization: Bearer <TOKEN>, then decode it:
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq .
```

Sollte zeigen:
```json
{
  "email": "admin@example.com",
  "email_verified": true,
  ...
}
```

## Verifizierungsbefehle

### Überprüfen Sie die Backend-Protokolle

```bash
docker logs darts_tournament-backend-1 --tail 50 | grep "Admin Check"
```

Sollte zeigen:
```
[Admin Check] { userEmail: 'admin@example.com', isAdmin: true, configuredAdmins: ['admin@example.com', ...] }
```

### Admin-Status-Endpunkt testen

```bash
# Get your token from browser (see above)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/auth/me
```

Sollte zurückkommen:
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

## Fehlerbehebung

### Fehler: „Administratorzugriff erforderlich“

**Ursache**: E-Mail-Anspruch fehlt im Zugriffstoken

**Lösung**:
1. Überprüfen Sie, ob die Auth0-Aktion bereitgestellt und zum Anmeldefluss hinzugefügt wurde
2. **Vollständig abmelden** von Ihrer App
3. **Lokalen Browserspeicher löschen** (Registerkarte „Anwendung“ → „Lokaler Speicher“ → „Alle löschen“)
4. **Erneut anmelden**, um ein neues Token mit E-Mail-Anspruch zu erhalten

### Backend-Protokolle zeigen: „Keine E-Mail im Token gefunden“

**Ursache**: Auth0-Aktion wurde nicht angewendet oder funktioniert nicht

**Lösung**:
1. Überprüfen Sie, ob die Auth0-Aktion **bereitgestellt** ist (grünes Häkchen).
2. Überprüfen Sie, ob sich die Aktion **im Ablauf** befindet (sichtbar im Anmeldeablaufdiagramm).
3. Überprüfen Sie, ob der Aktionscode keine Syntaxfehler aufweist
4. Versuchen Sie, jwt.io zu verwenden, um Ihr Token zu entschlüsseln und zu überprüfen, ob die E-Mail fehlt

### Admin-Überprüfung zeigt E-Mail an, aber isAdmin: false

**Ursache**: E-Mail stimmt nicht mit den konfigurierten Administrator-E-Mails überein

**Lösung**:
1. Überprüfen Sie `backend/.env`: `AUTH_ADMIN_EMAILS=admin@example.com`
2. Überprüfen Sie, ob die Rechtschreibung genau übereinstimmt (ohne Berücksichtigung der Groß- und Kleinschreibung).
3. Backend neu starten: `docker-compose restart backend`
4. Überprüfen Sie, ob die E-Mail in der Kontoansicht genau mit `.env` übereinstimmt

## Sicherheitshinweise

1. **Benutzerdefinierte Ansprüche**: Auth0 empfiehlt die Verwendung von Namespace-Ansprüchen wie `https://yourdomain.com/email`, aber für einfache Setups funktioniert `email` gut
2. **E-Mail-Bestätigung**: Erwägen Sie, den Anspruch `email_verified` zu prüfen, bevor Sie Administratorzugriff gewähren
3. **Token-Ablauf**: Zugriffstokens laufen standardmäßig nach 24 Stunden ab, der Benutzer muss sich erneut authentifizieren

## Nächste Schritte

Sobald sich die E-Mail im Token befindet:
1. Der Benutzer kann Turniere erstellen
2. Der Benutzer kann Turniereinstellungen verwalten
3. Der Benutzer kann Turniere löschen
4. Alle Nur-Administrator-Vorgänge funktionieren ordnungsgemäß
