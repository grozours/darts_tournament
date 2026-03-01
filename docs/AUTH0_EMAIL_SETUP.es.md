# Configuración de reclamo por correo electrónico Auth0

## Problema
Los tokens de acceso Auth0 no incluyen el reclamo `email` de forma predeterminada. Esto hace que la autenticación del administrador falle porque el backend no puede verificar la dirección de correo electrónico del usuario.

## Solución: Agregar correo electrónico al token de acceso mediante acciones Auth0

### Paso 1: Crear una acción Auth0

1. Vaya a su Panel de Auth0: https://manage.auth0.com/
2. Vaya a **Acciones** → **Flujos** → **Iniciar sesión**
3. Haga clic en **+** (Acción personalizada)
4. Crea una nueva acción con estos detalles:
- **Nombre**: `Add Email to Access Token`
- **Activador**: `Login / Post Login`
- **Tiempo de ejecución**: `Node 18` (recomendado)

### Paso 2: Agregar el código de acción

Reemplace el código predeterminado con:

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

### Paso 3: implementar la acción

1. Haga clic en **Implementar** (arriba a la derecha)
2. Vuelva a **Acciones** → **Flujos** → **Iniciar sesión**
3. Arrastre su nueva acción desde la barra lateral derecha al flujo (entre **Inicio** y **Completado**)
4. Haga clic en **Aplicar**

## Alternativa: usar reglas Auth0 (heredadas)

Si estás utilizando el sistema de reglas Auth0 anterior:

1. Vaya a **Panel de control de Auth0** → **Canalización de autenticación** → **Reglas**
2. Cree una nueva regla: **Agregar correo electrónico al token de acceso**
3. Utilice este código:

```javascript
function addEmailToAccessToken(user, context, callback) {
  if (user.email) {
    context.accessToken['email'] = user.email;
    context.accessToken['email_verified'] = user.email_verified;
  }
  callback(null, user, context);
}
```

## Paso 4: Probar la configuración

### Opción A: utilizar la herramienta de prueba Auth0

1. En el Panel de Auth0, vaya a su Aplicación
2. Haga clic en la pestaña **Prueba**
3. Haga clic en **OAuth 2.0 Playground**
4. Obtenga un token de acceso y decodifíquelo en https://jwt.io
5. Verifique que el reclamo `email` esté presente

### Opción B: Pruebe en su aplicación

1. **Borra la memoria caché de tu navegador y cierra sesión**
2. **Inicia sesión nuevamente** para obtener un token nuevo
3. Verifique la consola del navegador para ver el estado de administrador.
4. Intenta crear un torneo.

### Opción C: Prueba con la API Auth0

```bash
# Get your token from browser DevTools → Network → request to /api/auth/me
# Copy Authorization: Bearer <TOKEN>, then decode it:
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq .
```

Debe mostrar:
```json
{
  "email": "admin@example.com",
  "email_verified": true,
  ...
}
```

## Comandos de verificación

### Verificar registros de backend

```bash
docker logs darts_tournament-backend-1 --tail 50 | grep "Admin Check"
```

Debe mostrar:
```
[Admin Check] { userEmail: 'admin@example.com', isAdmin: true, configuredAdmins: ['admin@example.com', ...] }
```

### Punto final de estado de administrador de prueba

```bash
# Get your token from browser (see above)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/auth/me
```

Debería regresar:
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

## Solución de problemas

### Error: "Se requiere acceso de administrador"

**Causa**: Falta el reclamo de correo electrónico en el token de acceso

**Solución**:
1. Verifique que la acción Auth0 esté implementada y agregada al flujo de inicio de sesión.
2. **Cierra sesión completamente** en tu aplicación
3. **Borrar almacenamiento local del navegador** (pestaña Aplicación → Almacenamiento local → Borrar todo)
4. **Inicie sesión nuevamente** para obtener un nuevo token con reclamo por correo electrónico

### Los registros de backend muestran: "No se encontró ningún correo electrónico en el token"

**Causa**: La acción Auth0 no se aplicó o no funciona

**Solución**:
1. Verifique que la acción Auth0 esté **implementada** (marca de verificación verde)
2. Verifique que la acción esté **en el flujo** (visible en el diagrama de flujo de inicio de sesión)
3. Verifique que el código de acción no tenga errores de sintaxis.
4. Intente usar jwt.io para decodificar su token y verificar que falta el correo electrónico

### La verificación del administrador muestra el correo electrónico pero esAdmin: falso

**Causa**: El correo electrónico no coincide con los correos electrónicos del administrador configurados.

**Solución**:
1. Marque `backend/.env`: `AUTH_ADMIN_EMAILS=admin@example.com`
2. Verifique que la ortografía coincida exactamente (no distingue entre mayúsculas y minúsculas)
3. Reiniciar el servidor: `docker-compose restart backend`
4. Verifique que el correo electrónico en la vista Cuenta coincida exactamente con `.env`

## Notas de seguridad

1. **Reclamaciones personalizadas**: Auth0 recomienda usar notificaciones con espacios de nombres como `https://yourdomain.com/email`, pero para configuraciones simples, `email` funciona bien.
2. **Verificación por correo electrónico**: considere verificar el reclamo `email_verified` antes de otorgar acceso de administrador
3. **Caducidad del token**: los tokens de acceso caducan después de 24 horas de forma predeterminada, el usuario deberá volver a autenticarse

## Próximos pasos

Una vez que el correo electrónico esté en el token:
1. El usuario puede crear torneos.
2. El usuario puede administrar la configuración del torneo.
3. El usuario puede eliminar torneos.
4. Todas las operaciones exclusivas de administrador funcionan correctamente
