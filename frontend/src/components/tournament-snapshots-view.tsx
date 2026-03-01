import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOptionalAuth } from '../auth/optional-auth';
import { useI18n } from '../i18n';
import {
  fetchTournamentSnapshot,
  fetchTournamentSnapshots,
  restoreTournamentSnapshot,
  restoreTournamentSnapshotById,
  type TournamentSnapshot,
  type TournamentSnapshotSummary,
} from '../services/tournament-service';

type TournamentSummary = {
  id: string;
  name?: string;
  status?: string;
};

const TOURNAMENT_STATUSES = ['DRAFT', 'OPEN', 'SIGNATURE', 'LIVE', 'FINISHED'];
const MAX_VISIBLE_SNAPSHOTS = 10;

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};

const TournamentSnapshotsView = () => {
  const { t } = useI18n();
  const { enabled: authEnabled, isAuthenticated, getAccessTokenSilently } = useOptionalAuth();

  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [snapshotList, setSnapshotList] = useState<TournamentSnapshotSummary[]>([]);
  const [isRestoringSnapshotId, setIsRestoringSnapshotId] = useState<string | undefined>();
  const [isImporting, setIsImporting] = useState(false);

  const getSafeAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!authEnabled || !isAuthenticated) {
      return undefined;
    }
    try {
      return await getAccessTokenSilently();
    } catch {
      return undefined;
    }
  }, [authEnabled, getAccessTokenSilently, isAuthenticated]);

  const selectedTournament = useMemo(
    () => tournaments.find((tournament) => tournament.id === selectedTournamentId),
    [selectedTournamentId, tournaments]
  );

  const loadSnapshots = useCallback(async (tournamentId: string) => {
    if (!tournamentId) {
      setSnapshotList([]);
      return;
    }

    setLoadingSnapshots(true);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      const response = await fetchTournamentSnapshots(tournamentId, token);
      setSnapshotList(response.snapshots.slice(0, MAX_VISIBLE_SNAPSHOTS));
    } catch (error_) {
      setSnapshotList([]);
      setError(error_ instanceof Error ? error_.message : 'Impossible de charger les sauvegardes');
    } finally {
      setLoadingSnapshots(false);
    }
  }, [getSafeAccessToken]);

  const loadTournaments = useCallback(async () => {
    setLoadingTournaments(true);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      const responses = await Promise.all(
        TOURNAMENT_STATUSES.map((status) =>
          fetch(`/api/tournaments?status=${encodeURIComponent(status)}&limit=100`, token
            ? { headers: { Authorization: `Bearer ${token}` } }
            : undefined)
        )
      );

      const payloads = await Promise.all(
        responses.map(async (response) => (response.ok ? response.json() : { tournaments: [] }))
      );

      const map = new Map<string, TournamentSummary>();
      for (const payload of payloads) {
        const items = Array.isArray(payload?.tournaments)
          ? payload.tournaments as TournamentSummary[]
          : [];
        for (const tournament of items) {
          if (!tournament?.id) {
            continue;
          }
          map.set(tournament.id, tournament);
        }
      }

      const nextTournaments = [...map.values()].toSorted((first, second) =>
        (first.name || '').localeCompare(second.name || '')
      );
      setTournaments(nextTournaments);

      if (!selectedTournamentId && nextTournaments[0]?.id) {
        setSelectedTournamentId(nextTournaments[0].id);
      }
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Impossible de charger les tournois');
    } finally {
      setLoadingTournaments(false);
    }
  }, [getSafeAccessToken, selectedTournamentId]);

  useEffect(() => {
    void loadTournaments();
  }, [loadTournaments]);

  useEffect(() => {
    if (!selectedTournamentId) {
      return;
    }
    void loadSnapshots(selectedTournamentId);
  }, [loadSnapshots, selectedTournamentId]);

  const exportCurrentSnapshot = useCallback(async () => {
    if (!selectedTournamentId) {
      return;
    }

    setError(undefined);
    setSuccess(undefined);
    try {
      const token = await getSafeAccessToken();
      const snapshot = await fetchTournamentSnapshot(selectedTournamentId, token);
      const blob = new Blob([`${JSON.stringify(snapshot, undefined, 2)}\n`], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = globalThis.document.createElement('a');
      link.href = url;
      link.download = `tournament-${selectedTournamentId}-snapshot.json`;
      globalThis.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSuccess('Snapshot exporté');
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Impossible d’exporter le snapshot courant');
    }
  }, [getSafeAccessToken, selectedTournamentId]);

  const restoreById = useCallback(async (snapshotId: string) => {
    if (!selectedTournamentId || !snapshotId) {
      return;
    }
    setError(undefined);
    setSuccess(undefined);
    setIsRestoringSnapshotId(snapshotId);
    try {
      const token = await getSafeAccessToken();
      await restoreTournamentSnapshotById(selectedTournamentId, snapshotId, token);
      await loadSnapshots(selectedTournamentId);
      setSuccess('Sauvegarde restaurée avec succès');
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Impossible de restaurer cette sauvegarde');
    } finally {
      setIsRestoringSnapshotId(undefined);
    }
  }, [getSafeAccessToken, loadSnapshots, selectedTournamentId]);

  const snapshotsContent = useMemo(() => {
    if (loadingSnapshots) {
      return (
        <div className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-300">
          {t('common.loading')}
        </div>
      );
    }

    if (snapshotList.length === 0) {
      return (
        <div className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-300">
          Aucune sauvegarde trouvée pour ce tournoi.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-slate-800/70">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/80 text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Acteur</th>
              <th className="px-3 py-2 text-left">Trigger</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {snapshotList.map((snapshot) => {
              const snapshotId = snapshot.snapshotId;
              const actor = snapshot.actorEmail || snapshot.actorId || 'system';
              const isRestoring = isRestoringSnapshotId === snapshotId;
              return (
                <tr key={snapshotId} className="border-t border-slate-800/60">
                  <td className="px-3 py-2 text-slate-200">{formatDateTime(snapshot.savedAt)}</td>
                  <td className="px-3 py-2 text-slate-300">{snapshot.action}</td>
                  <td className="px-3 py-2 text-slate-300">{actor}</td>
                  <td className="px-3 py-2 text-slate-300">{snapshot.trigger}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="rounded-md border border-slate-700 px-3 py-1 hover:bg-slate-800 disabled:opacity-50"
                      disabled={isRestoring}
                      onClick={() => {
                        if (globalThis.window?.confirm('Restaurer cette sauvegarde ? Cette action remplace l’état actuel du tournoi.')) {
                          void restoreById(snapshotId);
                        }
                      }}
                    >
                      {isRestoring ? t('common.loading') : 'Restaurer'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }, [isRestoringSnapshotId, loadingSnapshots, restoreById, snapshotList, t]);

  const importAndRestore = useCallback(async (file: File) => {
    if (!selectedTournamentId) {
      return;
    }

    setError(undefined);
    setSuccess(undefined);
    setIsImporting(true);
    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as TournamentSnapshot;
      const token = await getSafeAccessToken();
      await restoreTournamentSnapshot(selectedTournamentId, parsed, token);
      await loadSnapshots(selectedTournamentId);
      setSuccess('Snapshot importé et restauré avec succès');
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Fichier snapshot invalide ou restauration impossible');
    } finally {
      setIsImporting(false);
    }
  }, [getSafeAccessToken, loadSnapshots, selectedTournamentId]);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white">Sauvegardes tournoi (admin)</h1>
        <button
          type="button"
          onClick={() => void loadTournaments()}
          className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
          disabled={loadingTournaments}
        >
          {loadingTournaments ? t('common.loading') : 'Rafraîchir tournois'}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(16rem,24rem)_1fr]">
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          <span>Tournoi</span>
          <select
            value={selectedTournamentId}
            onChange={(event) => {
              setSelectedTournamentId(event.target.value);
              setSuccess(undefined);
            }}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          >
            <option value="">-- Sélectionner --</option>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {(tournament.name || 'Sans nom')} ({tournament.status || 'UNKNOWN'})
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2 md:justify-end">
          <button
            type="button"
            onClick={() => void exportCurrentSnapshot()}
            disabled={!selectedTournamentId}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            Exporter snapshot courant
          </button>
          <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50">
            <span>Importer + restaurer</span>
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              disabled={!selectedTournamentId || isImporting}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void importAndRestore(file);
                }
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          {success}
        </div>
      )}

      {!selectedTournamentId && (
        <div className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-300">
          Sélectionne un tournoi pour consulter son historique de sauvegardes.
        </div>
      )}

      {selectedTournamentId && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Historique des sauvegardes {selectedTournament?.name ? `· ${selectedTournament.name}` : ''}
          </h2>
          <p className="text-xs text-slate-400">
            Affichage limité aux {MAX_VISIBLE_SNAPSHOTS} snapshots les plus récents.
          </p>

          {snapshotsContent}
        </div>
      )}
    </div>
  );
};

export default TournamentSnapshotsView;
