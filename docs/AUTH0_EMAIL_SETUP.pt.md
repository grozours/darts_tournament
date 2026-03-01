# Configuração de reivindicação de e-mail Auth0

## Problema
Os tokens de acesso Auth0 não incluem a declaração `email` por padrão. Isso faz com que a autenticação do administrador falhe porque o back-end não consegue verificar o endereço de e-mail do usuário.

## Solução: Adicionar e-mail ao token de acesso usando ações Auth0

### Etapa 1: Crie uma ação Auth0

1. Vá para o painel Auth0: https://manage.auth0.com/
2. Navegue até **Ações** → **Fluxos** → **Login**
3. Clique em **+** (Ação personalizada)
4. Crie uma nova ação com estes detalhes:
- **Nome**: `Add Email to Access Token`
- **Gatilho**: `Login / Post Login`
- **Tempo de execução**: `Node 18` (recomendado)

### Etapa 2: Adicione o código de ação

Substitua o código padrão por:

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

### Etapa 3: Implantar a ação

1. Clique em **Implantar** (canto superior direito)
2. Volte para **Ações** → **Fluxos** → **Login**
3. Arraste sua nova ação da barra lateral direita para o fluxo (entre **Iniciar** e **Concluir**)
4. Clique em **Aplicar**

## Alternativa: usar regras Auth0 (legado)

Se você estiver usando o sistema antigo de regras Auth0:

1. Vá para **Painel Auth0** → **Pipeline de autenticação** → **Regras**
2. Crie uma nova regra: **Adicionar e-mail ao token de acesso**
3. Use este código:

```javascript
function addEmailToAccessToken(user, context, callback) {
  if (user.email) {
    context.accessToken['email'] = user.email;
    context.accessToken['email_verified'] = user.email_verified;
  }
  callback(null, user, context);
}
```

## Etapa 4: teste a configuração

### Opção A: Use a ferramenta de teste Auth0

1. No Auth0 Dashboard, vá para seu aplicativo
2. Clique na guia **Teste**
3. Clique em **OAuth 2.0 Playground**
4. Obtenha um token de acesso e decodifique-o em https://jwt.io
5. Verifique se a reivindicação `email` está presente

### Opção B: teste em seu aplicativo

1. **Limpe o cache do navegador e saia**
2. **Faça login novamente** para obter um novo token
3. Verifique o status do administrador no console do navegador
4. Experimente criar um torneio

### Opção C: Teste com API Auth0

```bash
# Get your token from browser DevTools → Network → request to /api/auth/me
# Copy Authorization: Bearer <TOKEN>, then decode it:
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq .
```

Deve mostrar:
```json
{
  "email": "admin@example.com",
  "email_verified": true,
  ...
}
```

## Comandos de verificação

### Verifique os registros de back-end

```bash
docker logs darts_tournament-backend-1 --tail 50 | grep "Admin Check"
```

Deve mostrar:
```
[Admin Check] { userEmail: 'admin@example.com', isAdmin: true, configuredAdmins: ['admin@example.com', ...] }
```

### Testar endpoint de status de administrador

```bash
# Get your token from browser (see above)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/auth/me
```

Deve retornar:
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

## Solução de problemas

### Erro: "Acesso de administrador necessário"

**Causa**: reivindicação de e-mail ausente no token de acesso

**Solução**:
1. Verifique se a ação Auth0 está implantada e adicionada ao fluxo de login
2. **Sair completamente** do seu aplicativo
3. **Limpar armazenamento local do navegador** (guia Aplicativo → Armazenamento local → Limpar tudo)
4. **Faça login novamente** para obter um novo token com reivindicação por e-mail

### Os logs de back-end mostram: "Nenhum e-mail encontrado no token"

**Causa**: Ação Auth0 não aplicada ou não funcionando

**Solução**:
1. Verifique se a ação Auth0 está **implantada** (marca de seleção verde)
2. Verifique se a ação está **no fluxo** (visível no diagrama de fluxo de login)
3. Verifique se o código da ação não contém erros de sintaxe
4. Tente usar jwt.io para decodificar seu token e verificar se o e-mail está faltando

### A verificação do administrador mostra email, mas isAdmin: false

**Causa**: o e-mail não corresponde aos e-mails do administrador configurados

**Solução**:
1. Verifique `backend/.env`: `AUTH_ADMIN_EMAILS=admin@example.com`
2. Verifique se a ortografia corresponde exatamente (sem distinção entre maiúsculas e minúsculas)
3. Reinicie o back-end: `docker-compose restart backend`
4. Verifique se o e-mail na visualização da conta corresponde exatamente a `.env`

## Notas de segurança

1. **Declarações personalizadas**: Auth0 recomenda o uso de declarações com namespace como `https://yourdomain.com/email`, mas para configurações simples, `email` funciona bem
2. **Verificação de e-mail**: considere verificar a reivindicação `email_verified` antes de conceder acesso de administrador
3. **Expiração do token**: Os tokens de acesso expiram após 24 horas por padrão, o usuário precisará autenticar novamente

## Próximas etapas

Assim que o e-mail estiver no token:
1. O usuário pode criar torneios
2. O usuário pode gerenciar as configurações do torneio
3. O usuário pode excluir torneios
4. Todas as operações somente de administrador funcionam corretamente
