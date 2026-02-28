import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AppHeader from '../../../src/components/app-header';

describe('AppHeader', () => {
  const t = (key: string) => key;

  beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.history.pushState({}, '', '/');
  });

  it('shows admin manage links and notification badge', () => {
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

    expect(screen.getByText('nav.manage')).toBeInTheDocument();
    expect(screen.getByText('nav.registrationPlayers')).toBeInTheDocument();
    const signUpLink = screen.getByRole('link', { name: 'nav.signUp' });
    expect(screen.getByRole('link', { name: 'nav.players' })).toBeInTheDocument();
    const playersLink = screen.getByRole('link', { name: 'nav.players' });
    expect(signUpLink.compareDocumentPosition(playersLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText('1 unread notifications')).toBeInTheDocument();
  });

  it('shows registrations menu for non-admin and updates unread on custom event', () => {
    render(
      <AppHeader
        t={t}
        isAdmin={false}
        isAuthenticated
        lang="fr"
        setLanguage={vi.fn()}
      />
    );

    expect(screen.getByText('nav.registrationPlayers')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nav.signUp' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'nav.players' })).not.toBeInTheDocument();

    globalThis.localStorage.setItem('notifications:match-started', JSON.stringify([{ id: '1' }, { id: '2' }]));
    globalThis.dispatchEvent(new Event('notifications:updated'));

    return waitFor(() => {
      expect(screen.getByLabelText('2 unread notifications')).toBeInTheDocument();
    });
  });

  it('switches language from selector and handles screen mode link', () => {
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

    const details = document.querySelector('details');
    details?.setAttribute('open', 'open');
    fireEvent.click(screen.getByText('Français'));

    expect(setLanguage).toHaveBeenCalledWith('fr');
    expect(screen.getByLabelText('live.exitScreenMode')).toBeInTheDocument();
  });

  it('shows only selected dev autologin mode until dropdown opens', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ mode: 'admin' }),
    } as Response);

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
});
