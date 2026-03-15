import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AppHeader from '../../../src/components/app-header';

type HeaderTournamentMock = { format?: string; status?: string };

const resolveRequestUrl = (input: RequestInfo | URL) => {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
};

describe('AppHeader', () => {
  const t = (key: string) => key;
  let fetchMock: ReturnType<typeof vi.spyOn>;

  const mockHeaderFetch = (tournaments: HeaderTournamentMock[] = []) => {
    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = resolveRequestUrl(input);

      if (url.includes('/api/tournaments?limit=100')) {
        return {
          ok: true,
          json: async () => ({ tournaments }),
        } as Response;
      }

      if (url.includes('/api/auth/dev-autologin')) {
        return {
          ok: true,
          json: async () => ({ mode: 'anonymous' }),
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    });
  };

  beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.history.pushState({}, '', '/');
    fetchMock?.mockRestore();
    mockHeaderFetch([
      { format: 'DOUBLE', status: 'OPEN' },
      { format: 'TEAM_4_PLAYER', status: 'LIVE' },
    ]);
  });

  it('shows admin manage links and notification badge', async () => {
    globalThis.localStorage.setItem('notifications:match-started', JSON.stringify([
      { id: '1' },
      { id: '2', acknowledgedAt: '2026-01-01' },
    ]));

    render(
      <AppHeader
        t={t}
        isAdmin
        isAuthenticated
        lang="fr"
        setLanguage={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText('nav.manage')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Importation' })).toHaveAttribute('href', '/?view=import');
    const userAccountsLink = screen.getByRole('link', { name: 'nav.userAccounts' });
    expect(userAccountsLink).toBeInTheDocument();
    expect(screen.getByText('nav.registrationPlayers')).toBeInTheDocument();
    const signUpLink = screen.getByRole('link', { name: 'nav.signUp' });
    expect(signUpLink.compareDocumentPosition(userAccountsLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Individuels' })).toBeInTheDocument();
    const singleRegistrationsLink = screen.getByRole('link', { name: 'Individuels' });
    expect(signUpLink.compareDocumentPosition(singleRegistrationsLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText('1 unread notifications')).toBeInTheDocument();
  });

  it('shows registrations menu for non-admin and updates unread on custom event', async () => {
    render(
      <AppHeader
        t={t}
        isAdmin={false}
        isAuthenticated
        lang="fr"
        setLanguage={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText('nav.registrationPlayers')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'nav.userAccounts' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nav.signUp' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Individuels' })).toBeInTheDocument();

    globalThis.localStorage.setItem('notifications:match-started', JSON.stringify([{ id: '1' }, { id: '2' }]));
    globalThis.dispatchEvent(new Event('notifications:updated'));

    return waitFor(() => {
      expect(screen.getByLabelText('2 unread notifications')).toBeInTheDocument();
    });
  });

  it('switches language from selector and handles screen mode link', async () => {
    globalThis.history.pushState({}, '', '/?screen=1');
    const setLanguage = vi.fn();

    render(
      <AppHeader
        t={t}
        isAdmin
        isAuthenticated={false}
        lang="en"
        setLanguage={setLanguage}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const details = document.querySelector('details');
    details?.setAttribute('open', 'open');
    fireEvent.click(screen.getByText('Français'));

    expect(setLanguage).toHaveBeenCalledWith('fr');
    expect(screen.getByLabelText('live.exitScreenMode')).toBeInTheDocument();
  });

  it('shows only selected dev autologin mode until dropdown opens', async () => {
    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = resolveRequestUrl(input);
      if (url.includes('/api/tournaments?limit=100')) {
        return {
          ok: true,
          json: async () => ({ tournaments: [{ format: 'DOUBLE', status: 'OPEN' }] }),
        } as Response;
      }
      if (url.includes('/api/auth/dev-autologin')) {
        return {
          ok: true,
          json: async () => ({ mode: 'admin' }),
        } as Response;
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });

    render(
      <AppHeader
        t={t}
        isAdmin={false}
        isAuthenticated={false}
        lang="fr"
        setLanguage={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('account.devAutologinMode')).toBeInTheDocument();
    });

    const modeSelector = screen.getByLabelText('account.devAutologinMode');
    expect(modeSelector).toHaveTextContent('account.devAutologinAdmin');

    const details = modeSelector.closest('details');
    details?.setAttribute('open', 'open');

    expect(screen.getByRole('button', { name: 'account.devAutologinAnonymous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'account.devAutologinPlayer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'account.devAutologinAdmin' })).toBeInTheDocument();

    fetchMock.mockRestore();
  });

  it('keeps doublettes link visible for non-admin even without matching tournament formats', async () => {
    fetchMock.mockRestore();
    mockHeaderFetch([
      { format: 'DOUBLE', status: 'FINISHED' },
      { format: 'TEAM_4_PLAYER', status: 'DRAFT' },
      { format: 'SINGLE', status: 'OPEN' },
    ]);

    render(
      <AppHeader
        t={t}
        isAdmin={false}
        isAuthenticated={false}
        lang="fr"
        setLanguage={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'groups.doublettes' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: 'groups.equipes' })).not.toBeInTheDocument();
  });

  it('keeps finished tournaments eligible for admin registration format links', async () => {
    fetchMock.mockRestore();
    mockHeaderFetch([{ format: 'DOUBLE', status: 'FINISHED' }]);

    render(
      <AppHeader
        t={t}
        isAdmin
        isAuthenticated={false}
        lang="fr"
        setLanguage={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'groups.doublettes' })).toBeInTheDocument();
    });
  });

  it('keeps doublettes visible and hides equipes when tournaments fetch fails', async () => {
    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = resolveRequestUrl(input);
      if (url.includes('/api/tournaments?limit=100')) {
        return { ok: false, json: async () => ({}) } as Response;
      }
      if (url.includes('/api/auth/dev-autologin')) {
        return { ok: false, json: async () => ({}) } as Response;
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });

    render(
      <AppHeader
        t={t}
        isAdmin={false}
        isAuthenticated={false}
        lang="fr"
        setLanguage={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(screen.getByRole('link', { name: 'groups.doublettes' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'groups.equipes' })).not.toBeInTheDocument();
  });
});
