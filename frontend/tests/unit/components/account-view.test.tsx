import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccountView from '../../../src/components/account-view';

const authState = {
  enabled: true,
  isAuthenticated: false,
  isLoading: false,
  user: undefined as unknown,
  logout: vi.fn(),
  getAccessTokenSilently: vi.fn(),
};

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => authState,
}));

const adminState = {
  isAdmin: true,
  adminUser: undefined as unknown,
  checkingAdmin: false,
};

vi.mock('../../../src/auth/use-admin-status', () => ({
  useAdminStatus: () => adminState,
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
    authState.getAccessTokenSilently = vi.fn().mockResolvedValue('token-1');
    adminState.isAdmin = true;
    adminState.adminUser = undefined;
    adminState.checkingAdmin = false;
    globalThis.fetch = vi.fn();
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
    expect(screen.queryByText('auth.signIn')).not.toBeInTheDocument();
    expect(screen.queryByText('auth.orContinueWith')).not.toBeInTheDocument();
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

  it('shows autologin admin role label when admin profile is used', () => {
    authState.isAuthenticated = false;
    adminState.isAdmin = true;
    adminState.adminUser = {
      name: 'Admin Local',
      email: 'admin@local.dev',
      sub: 'local-admin',
    };

    render(<AccountView />);

    expect(screen.getByText('account.autologinAdmin')).toBeInTheDocument();
    expect(screen.queryByText('account.signOut')).not.toBeInTheDocument();
  });

  it('allows authenticated user to update first name, last name and surname', async () => {
    authState.isAuthenticated = true;
    authState.user = {
      name: 'Jordan Player',
      email: 'jordan@example.com',
      sub: 'auth0|abc',
    };

    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: 'auth0|abc',
          email: 'jordan@example.com',
          name: 'Jordan Prime (Sniper)',
          firstName: 'Jordan',
          lastName: 'Prime',
          surname: 'Sniper',
        },
        isAdmin: false,
      }),
    });

    const { findByDisplayValue } = render(<AccountView />);

    fireEvent.change(await findByDisplayValue('Jordan'), { target: { value: 'Jordan' } });
    fireEvent.change(screen.getByDisplayValue('Player'), { target: { value: 'Prime' } });
    fireEvent.change(screen.getByLabelText('edit.surname'), { target: { value: 'Sniper' } });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/me/profile', expect.objectContaining({
        method: 'PATCH',
      }));
    });
  });

  it('shows API error message when profile update fails', async () => {
    authState.isAuthenticated = true;
    authState.user = {
      name: 'Jordan Player',
      email: 'jordan@example.com',
      sub: 'auth0|abc',
    };

    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'profile update rejected' }),
    });

    render(<AccountView />);

    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => {
      expect(screen.getByText('profile update rejected')).toBeInTheDocument();
    });
  });

  it('shows fallback error message when profile update throws', async () => {
    authState.isAuthenticated = true;
    authState.user = {
      name: 'Jordan Player',
      email: 'jordan@example.com',
      sub: 'auth0|abc',
    };

    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));

    render(<AccountView />);

    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => {
      expect(screen.getByText('network down')).toBeInTheDocument();
    });
  });
});
