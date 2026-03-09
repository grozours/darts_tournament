import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TournamentSnapshotsView from '../../../src/components/tournament-snapshots-view';

const authState = {
  enabled: false,
  isAuthenticated: false,
  getAccessTokenSilently: vi.fn(async () => 'token-1'),
};

const fetchTournamentSnapshot = vi.fn();
const fetchTournamentSnapshots = vi.fn();
const restoreTournamentSnapshot = vi.fn();
const restoreTournamentSnapshotById = vi.fn();

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => authState,
}));

vi.mock('../../../src/services/tournament-service', () => ({
  fetchTournamentSnapshot: (...args: unknown[]) => fetchTournamentSnapshot(...args),
  fetchTournamentSnapshots: (...args: unknown[]) => fetchTournamentSnapshots(...args),
  restoreTournamentSnapshot: (...args: unknown[]) => restoreTournamentSnapshot(...args),
  restoreTournamentSnapshotById: (...args: unknown[]) => restoreTournamentSnapshotById(...args),
}));

describe('TournamentSnapshotsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    authState.enabled = false;
    authState.isAuthenticated = false;
    authState.getAccessTokenSilently = vi.fn(async () => 'token-1');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const status = new URL(url, 'http://localhost').searchParams.get('status');
      if (status === 'OPEN') {
        return {
          ok: true,
          json: async () => ({
            tournaments: [
              { id: 't2', name: 'Beta Cup', status: 'OPEN' },
              { id: 't1', name: 'Alpha Cup', status: 'OPEN' },
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ tournaments: [] }),
      } as Response;
    });

    fetchTournamentSnapshots.mockResolvedValue({
      tournamentId: 't1',
      total: 0,
      snapshots: [],
    });
    fetchTournamentSnapshot.mockResolvedValue({ snapshotId: 's-export', tournamentId: 't1', savedAt: '2026-03-09T10:00:00.000Z', action: 'manual', trigger: 'admin', data: {} });
    restoreTournamentSnapshot.mockResolvedValue(undefined);
    restoreTournamentSnapshotById.mockResolvedValue(undefined);

    vi.spyOn(globalThis.URL, 'createObjectURL').mockReturnValue('blob:mock-snapshot');
    vi.spyOn(globalThis.URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(globalThis.window, 'confirm').mockReturnValue(true);
  });

  it('loads tournaments, auto-selects first sorted name, and renders empty snapshots state', async () => {
    render(<TournamentSnapshotsView />);

    expect(await screen.findByText('Historique des sauvegardes · Alpha Cup')).toBeInTheDocument();
    expect(await screen.findByText('Aucune sauvegarde trouvée pour ce tournoi.')).toBeInTheDocument();
    expect(fetchTournamentSnapshots).toHaveBeenCalledWith('t1', undefined);
  });

  it('renders loading while snapshots are being fetched', async () => {
    let resolveSnapshots: ((value: { tournamentId: string; total: number; snapshots: unknown[] }) => void) | undefined;
    fetchTournamentSnapshots.mockReturnValue(
      new Promise((resolve) => {
        resolveSnapshots = resolve;
      })
    );

    render(<TournamentSnapshotsView />);

    expect(await screen.findAllByText('common.loading')).not.toHaveLength(0);

    resolveSnapshots?.({ tournamentId: 't1', total: 0, snapshots: [] });
    await waitFor(() => {
      expect(screen.getByText('Aucune sauvegarde trouvée pour ce tournoi.')).toBeInTheDocument();
    });
  });

  it('exports current snapshot and shows success', async () => {
    render(<TournamentSnapshotsView />);
    await screen.findByText('Historique des sauvegardes · Alpha Cup');

    fireEvent.click(screen.getByText('Exporter snapshot courant'));

    await waitFor(() => {
      expect(fetchTournamentSnapshot).toHaveBeenCalledWith('t1', undefined);
    });
    expect(screen.getByText(/Snapshot export/i)).toBeInTheDocument();
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-snapshot');
  });

  it('restores a snapshot by id after confirmation', async () => {
    fetchTournamentSnapshots.mockResolvedValue({
      tournamentId: 't1',
      total: 1,
      snapshots: [
        {
          snapshotId: 'snap-1',
          tournamentId: 't1',
          savedAt: 'invalid-date',
          action: 'autosave',
          trigger: 'system',
          actorId: 'actor-1',
        },
      ],
    });

    render(<TournamentSnapshotsView />);

    expect(await screen.findByText('invalid-date')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Restaurer'));

    await waitFor(() => {
      expect(restoreTournamentSnapshotById).toHaveBeenCalledWith('t1', 'snap-1', undefined);
    });
    expect(screen.getByText(/Sauvegarde restaur.*succ/i)).toBeInTheDocument();
  });

  it('imports snapshot file and restores it', async () => {
    render(<TournamentSnapshotsView />);
    await screen.findByText('Historique des sauvegardes · Alpha Cup');

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).toBeTruthy();
    if (!fileInput) {
      throw new Error('Expected file input');
    }
    const file = new File([
      JSON.stringify({
        snapshotId: 's-file',
        tournamentId: 't1',
        savedAt: '2026-03-09T12:00:00.000Z',
        action: 'import',
        trigger: 'admin',
        data: {},
      }),
    ], 'snapshot.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', {
      value: async () => JSON.stringify({
        snapshotId: 's-file',
        tournamentId: 't1',
        savedAt: '2026-03-09T12:00:00.000Z',
        action: 'import',
        trigger: 'admin',
        data: {},
      }),
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(restoreTournamentSnapshot).toHaveBeenCalled();
    });
    expect(screen.getByText(/Snapshot import.*restaur/i)).toBeInTheDocument();
  });

  it('shows load errors when tournaments request fails', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('network down'));

    render(<TournamentSnapshotsView />);

    expect(await screen.findByText('network down')).toBeInTheDocument();
  });

  it('shows restore error when imported file is invalid', async () => {
    render(<TournamentSnapshotsView />);
    await screen.findByText('Historique des sauvegardes · Alpha Cup');

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) {
      throw new Error('Expected file input');
    }
    const badFile = new File(['{invalid json'], 'bad.json', { type: 'application/json' });
    Object.defineProperty(badFile, 'text', {
      value: async () => '{invalid json',
    });

    fireEvent.change(fileInput, { target: { files: [badFile] } });

    await waitFor(() => {
      expect(restoreTournamentSnapshot).not.toHaveBeenCalled();
    });
    expect(screen.getByText(/invalide|Unexpected token|JSON/i)).toBeInTheDocument();
  });

  it('passes bearer token when optional auth is enabled and token retrieval works', async () => {
    authState.enabled = true;
    authState.isAuthenticated = true;

    render(<TournamentSnapshotsView />);

    await screen.findByText('Historique des sauvegardes · Alpha Cup');
    expect(fetchTournamentSnapshots).toHaveBeenCalledWith('t1', 'token-1');
  });

  it('falls back to undefined token when token retrieval fails', async () => {
    authState.enabled = true;
    authState.isAuthenticated = true;
    authState.getAccessTokenSilently = vi.fn(async () => {
      throw new Error('token failure');
    });

    render(<TournamentSnapshotsView />);

    await screen.findByText('Historique des sauvegardes · Alpha Cup');
    expect(fetchTournamentSnapshots).toHaveBeenCalledWith('t1', undefined);
  });

  it('uses fallback snapshot load error when rejection is not an Error instance', async () => {
    fetchTournamentSnapshots.mockRejectedValue('plain-failure');

    render(<TournamentSnapshotsView />);

    expect(await screen.findByText('Impossible de charger les sauvegardes')).toBeInTheDocument();
  });

  it('does not restore when confirmation is declined', async () => {
    vi.spyOn(globalThis.window, 'confirm').mockReturnValue(false);
    fetchTournamentSnapshots.mockResolvedValue({
      tournamentId: 't1',
      total: 1,
      snapshots: [
        {
          snapshotId: 'snap-2',
          tournamentId: 't1',
          savedAt: '2026-03-09T11:00:00.000Z',
          action: 'autosave',
          trigger: 'system',
          actorEmail: 'admin@example.com',
        },
      ],
    });

    render(<TournamentSnapshotsView />);
    await screen.findByText('admin@example.com');

    fireEvent.click(screen.getByText('Restaurer'));

    await waitFor(() => {
      expect(restoreTournamentSnapshotById).not.toHaveBeenCalled();
    });
  });

  it('can refresh tournaments and switch selected tournament from dropdown', async () => {
    render(<TournamentSnapshotsView />);
    await screen.findByText('Historique des sauvegardes · Alpha Cup');

    fireEvent.click(screen.getByText('Rafraîchir tournois'));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 't2' } });

    await waitFor(() => {
      expect(fetchTournamentSnapshots).toHaveBeenCalledWith('t2', undefined);
    });
    expect(screen.getByText('Historique des sauvegardes · Beta Cup')).toBeInTheDocument();
  });

  it('ignores tournament payload entries without id', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const status = new URL(url, 'http://localhost').searchParams.get('status');
      if (status === 'OPEN') {
        return {
          ok: true,
          json: async () => ({
            tournaments: [
              { name: 'No Id Tournament', status: 'OPEN' },
              { id: 't1', name: 'Alpha Cup', status: 'OPEN' },
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ tournaments: [] }),
      } as Response;
    });

    render(<TournamentSnapshotsView />);

    await screen.findByText('Historique des sauvegardes · Alpha Cup');
    expect(screen.queryByText(/No Id Tournament/)).not.toBeInTheDocument();
  });

  it('uses fallback messages for export and restore errors when non-Error values are thrown', async () => {
    fetchTournamentSnapshot.mockRejectedValueOnce('export-fail');
    fetchTournamentSnapshots.mockResolvedValue({
      tournamentId: 't1',
      total: 1,
      snapshots: [
        {
          snapshotId: 'snap-3',
          tournamentId: 't1',
          savedAt: '2026-03-09T11:00:00.000Z',
          action: 'autosave',
          trigger: 'system',
          actorId: 'system',
        },
      ],
    });
    restoreTournamentSnapshotById.mockRejectedValueOnce('restore-fail');

    render(<TournamentSnapshotsView />);
    await screen.findByText('Restaurer');

    fireEvent.click(screen.getByText('Exporter snapshot courant'));
    expect(await screen.findByText('Impossible d’exporter le snapshot courant')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Restaurer'));
    expect(await screen.findByText('Impossible de restaurer cette sauvegarde')).toBeInTheDocument();
  });

  it('uses fallback load tournaments error message for non-Error rejections', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce('network-string-failure');

    render(<TournamentSnapshotsView />);

    expect(await screen.findByText('Impossible de charger les tournois')).toBeInTheDocument();
  });

  it('handles non-ok and malformed tournaments payloads and renders fallback option labels', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const status = new URL(url, 'http://localhost').searchParams.get('status');
      if (status === 'OPEN') {
        return {
          ok: true,
          json: async () => ({ tournaments: [{ id: 't-unknown' }] }),
        } as Response;
      }
      if (status === 'DRAFT') {
        return {
          ok: true,
          json: async () => ({ tournaments: 'not-an-array' }),
        } as Response;
      }
      return {
        ok: false,
        json: async () => ({ tournaments: [{ id: 'ignored' }] }),
      } as Response;
    });

    render(<TournamentSnapshotsView />);

    const option = await screen.findByRole('option', { name: 'Sans nom (UNKNOWN)' });
    expect(option).toBeInTheDocument();
    expect(screen.getByText('Historique des sauvegardes')).toBeInTheDocument();
  });

  it('shows system actor fallback and import fallback error for non-Error failures', async () => {
    fetchTournamentSnapshots.mockResolvedValue({
      tournamentId: 't1',
      total: 1,
      snapshots: [
        {
          snapshotId: 'snap-system',
          tournamentId: 't1',
          savedAt: '2026-03-09T11:00:00.000Z',
          action: 'autosave',
          trigger: 'system',
        },
      ],
    });
    restoreTournamentSnapshot.mockRejectedValueOnce('import-fail');

    render(<TournamentSnapshotsView />);

    expect((await screen.findAllByText('system')).length).toBeGreaterThan(0);

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) {
      throw new Error('Expected file input');
    }

    const file = new File([JSON.stringify({ snapshotId: 's', tournamentId: 't1', savedAt: 'x', action: 'a', trigger: 'system', data: {} })], 'snapshot.json');
    Object.defineProperty(file, 'text', {
      value: async () => JSON.stringify({ snapshotId: 's', tournamentId: 't1', savedAt: 'x', action: 'a', trigger: 'system', data: {} }),
    });

    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(await screen.findByText('Fichier snapshot invalide ou restauration impossible')).toBeInTheDocument();
  });

  it('ignores file input changes when no file is provided', async () => {
    render(<TournamentSnapshotsView />);
    await screen.findByText('Historique des sauvegardes · Alpha Cup');

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) {
      throw new Error('Expected file input');
    }

    fireEvent.change(fileInput, { target: { files: [] } });

    await waitFor(() => {
      expect(restoreTournamentSnapshot).not.toHaveBeenCalled();
    });
  });
});
