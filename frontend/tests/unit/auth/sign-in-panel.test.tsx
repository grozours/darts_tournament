import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SignInPanel from '../../../src/auth/sign-in-panel';

const loginWithRedirect = vi.fn();

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => ({ loginWithRedirect }),
}));

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('SignInPanel', () => {
  const globalEnvironment = (globalThis as typeof globalThis & {
    __APP_ENV__?: Record<string, string>;
  }).__APP_ENV__ ?? {};
  const originalEnvironment = { ...globalEnvironment };

  beforeEach(() => {
    loginWithRedirect.mockReset();
    globalEnvironment.VITE_AUTH0_CONNECTION_GOOGLE = '';
    globalEnvironment.VITE_AUTH0_CONNECTION_FACEBOOK = '';
    globalEnvironment.VITE_AUTH0_CONNECTION_INSTAGRAM = '';
    (globalThis as typeof globalThis & { __APP_ENV__?: Record<string, string> }).__APP_ENV__ = globalEnvironment;
  });

  afterEach(() => {
    globalEnvironment.VITE_AUTH0_CONNECTION_GOOGLE = originalEnvironment.VITE_AUTH0_CONNECTION_GOOGLE;
    globalEnvironment.VITE_AUTH0_CONNECTION_FACEBOOK = originalEnvironment.VITE_AUTH0_CONNECTION_FACEBOOK;
    globalEnvironment.VITE_AUTH0_CONNECTION_INSTAGRAM = originalEnvironment.VITE_AUTH0_CONNECTION_INSTAGRAM;
  });

  it('triggers default login on primary button', () => {
    render(<SignInPanel title="Sign in" description="Desc" />);

    fireEvent.click(screen.getByText('auth.signIn'));
    expect(loginWithRedirect).toHaveBeenCalledWith();
  });

  it('uses default provider connections when env is empty', () => {
    render(<SignInPanel title="Sign in" description="Desc" />);

    fireEvent.click(screen.getByText('auth.signInWithGoogle'));
    expect(loginWithRedirect).toHaveBeenCalledWith({
      authorizationParams: { connection: 'google-oauth2' },
    });
  });

  it('uses trimmed custom connection values', () => {
    globalEnvironment.VITE_AUTH0_CONNECTION_GOOGLE = '  custom-google  ';

    render(<SignInPanel title="Sign in" description="Desc" />);

    fireEvent.click(screen.getByText('auth.signInWithGoogle'));
    expect(loginWithRedirect).toHaveBeenCalledWith({
      authorizationParams: { connection: 'custom-google' },
    });
  });
});
