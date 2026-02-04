import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { OptionalAuthProvider } from './auth/optionalAuth';
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

root.render(
  <StrictMode>
    <OptionalAuthProvider
      domain={auth0Domain}
      clientId={auth0ClientId}
      audience={auth0Audience}
    >
      <App />
    </OptionalAuthProvider>
  </StrictMode>
);