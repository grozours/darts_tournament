import { useCallback, useEffect } from 'react';
import { DurationType, TournamentFormat } from '@shared/types';
import { normalizeTournamentStatus } from './tournament-status-helpers';
import type { EditFormState, Tournament } from './types';

type UseTournamentEditLoaderProperties = {
  isEditPage: boolean;
  editTournamentId: string | null | undefined;
  editingTournamentId: string | undefined;
  toLocalInput: (value?: string) => string;
  getSafeAccessToken: () => Promise<string | undefined>;
  clearPlayers: () => void;
  clearPlayersError: () => void;
  fetchPlayers: (tournamentId: string) => Promise<void>;
  fetchTournamentDetails: (tournamentId: string) => Promise<void>;
  loadPoolStages: (tournamentId: string) => Promise<void>;
  loadBrackets: (tournamentId: string) => Promise<void>;
  loadTargets: (tournamentId: string) => Promise<void>;
  setEditingTournament: (value: Tournament | undefined) => void;
  setEditForm: (value: EditFormState | undefined) => void;
  setEditError: (value: string | undefined) => void;
  setEditLoading: (value: boolean) => void;
  setEditLoadError: (value: string | undefined) => void;
};

type TournamentEditLoaderResult = {
  openEdit: (tournament: Tournament, options?: { skipNavigation?: boolean }) => void;
};

const fetchEditTournamentData = async (
  tournamentId: string,
  getSafeAccessToken: () => Promise<string | undefined>
) => {
  const token = await getSafeAccessToken();
  const response = await fetch(`/api/tournaments/${tournamentId}`, token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : {});
  if (!response.ok) {
    throw new Error('Failed to load tournament');
  }
  return response.json();
};

const resolveValue = <T>(fallback: T, ...values: Array<T | undefined>) =>
  values.find((value) => value !== undefined) ?? fallback;

const mapEditTournament = (data: Record<string, unknown>, fallbackId: string): Tournament => {
  const location = resolveValue(undefined, data.location as string | undefined);
  const logoUrl = resolveValue(undefined, data.logoUrl as string | undefined, data.logo_url as string | undefined);
  const startTime = resolveValue(undefined, data.startTime as string | undefined, data.start_time as string | undefined);
  const endTime = resolveValue(undefined, data.endTime as string | undefined, data.end_time as string | undefined);
  const createdAt = resolveValue(undefined, data.createdAt as string | undefined, data.created_at as string | undefined);
  const completedAt = resolveValue(undefined, data.completedAt as string | undefined, data.completed_at as string | undefined);
  const historicalFlag = resolveValue(
    undefined,
    data.historicalFlag as boolean | undefined,
    data.historical_flag as boolean | undefined
  );
  const doubleStageEnabled = resolveValue(
    undefined,
    data.doubleStageEnabled as boolean | undefined,
    data.double_stage_enabled as boolean | undefined
  );

  return {
    id: resolveValue(fallbackId, data.id as string | undefined),
    name: resolveValue('', data.name as string | undefined),
    ...(location === undefined ? {} : { location }),
    ...(logoUrl === undefined ? {} : { logoUrl }),
    format: resolveValue(TournamentFormat.SINGLE, data.format as string | undefined),
    totalParticipants: resolveValue(
      0,
      data.totalParticipants as number | undefined,
      data.total_participants as number | undefined
    ),
    status: resolveValue('DRAFT', data.status as string | undefined),
    durationType: resolveValue(
      DurationType.FULL_DAY,
      data.durationType as string | undefined,
      data.duration_type as string | undefined
    ),
    ...(startTime === undefined ? {} : { startTime }),
    ...(endTime === undefined ? {} : { endTime }),
    targetCount: resolveValue(
      0,
      data.targetCount as number | undefined,
      data.target_count as number | undefined
    ),
    targetStartNumber: resolveValue(
      1,
      data.targetStartNumber as number | undefined,
      data.target_start_number as number | undefined
    ),
    shareTargets: resolveValue(
      true,
      data.shareTargets as boolean | undefined,
      data.share_targets as boolean | undefined
    ),
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(completedAt === undefined ? {} : { completedAt }),
    ...(historicalFlag === undefined ? {} : { historicalFlag }),
    ...(doubleStageEnabled === undefined ? {} : { doubleStageEnabled }),
  };
};

const buildEditFormState = (tournament: Tournament, toLocalInput: (value?: string) => string): EditFormState => ({
  name: tournament.name ?? '',
  location: tournament.location ?? '',
  format: tournament.format ?? TournamentFormat.SINGLE,
  durationType: tournament.durationType ?? DurationType.FULL_DAY,
  startTime: toLocalInput(tournament.startTime),
  endTime: toLocalInput(tournament.endTime),
  totalParticipants: String(tournament.totalParticipants ?? 0),
  targetCount: String(tournament.targetCount ?? 0),
  targetStartNumber: String(tournament.targetStartNumber ?? 1),
  shareTargets: Boolean(tournament.shareTargets ?? true),
  doubleStageEnabled: Boolean(tournament.doubleStageEnabled),
});

const shouldLoadPlayers = (status: string) =>
  ['OPEN', 'SIGNATURE'].includes(normalizeTournamentStatus(status));

const useTournamentEditLoader = ({
  isEditPage,
  editTournamentId,
  editingTournamentId,
  toLocalInput,
  getSafeAccessToken,
  clearPlayers,
  clearPlayersError,
  fetchPlayers,
  fetchTournamentDetails,
  loadPoolStages,
  loadBrackets,
  loadTargets,
  setEditingTournament,
  setEditForm,
  setEditError,
  setEditLoading,
  setEditLoadError,
}: UseTournamentEditLoaderProperties): TournamentEditLoaderResult => {
  const openEdit = useCallback((tournament: Tournament, options?: { skipNavigation?: boolean }) => {
    if (!options?.skipNavigation && !isEditPage) {
      const query = new URLSearchParams({ view: 'edit-tournament', tournamentId: tournament.id });
      globalThis.window?.location.assign(`/?${query.toString()}`);
      return;
    }
    setEditingTournament(tournament);
    setEditForm(buildEditFormState(tournament, toLocalInput));
    setEditError(undefined);
    clearPlayersError();
    if (shouldLoadPlayers(tournament.status)) {
      void fetchPlayers(tournament.id);
    } else {
      clearPlayers();
    }
    void fetchTournamentDetails(tournament.id);
    void loadPoolStages(tournament.id);
    void loadBrackets(tournament.id);
    void loadTargets(tournament.id);
  }, [clearPlayers, clearPlayersError, fetchPlayers, fetchTournamentDetails, isEditPage, loadBrackets, loadPoolStages, loadTargets, setEditError, setEditForm, setEditingTournament, toLocalInput]);

  useEffect(() => {
    if (!isEditPage || !editTournamentId) return;
    if (editingTournamentId === editTournamentId) return;
    const loadTournamentForEdit = async () => {
      setEditLoading(true);
      setEditLoadError(undefined);
      try {
        const data = await fetchEditTournamentData(editTournamentId, getSafeAccessToken);
        openEdit(mapEditTournament(data as Record<string, unknown>, editTournamentId), { skipNavigation: true });
      } catch (error_) {
        setEditLoadError(error_ instanceof Error ? error_.message : 'Failed to load tournament');
      } finally {
        setEditLoading(false);
      }
    };
    void loadTournamentForEdit();
  }, [editTournamentId, editingTournamentId, getSafeAccessToken, isEditPage, openEdit, setEditLoadError, setEditLoading]);

  return { openEdit };
};

export default useTournamentEditLoader;
