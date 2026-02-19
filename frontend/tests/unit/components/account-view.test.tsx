import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AccountView from '../../../src/components/account-view';

const authState = {
  enabled: true,
  isAuthenticated: false,
  isLoading: false,
  user: undefined as unknown,
  logout: vi.fn(),
};

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => authState,
}));

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('AccountView', () => {
  beforeEach(() => {
    authState.enabled = true;
    authState.isAuthenticated = false;
    authState.isLoading = false;
    authState.user = undefined;
    authState.logout = vi.fn();
  });

  it('shows a not-configured message when auth is disabled', () => {
    authState.enabled = false;

    render(<AccountView />);

    expect(screen.getByText('account.notConfigured')).toBeInTheDocument();
  });

  it('shows a loading state while auth is loading', () => {
    authState.isLoading = true;

    render(<AccountView />);

    expect(screen.getByText('account.loading')).toBeInTheDocument();
  });

  it('prompts for sign-in when unauthenticated', () => {
    render(<AccountView />);

    expect(screen.getByText('account.signInRequired')).toBeInTheDocument();
  });

  it('renders user details and triggers logout', () => {
    authState.isAuthenticated = true;
    authState.user = {
      name: 'Jordan Player',
      picture: 'https://example.com/pic.png',
      email: 'jordan@example.com',
      nickname: 'jp',
      sub: 'auth0|abc',
      email_verified: true,
      updated_at: '2024-01-05T10:00:00.000Z',
    };

    render(<AccountView />);

    expect(screen.getByText('Jordan Player')).toBeInTheDocument();
    expect(screen.getByText('jordan@example.com')).toBeInTheDocument();
    expect(screen.getByText('@jp')).toBeInTheDocument();
    expect(screen.getByText('common.yes')).toBeInTheDocument();
    expect(screen.getByText(new Date('2024-01-05T10:00:00.000Z').toLocaleDateString())).toBeInTheDocument();

    fireEvent.click(screen.getByText('account.signOut'));
    expect(authState.logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: globalThis.window?.location.origin },
    });
  });

  it('renders alternate account details for unverified emails', () => {
    authState.isAuthenticated = true;
    authState.user = {
      name: 'Taylor Player',
      nickname: 'Taylor Player',
      email_verified: false,
      sub: 'auth0|xyz',
    };

    render(<AccountView />);

    expect(screen.queryByText('@Taylor Player')).not.toBeInTheDocument();
    expect(screen.getByText('common.no')).toBeInTheDocument();
  });
});
