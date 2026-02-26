import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app';
import { OptionalAuthProvider } from './auth/optional-auth';
import { I18nProvider } from './i18n';
import './index.css';

const getEnvironmentValue = (key: string): string | undefined => {
  const globalEnvironment = (globalThis as typeof globalThis & {
    __APP_ENV__?: Record<string, string>;
  }).__APP_ENV__;
  if (globalEnvironment && key in globalEnvironment) {
    return globalEnvironment[key];
  }
  const environment = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  return environment ? environment[key] : undefined;
};

// Get the root element
const rootElement = document.querySelector('#root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Create root and render the app
const root = createRoot(rootElement);
const auth0Domain = getEnvironmentValue('VITE_AUTH0_DOMAIN');
const auth0ClientId = getEnvironmentValue('VITE_AUTH0_CLIENT_ID');
const auth0Audience = getEnvironmentValue('VITE_AUTH0_AUDIENCE');
const isDebugAuth0 = import.meta.env.VITE_DEBUG_AUTH0 === 'true';

if (isDebugAuth0) {
  console.log('[main.tsx] 🚀 Starting application with Auth0 config:', {
    domain: auth0Domain || '(not set)',
    clientId: auth0ClientId ? `${auth0ClientId.slice(0, 8)}...` : '(not set)',
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
        {...(auth0Domain ? { domain: auth0Domain } : {})}
        {...(auth0ClientId ? { clientId: auth0ClientId } : {})}
        {...(auth0Audience ? { audience: auth0Audience } : {})}
      >
        <App />
      </OptionalAuthProvider>
    </I18nProvider>
  </StrictMode>
);