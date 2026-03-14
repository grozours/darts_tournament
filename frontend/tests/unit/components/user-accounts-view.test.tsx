import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserAccountsView from '../../../src/components/user-accounts-view';

const authState = {
  enabled: true,
  isAuthenticated: true,
  isLoading: false,
  getAccessTokenSilently: vi.fn(async () => 'token-1'),
};

const adminState = {
  isAdmin: true,
  adminUser: undefined,
  checkingAdmin: false,
};

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => authState,
}));

vi.mock('../../../src/auth/use-admin-status', () => ({
  useAdminStatus: () => adminState,
}));

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const createDefaultFetchMock = () => vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.startsWith('/api/tournaments?limit=100')) {
    return {
      ok: true,
      json: async () => ({
        tournaments: [
          { id: 't1', name: 'Open Spring Cup' },
        ],
      }),
    } as Response;
  }

  if (url.startsWith('/api/auth/users?')) {
    return {
      ok: true,
      json: async () => ({
        users: [
          {
            id: 'u1',
            firstName: 'Alice',
            lastName: 'Martin',
            surname: 'Ace',
            email: 'alice@example.com',
            createdAt: '2026-03-14T12:00:00.000Z',
            updatedAt: '2026-03-14T12:00:00.000Z',
            tournamentCount: 2,
          },
        ],
      }),
    } as Response;
  }

  if (url === '/api/auth/users/u1' && init?.method === 'PATCH') {
    return {
      ok: true,
      json: async () => ({
        user: {
          id: 'u1',
          firstName: 'Alicia',
          lastName: 'Martin',
          surname: 'Ace',
          email: 'alice@example.com',
          createdAt: '2026-03-14T12:00:00.000Z',
          updatedAt: '2026-03-14T13:00:00.000Z',
          tournamentCount: 3,
        },
      }),
    } as Response;
  }

  throw new Error(`Unexpected fetch URL: ${url}`);
});

const resetAuthAdminState = () => {
  authState.enabled = true;
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.getAccessTokenSilently = vi.fn(async () => 'token-1');
  adminState.isAdmin = true;
};

describe('UserAccountsView', () => {
  beforeEach(() => {
    resetAuthAdminState();
    globalThis.fetch = createDefaultFetchMock();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  it('shows sign-in panel when authentication is required', () => {
    authState.isAuthenticated = false;
    adminState.isAdmin = false;

    render(<UserAccountsView />);

    expect(screen.getByText('auth.signInRequired')).toBeInTheDocument();
  });

  it('shows loading state while authentication is loading', () => {
    authState.isLoading = true;

    render(<UserAccountsView />);

    expect(screen.getByText('account.loading')).toBeInTheDocument();
  });

  it('shows admin-only message for non-admin users', () => {
    adminState.isAdmin = false;

    render(<UserAccountsView />);

    expect(screen.getByText('auth.adminOnly')).toBeInTheDocument();
  });

  it('loads, searches, and displays user accounts', async () => {
    render(<UserAccountsView />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Alice Martin/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/userAccounts\.tournamentCount\s*:\s*2/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('userAccounts.searchPlaceholder'), {
      target: { value: 'alice' },
    });
    fireEvent.change(screen.getByLabelText('userAccounts.tournamentFilter'), {
      target: { value: 't1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'common.search' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/users?q=alice&tournamentId=t1&limit=200'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-1' }) })
      );
    });
  });

  it('applies tournament filter on select change', async () => {
    render(<UserAccountsView />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Alice Martin/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('userAccounts.tournamentFilter'), {
      target: { value: 't1' },
    });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/users?tournamentId=t1&limit=200'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-1' }) })
      );
    });
  });

  it('edits and saves an account', async () => {
    render(<UserAccountsView />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Alice Martin/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'edit.edit' }));

    fireEvent.change(screen.getByPlaceholderText('edit.firstName'), {
      target: { value: 'Alicia' },
    });
    fireEvent.change(screen.getByPlaceholderText('edit.lastName'), {
      target: { value: 'Prime' },
    });
    fireEvent.change(screen.getByPlaceholderText('edit.surname'), {
      target: { value: 'Sniper' },
    });
    fireEvent.change(screen.getByPlaceholderText('edit.email'), {
      target: { value: 'alicia@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/auth/users/u1',
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Alicia Martin/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/userAccounts\.tournamentCount\s*:\s*3/i)).not.toBeInTheDocument();

    const firstEditButton = screen.getAllByRole('button', { name: 'edit.edit' })[0];
    if (!firstEditButton) {
      throw new Error('Expected at least one edit button');
    }
    fireEvent.click(firstEditButton);
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('userAccounts.editTitle')).not.toBeInTheDocument();
    });
  });

  it('shows backend error message when list endpoint fails', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) } as Response));

    render(<UserAccountsView />);

    await waitFor(() => {
      expect(screen.getByText('userAccounts.loadFailed')).toBeInTheDocument();
    });
  });

  it('bulk deletes accounts without tournament registration', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.startsWith('/api/tournaments?limit=100')) {
        return {
          ok: true,
          json: async () => ({ tournaments: [{ id: 't1', name: 'Open Spring Cup' }] }),
        } as Response;
      }

      if (url === '/api/auth/users?scope=without-tournament' && init?.method === 'DELETE') {
        return {
          ok: true,
          json: async () => ({ deletedCount: 2 }),
        } as Response;
      }

      if (url.startsWith('/api/auth/users?')) {
        return {
          ok: true,
          json: async () => ({
            users: [
              {
                id: 'u1',
                firstName: 'Alice',
                lastName: 'Martin',
                surname: 'Ace',
                email: 'alice@example.com',
                createdAt: '2026-03-14T12:00:00.000Z',
                updatedAt: '2026-03-14T12:00:00.000Z',
                tournamentCount: 0,
              },
            ],
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    render(<UserAccountsView />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Alice Martin/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'userAccounts.deleteOrphansButton' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/auth/users?scope=without-tournament',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    expect(screen.getByText('userAccounts.deleteOrphansSuccess 2')).toBeInTheDocument();
  });

});
