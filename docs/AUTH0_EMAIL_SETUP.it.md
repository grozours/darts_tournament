# Impostazione richiesta e-mail Auth0

## Problema
Per impostazione predefinita, i token di accesso Auth0 non includono l'attestazione `email`. Ciò fa sì che l'autenticazione dell'amministratore fallisca perché il backend non può verificare l'indirizzo email dell'utente.

## Soluzione: aggiungi l'e-mail al token di accesso utilizzando le azioni Auth0

### Passaggio 1: crea un'azione Auth0

1. Vai alla dashboard di Auth0: https://manage.auth0.com/
2. Vai a **Azioni** → **Flussi** → **Accedi**
3. Fare clic su ****** (Azione personalizzata)
4. Crea una nuova azione con questi dettagli:
- **Nome**: `Add Email to Access Token`
- **Attivazione**: `Login / Post Login`
- **Tempo di esecuzione**: `Node 18` (consigliato)

### Passaggio 2: aggiungi il codice di azione

Sostituisci il codice predefinito con:

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

### Passaggio 3: schierare l'azione

1. Fai clic su **Distribuisci** (in alto a destra)
2. Torna a **Azioni** → **Flussi** → **Accedi**
3. Trascina la nuova azione dalla barra laterale destra al flusso (tra **Inizia** e **Completa**)
4. Fai clic su **Applica**

## Alternativa: utilizzare le regole Auth0 (legacy)

Se utilizzi il vecchio sistema di regole Auth0:

1. Vai a **Auth0 Dashboard** → **Auth Pipeline** → **Regole**
2. Crea una nuova regola: **Aggiungi email al token di accesso**
3. Usa questo codice:

```javascript
function addEmailToAccessToken(user, context, callback) {
  if (user.email) {
    context.accessToken['email'] = user.email;
    context.accessToken['email_verified'] = user.email_verified;
  }
  callback(null, user, context);
}
```

## Passaggio 4: testare la configurazione

### Opzione A: utilizzare lo strumento di test Auth0

1. Nella dashboard Auth0, vai alla tua applicazione
2. Fare clic sulla scheda **Test**
3. Fai clic su **OAuth 2.0 Playground**
4. Ottieni un token di accesso e decodificalo su https://jwt.io
5. Verificare che l'attestazione `email` sia presente

### Opzione B: prova nella tua app

1. **Svuota la cache del browser ed esci**
2. **Accedi di nuovo** per ottenere un nuovo token
3. Controlla la console del browser per lo stato di amministratore
4. Prova a creare un torneo

### Opzione C: test con API Auth0

```bash
# Get your token from browser DevTools → Network → request to /api/auth/me
# Copy Authorization: Bearer <TOKEN>, then decode it:
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq .
```

Dovrebbe mostrare:
```json
{
  "email": "admin@example.com",
  "email_verified": true,
  ...
}
```

## Comandi di verifica

### Controlla i log del backend

```bash
docker logs darts_tournament-backend-1 --tail 50 | grep "Admin Check"
```

Dovrebbe mostrare:
```
[Admin Check] { userEmail: 'admin@example.com', isAdmin: true, configuredAdmins: ['admin@example.com', ...] }
```

### Testare l'endpoint dello stato dell'amministratore

```bash
# Get your token from browser (see above)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/auth/me
```

Dovrebbe restituire:
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

## Risoluzione dei problemi

### Errore: "È richiesto l'accesso come amministratore"

**Causa**: richiesta di posta elettronica mancante dal token di accesso

**Soluzione**:
1. Verificare che l'azione Auth0 sia distribuita e aggiunta al flusso di accesso
2. **Esci completamente** dall'app
3. **Cancella archiviazione locale del browser** (scheda Applicazione → Archiviazione locale → Cancella tutto)
4. **Accedi di nuovo** per ottenere un nuovo token con richiesta via email

### I registri del backend mostrano: "Nessuna email trovata nel token"

**Causa**: Azione Auth0 non applicata o non funzionante

**Soluzione**:
1. Controllare che l'azione Auth0 sia **distribuita** (segno di spunta verde)
2. Controlla che l'azione sia **nel flusso** (visibile nel diagramma di flusso di accesso)
3. Controllare che il codice dell'azione non contenga errori di sintassi
4. Prova a utilizzare jwt.io per decodificare il tuo token e verificare che manchi l'e-mail

### Il controllo dell'amministratore mostra l'e-mail ma èAdmin: false

**Causa**: l'e-mail non corrisponde alle e-mail dell'amministratore configurate

**Soluzione**:
1. Controlla `backend/.env`: `AUTH_ADMIN_EMAILS=admin@example.com`
2. Verifica esattamente le corrispondenze ortografiche (senza distinzione tra maiuscole e minuscole)
3. Riavvia il back-end: `docker-compose restart backend`
4. Controlla che l'e-mail nella vista Account corrisponda esattamente a `.env`

## Note sulla sicurezza

1. **Attestazioni personalizzate**: Auth0 consiglia di utilizzare attestazioni con spazi dei nomi come `https://yourdomain.com/email`, ma per configurazioni semplici, `email` funziona correttamente
2. **Verifica e-mail**: valuta la possibilità di verificare la richiesta `email_verified` prima di concedere l'accesso come amministratore
3. **Scadenza token**: i token di accesso scadono dopo 24 ore per impostazione predefinita, l'utente dovrà autenticarsi nuovamente

## Passaggi successivi

Una volta che l'e-mail è nel token:
1. L'utente può creare tornei
2. L'utente può gestire le impostazioni del torneo
3. L'utente può eliminare i tornei
4. Tutte le operazioni di solo amministratore funzionano correttamente
