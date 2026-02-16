# Auth0 Email Claim Setup

## Problem
Auth0 access tokens don't include the `email` claim by default. This causes admin authentication to fail because the backend can't verify the user's email address.

## Solution: Add Email to Access Token using Auth0 Actions

### Step 1: Create an Auth0 Action

1. Go to your Auth0 Dashboard: https://manage.auth0.com/
2. Navigate to **Actions** → **Flows** → **Login**
3. Click **+** (Custom Action)
4. Create a new action with these details:
   - **Name**: `Add Email to Access Token`
   - **Trigger**: `Login / Post Login`
   - **Runtime**: `Node 18` (Recommended)

### Step 2: Add the Action Code

Replace the default code with:

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

### Step 3: Deploy the Action

1. Click **Deploy** (top right)
2. Go back to **Actions** → **Flows** → **Login**
3. Drag your new action from the right sidebar to the flow (between **Start** and **Complete**)
4. Click **Apply**

## Alternative: Use Auth0 Rules (Legacy)

If you're using the older Auth0 Rules system:

1. Go to **Auth0 Dashboard** → **Auth Pipeline** → **Rules**
2. Create a new rule: **Add Email to Access Token**
3. Use this code:

```javascript
function addEmailToAccessToken(user, context, callback) {
  if (user.email) {
    context.accessToken['email'] = user.email;
    context.accessToken['email_verified'] = user.email_verified;
  }
  callback(null, user, context);
}
```

## Step 4: Test the Configuration

### Option A: Use the Auth0 Test Tool

1. In Auth0 Dashboard, go to your Application
2. Click **Test** tab
3. Click **OAuth 2.0 Playground**
4. Get an access token and decode it at https://jwt.io
5. Verify the `email` claim is present

### Option B: Test in Your App

1. **Clear your browser cache and logout**
2. **Sign in again** to get a fresh token
3. Check browser console for admin status
4. Try creating a tournament

### Option C: Test with Auth0 API

```bash
# Get your token from browser DevTools → Application → Local Storage → @@auth0spajs@@
# Then decode it:
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq .
```

Should show:
```json
{
  "email": "tangi.curet@gmail.com",
  "email_verified": true,
  ...
}
```

## Verification Commands

### Check Backend Logs

```bash
docker logs darts_tournament-backend-1 --tail 50 | grep "Admin Check"
```

Should show:
```
[Admin Check] { userEmail: 'tangi.curet@gmail.com', isAdmin: true, configuredAdmins: ['tangi.curet@gmail.com', ...] }
```

### Test Admin Status Endpoint

```bash
# Get your token from browser (see above)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/auth/me
```

Should return:
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

## Troubleshooting

### Error: "Admin access required"

**Cause**: Email claim missing from access token

**Solution**:
1. Verify Auth0 Action is deployed and added to Login flow
2. **Sign out completely** from your app
3. **Clear browser Local Storage** (Application tab → Local Storage → Clear All)
4. **Sign in again** to get new token with email claim

### Backend logs show: "No email found in token"

**Cause**: Auth0 Action not applied or not working

**Solution**:
1. Check Auth0 Action is **deployed** (green checkmark)
2. Check Action is **in the flow** (visible in Login flow diagram)
3. Check Action code has no syntax errors
4. Try using jwt.io to decode your token and verify email is missing

### Admin check shows email but isAdmin: false

**Cause**: Email doesn't match configured admin emails

**Solution**:
1. Check `backend/.env`: `AUTH_ADMIN_EMAILS=tangi.curet@gmail.com`
2. Verify spelling matches exactly (case-insensitive)
3. Restart backend: `docker-compose restart backend`
4. Check email in Account view matches `.env` exactly

## Security Notes

1. **Custom Claims**: Auth0 recommends using namespaced claims like `https://yourdomain.com/email`, but for simple setups, `email` works fine
2. **Email Verification**: Consider checking `email_verified` claim before granting admin access
3. **Token Expiry**: Access tokens expire after 24 hours by default, user will need to re-authenticate

## Next Steps

Once email is in the token:
1. User can create tournaments
2. User can manage tournament settings
3. User can delete tournaments
4. All admin-only operations work correctly
