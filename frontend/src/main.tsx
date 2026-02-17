import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { OptionalAuthProvider } from './auth/optionalAuth';
import { I18nProvider } from './i18n';
import './index.css';

// Get the root element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Create root and render the app
const root = createRoot(rootElement);
const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined;
const isDebugAuth0 = import.meta.env.VITE_DEBUG_AUTH0 === 'true';

if (isDebugAuth0) {
  console.log('[main.tsx] 🚀 Starting application with Auth0 config:', {
    domain: auth0Domain || '(not set)',
    clientId: auth0ClientId ? `${auth0ClientId.substring(0, 8)}...` : '(not set)',
    audience: auth0Audience || '(not set)',
    hasAll: !!(auth0Domain && auth0ClientId && auth0Audience),
  });

  if (!auth0Audience) {
    console.warn('[main.tsx] ⚠️ VITE_AUTH0_AUDIENCE is not set!');
    console.warn('[main.tsx] ⚠️ Access tokens will NOT contain email claim!');
    console.warn('[main.tsx] ⚠️ Admin authentication will fail!');
  }
}

root.render(
  <StrictMode>
    <I18nProvider>
      <OptionalAuthProvider
        domain={auth0Domain}
        clientId={auth0ClientId}
        audience={auth0Audience}
      >
        <App />
      </OptionalAuthProvider>
    </I18nProvider>
  </StrictMode>
);