import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImportView from '../../../src/components/import-view';

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

describe('ImportView', () => {
  beforeEach(() => {
    authState.enabled = true;
    authState.isAuthenticated = true;
    authState.isLoading = false;
    authState.getAccessTokenSilently = vi.fn(async () => 'token-1');
    adminState.isAdmin = true;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === '/api/auth/users/import' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            rowsRead: 1,
            accountsDetected: 2,
            createdCount: 1,
            updatedCount: 1,
            skippedCount: 0,
            issues: [],
            tournamentImport: {
              tournamentsCreated: 2,
              tournamentsUpdated: 0,
              singleRegistrationsCreated: 3,
              doublettesCreated: 2,
              doublePlayersCreated: 4,
              singlePoolStagesCount: 1,
              singleBracketsCount: 2,
              doublePoolStagesCount: 3,
              doubleBracketsCount: 3,
              issues: [],
            },
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });
  });

  it('shows sign-in panel when authentication is required', () => {
    authState.isAuthenticated = false;
    adminState.isAdmin = false;

    render(<ImportView />);

    expect(screen.getByText('auth.signInRequired')).toBeInTheDocument();
  });

  it('shows admin-only message for non-admin users', () => {
    adminState.isAdmin = false;

    render(<ImportView />);

    expect(screen.getByText('auth.adminOnly')).toBeInTheDocument();
  });

  it('imports accounts from a TSV file', async () => {
    render(<ImportView />);

    expect(screen.getByRole('heading', { name: 'Importation' })).toBeInTheDocument();

    const input = screen.getByLabelText('userAccounts.importButton');
    const file = new File([
      'Nom_I\tPrenom_I\tMail_I\tNiveau_I\nMartin\tAlice\talice@example.com\t2',
    ], 'inscriptions.tsv', { type: 'text/tab-separated-values' });
    Object.defineProperty(file, 'text', {
      value: vi.fn(async () => await Promise.resolve('Nom_I\tPrenom_I\tMail_I\tNiveau_I\nMartin\tAlice\talice@example.com\t2')),
    });

    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText(/userAccounts.importSelectedFile/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'userAccounts.importSendButton' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/auth/users/import',
        expect.objectContaining({ method: 'POST' })
      );
    });

    const importCall = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .find((call) => call[0] === '/api/auth/users/import');
    expect(importCall).toBeDefined();
    const importInit = importCall?.[1] as RequestInit | undefined;
    const parsedBody = JSON.parse((importInit?.body as string) ?? '{}') as { includeTournamentImport?: boolean };
    expect(parsedBody.includeTournamentImport).toBe(true);

    await waitFor(() => {
      expect(screen.getByText(/userAccounts\.importSuccess/i)).toBeInTheDocument();
    });
  });

  it('shows import error when backend import fails', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/auth/users/import' && init?.method === 'POST') {
        return {
          ok: false,
          json: async () => ({ message: 'userAccounts.importFailed' }),
        } as Response;
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    render(<ImportView />);

    const input = screen.getByLabelText('userAccounts.importButton');
    const file = new File(['Nom_I\tPrenom_I\nMartin\tAlice'], 'inscriptions.tsv', { type: 'text/tab-separated-values' });
    Object.defineProperty(file, 'text', {
      value: vi.fn(async () => await Promise.resolve('Nom_I\tPrenom_I\nMartin\tAlice')),
    });

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'userAccounts.importSendButton' }));

    await waitFor(() => {
      expect(screen.getByText('userAccounts.importFailed')).toBeInTheDocument();
    });
  });
});
