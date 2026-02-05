import { useState, useEffect, useMemo, useCallback } from 'react';
import { useOptionalAuth } from '../auth/optionalAuth';
import { useI18n } from '../i18n';
import { TournamentFormat, DurationType, SkillLevel, BracketType, BracketStatus, StageStatus, AssignmentType } from '@shared/types';
import {
  updateTournament,
  updateTournamentStatus,
  uploadTournamentLogo,
  fetchTournamentPlayers,
  registerTournamentPlayer,
  updateTournamentPlayer,
  updateTournamentPlayerCheckIn,
  removeTournamentPlayer,
  fetchPoolStages,
  createPoolStage,
  updatePoolStage,
  deletePoolStage,
  fetchBrackets,
  createBracket,
  updateBracket,
  deleteBracket,
  fetchPoolStagePools,
  updatePoolAssignments,
  type CreatePlayerPayload,
  type TournamentPlayer,
  type PoolStageConfig,
  type BracketConfig,
  type PoolStagePool,
  type PoolAssignmentPayload,
} from '../services/tournamentService';

type Translator = ReturnType<typeof useI18n>['t'];

interface Tournament {
  id: string;
  name: string;
  logoUrl?: string;
  format: string;
  totalParticipants: number;
  status: string;
  durationType?: string;
  startTime?: string;
  endTime?: string;
  targetCount?: number;
  createdAt?: string;
  completedAt?: string;
  historicalFlag?: boolean;
}

type EditFormState = {
  name: string;
  format: string;
  durationType: string;
  startTime: string;
  endTime: string;
  totalParticipants: string;
  targetCount: string;
};

type PlayerListProps = {
  players: TournamentPlayer[];
  playersLoading: boolean;
  t: Translator;
  onEdit: (player: TournamentPlayer) => void;
  onRemove: (playerId: string) => void;
};

type SignatureListProps = {
  players: TournamentPlayer[];
  playersLoading: boolean;
  t: Translator;
  checkingInPlayerId: string | null;
  onToggleCheckIn: (player: TournamentPlayer) => void;
};

const getPlayerActionLabel = (params: {
  isRegistering: boolean;
  isAutoFilling: boolean;
  isEditing: boolean;
  t: Translator;
}) => {
  if (params.isRegistering || params.isAutoFilling) {
    return params.t('edit.saving');
  }
  if (params.isEditing) {
    return params.t('edit.saveChanges');
  }
  return params.t('edit.addPlayer');
};

const getCheckInLabel = (
  player: TournamentPlayer,
  checkingInPlayerId: string | null,
  t: Translator
) => {
  if (checkingInPlayerId === player.playerId) {
    return t('edit.saving');
  }
  if (player.checkedIn) {
    return t('edit.undo');
  }
  return t('edit.confirmCheckIn');
};

const RegistrationPlayersList = ({ players, playersLoading, t, onEdit, onRemove }: PlayerListProps) => {
  if (playersLoading) {
    return <p className="text-sm text-slate-400">{t('edit.loadingPlayers')}</p>;
  }

  if (players.length === 0) {
    return <p className="text-sm text-slate-400">{t('edit.noPlayersRegistered')}</p>;
  }

  return (
    <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
      {players.map((player) => (
        <div
          key={player.playerId}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/60 bg-slate-950/50 px-4 py-2 text-sm"
        >
          <div>
            <p className="text-slate-100">{player.name}</p>
            <p className="text-xs text-slate-500">
              {player.email || t('edit.noEmail')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {player.skillLevel && (
              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                {player.skillLevel}
              </span>
            )}
            <button
              onClick={() => onEdit(player)}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
            >
              {t('edit.edit')}
            </button>
            <button
              onClick={() => onRemove(player.playerId)}
              className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
            >
              {t('edit.remove')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const SignaturePlayersList = ({
  players,
  playersLoading,
  t,
  checkingInPlayerId,
  onToggleCheckIn,
}: SignatureListProps) => {
  if (playersLoading) {
    return <p className="text-sm text-slate-400">{t('edit.loadingPlayers')}</p>;
  }

  if (players.length === 0) {
    return <p className="text-sm text-slate-400">{t('edit.noPlayersRegistered')}</p>;
  }

  return (
    <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
      {players.map((player) => (
        <div
          key={player.playerId}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/60 bg-slate-950/50 px-4 py-2 text-sm"
        >
          <div>
            <p className="text-slate-100">{player.name}</p>
            <p className="text-xs text-slate-500">
              {player.email || t('edit.noEmail')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {player.checkedIn && (
              <span className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs text-emerald-200">
                {t('edit.present')}
              </span>
            )}
            <button
              onClick={() => onToggleCheckIn(player)}
              disabled={checkingInPlayerId === player.playerId}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-60"
            >
              {getCheckInLabel(player, checkingInPlayerId, t)}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

function TournamentList() { // NOSONAR
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useOptionalAuth();
  const { t } = useI18n();
  const getStatusLabel = (scope: 'stage' | 'bracket', status: string) => {
    if (scope === 'stage') {
      const stageMap: Record<string, string> = {
        NOT_STARTED: t('status.stage.not_started'),
        EDITION: t('status.stage.edition'),
        IN_PROGRESS: t('status.stage.in_progress'),
        COMPLETED: t('status.stage.completed'),
      };
      return stageMap[status] ?? status;
    }

    const bracketMap: Record<string, string> = {
      NOT_STARTED: t('status.bracket.not_started'),
      IN_PROGRESS: t('status.bracket.in_progress'),
      COMPLETED: t('status.bracket.completed'),
    };
    return bracketMap[status] ?? status;
  };
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [poolStages, setPoolStages] = useState<PoolStageConfig[]>([]);
  const [poolStagesError, setPoolStagesError] = useState<string | null>(null);
  const [brackets, setBrackets] = useState<BracketConfig[]>([]);
  const [bracketsError, setBracketsError] = useState<string | null>(null);
  const [editingPoolStage, setEditingPoolStage] = useState<PoolStageConfig | null>(null);
  const [poolStagePools, setPoolStagePools] = useState<PoolStagePool[]>([]);
  const [poolStagePlayers, setPoolStagePlayers] = useState<TournamentPlayer[]>([]);
  const [poolStageAssignments, setPoolStageAssignments] = useState<Record<string, string[]>>({});
  const [poolStageEditError, setPoolStageEditError] = useState<string | null>(null);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);
  const [newPoolStage, setNewPoolStage] = useState({
    stageNumber: 1,
    name: '',
    poolCount: 2,
    playersPerPool: 4,
    advanceCount: 2,
  });
  const [newBracket, setNewBracket] = useState({
    name: '',
    bracketType: BracketType.SINGLE_ELIMINATION as string,
    totalRounds: 3,
  });
  const [isRegisteringPlayer, setIsRegisteringPlayer] = useState(false);
  const [isAutoFillingPlayers, setIsAutoFillingPlayers] = useState(false);
  const [checkingInPlayerId, setCheckingInPlayerId] = useState<string | null>(null);
  const [isConfirmingAll, setIsConfirmingAll] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [playerForm, setPlayerForm] = useState<CreatePlayerPayload>({
    firstName: '',
    lastName: '',
    surname: '',
    teamName: '',
    email: '',
    phone: '',
    skillLevel: undefined,
  });

  const formatOptions = useMemo(
    () => [
      { value: TournamentFormat.SINGLE, label: t('format.single') },
      { value: TournamentFormat.DOUBLE, label: t('format.double') },
      { value: TournamentFormat.TEAM_4_PLAYER, label: t('format.team4') },
    ],
    [t]
  );

  const durationOptions = useMemo(
    () => [
      { value: DurationType.HALF_DAY_MORNING, label: t('duration.halfDayMorning') },
      { value: DurationType.HALF_DAY_AFTERNOON, label: t('duration.halfDayAfternoon') },
      { value: DurationType.HALF_DAY_NIGHT, label: t('duration.halfDayNight') },
      { value: DurationType.FULL_DAY, label: t('duration.fullDay') },
      { value: DurationType.TWO_DAY, label: t('duration.twoDay') },
    ],
    [t]
  );

  const skillLevelOptions = useMemo(
    () => [
      { value: SkillLevel.BEGINNER, label: t('skill.beginner') },
      { value: SkillLevel.INTERMEDIATE, label: t('skill.intermediate') },
      { value: SkillLevel.ADVANCED, label: t('skill.advanced') },
      { value: SkillLevel.EXPERT, label: t('skill.expert') },
    ],
    [t]
  );

  const statusFilter = useMemo(() => {
    if (globalThis.window === undefined) return 'ALL';
    const params = new URLSearchParams(globalThis.window.location.search);
    return params.get('status')?.toUpperCase() || 'ALL';
  }, []);

  const normalizeStatus = useCallback((status?: string) => {
    if (!status) return '';
    const normalized = status.trim().toUpperCase();
    switch (normalized) {
      case 'REGISTRATION_OPEN':
        return 'OPEN';
      case 'IN_PROGRESS':
        return 'LIVE';
      case 'COMPLETED':
      case 'ARCHIVED':
        return 'FINISHED';
      default:
        return normalized;
    }
  }, []);

  const normalizedStatusFilter = statusFilter === 'ALL' ? 'ALL' : normalizeStatus(statusFilter);

  const groupedTournaments = useMemo(() => {
    const statusLabels: Record<string, string> = {
      DRAFT: t('tournaments.draft'),
      OPEN: t('tournaments.open'),
      SIGNATURE: t('tournaments.signature'),
      LIVE: t('tournaments.live'),
      FINISHED: t('tournaments.finished'),
    };

    if (statusFilter !== 'ALL') {
      const normalizedStatus = normalizedStatusFilter;
      const title = statusLabels[normalizedStatus] ?? t('tournaments.hub');
      const items = tournaments.filter(
        (tournament) => normalizeStatus(tournament.status) === normalizedStatus
      );

      return [{ title, status: normalizedStatus, items }];
    }

    const statuses = ['DRAFT', 'OPEN', 'SIGNATURE', 'LIVE', 'FINISHED'] as const;
    return statuses.map((status) => ({
      title: statusLabels[status],
      status,
      items: tournaments.filter(
        (tournament) => normalizeStatus(tournament.status) === status
      ),
    }));
  }, [tournaments, statusFilter, normalizedStatusFilter, normalizeStatus, t]);

  const toLocalInput = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (v: number) => String(v).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const response = await fetch('/api/tournaments', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error('Failed to fetch tournaments');
      }
      const data = await response.json();
      setTournaments(data.tournaments || []);
    } catch (err) {
      console.error('Error fetching tournaments:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tournaments');
    } finally {
      setLoading(false);
    }
  }, [authEnabled, getAccessTokenSilently]);

  useEffect(() => {
    if (!authEnabled || isAuthenticated) {
      fetchTournaments();
    }
  }, [authEnabled, isAuthenticated, fetchTournaments]);

  const createTournament = async () => {
    const name = prompt('Tournament name:');
    if (!name) return;

    try {
      const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const endTime = new Date(Date.now() + 6 * 60 * 60 * 1000);
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const response = await fetch('/api/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name,
          format: 'SINGLE',
          durationType: 'HALF_DAY_MORNING',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          totalParticipants: 8,
          targetCount: 4,
        }),
      });

      if (response.ok) {
        fetchTournaments();
      } else {
        const message = await response.text();
        alert(message || 'Failed to create tournament');
      }
    } catch (err) {
      console.error('Error creating tournament:', err);
      alert('Failed to create tournament');
    }
  };

  const deleteTournament = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tournament?')) return;

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const response = await fetch(`/api/tournaments/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (response.ok) {
        fetchTournaments();
      } else {
        alert('Failed to delete tournament');
      }
    } catch (err) {
      console.error('Error deleting tournament:', err);
      alert('Failed to delete tournament');
    }
  };

  const openEdit = (tournament: Tournament) => {
    setEditingTournament(tournament);
    setEditForm({
      name: tournament.name || '',
      format: tournament.format || TournamentFormat.SINGLE,
      durationType: tournament.durationType || DurationType.FULL_DAY,
      startTime: toLocalInput(tournament.startTime),
      endTime: toLocalInput(tournament.endTime),
      totalParticipants: String(tournament.totalParticipants ?? 0),
      targetCount: String(tournament.targetCount ?? 0),
    });
    setEditError(null);
    setPlayersError(null);
    if (['OPEN', 'SIGNATURE'].includes(normalizeStatus(tournament.status))) {
      void fetchPlayers(tournament.id);
    } else {
      setPlayers([]);
    }
    void fetchTournamentDetails(tournament.id);
    void loadPoolStages(tournament.id);
    void loadBrackets(tournament.id);
  };

  const closeEdit = () => {
    setEditingTournament(null);
    setEditForm(null);
    setEditError(null);
    setPlayers([]);
    setPlayersError(null);
    setPoolStages([]);
    setPoolStagesError(null);
    setBrackets([]);
    setBracketsError(null);
    setEditingPoolStage(null);
    setPoolStagePools([]);
    setPoolStagePlayers([]);
    setPoolStageAssignments({});
    setPoolStageEditError(null);
    setIsSavingAssignments(false);
    setEditingPlayerId(null);
    setCheckingInPlayerId(null);
    setLogoFile(null);
    setNewPoolStage({
      stageNumber: 1,
      name: '',
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
    });
    setNewBracket({
      name: '',
      bracketType: BracketType.SINGLE_ELIMINATION,
      totalRounds: 3,
    });
    setPlayerForm({
      firstName: '',
      lastName: '',
      surname: '',
      teamName: '',
      email: '',
      phone: '',
      skillLevel: undefined,
    });
  };

  const fetchPlayers = useCallback(async (tournamentId: string) => {
    setPlayersLoading(true);
    setPlayersError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const data = await fetchTournamentPlayers(tournamentId, token);
      setPlayers(data);
    } catch (err) {
      console.error('Error fetching players:', err);
      setPlayersError(t('edit.error.failedLoadPlayers'));
    } finally {
      setPlayersLoading(false);
    }
  }, [authEnabled, getAccessTokenSilently, t]);

  useEffect(() => {
    if (!editingTournament) return;
    const normalizedStatus = normalizeStatus(editingTournament.status);
    if (normalizedStatus === 'OPEN' || normalizedStatus === 'SIGNATURE') {
      void fetchPlayers(editingTournament.id);
    }
  }, [editingTournament, fetchPlayers, normalizeStatus]);

  const fetchTournamentDetails = async (tournamentId: string) => {
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const response = await fetch(`/api/tournaments/${tournamentId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error('Failed to fetch tournament details');
      }
      const data = await response.json();
      setEditingTournament((current) => (current ? { ...current, ...data } : data));
    } catch (err) {
      console.error('Error fetching tournament details:', err);
    }
  };

  const uploadLogo = async () => {
    if (!editingTournament || !logoFile) return;
    setIsUploadingLogo(true);
    setEditError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const result = await uploadTournamentLogo(editingTournament.id, logoFile, token);
      setEditingTournament((current) =>
        current ? { ...current, logoUrl: result?.logo_url || current.logoUrl } : current
      );
      setLogoFile(null);
      fetchTournaments();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('edit.error.failedUploadLogo'));
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const loadPoolStages = async (tournamentId: string) => {
    setPoolStagesError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const data = await fetchPoolStages(tournamentId, token);
      setPoolStages(data);
      const nextStageNumber = data.length > 0 ? Math.max(...data.map((s) => s.stageNumber)) + 1 : 1;
      setNewPoolStage((current) => ({ ...current, stageNumber: nextStageNumber }));
    } catch (err) {
      console.error('Error fetching pool stages:', err);
      setPoolStagesError(err instanceof Error ? err.message : t('edit.error.failedLoadPoolStages'));
    }
  };

  const loadBrackets = async (tournamentId: string) => {
    setBracketsError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const data = await fetchBrackets(tournamentId, token);
      setBrackets(data);
    } catch (err) {
      console.error('Error fetching brackets:', err);
      setBracketsError(err instanceof Error ? err.message : t('edit.error.failedLoadBrackets'));
    }
  };

  const updatePoolStageField = useCallback(
    (stageId: string, updater: (stage: PoolStageConfig) => PoolStageConfig) => {
      setPoolStages((current) =>
        current.map((item) => (item.id === stageId ? updater(item) : item))
      );
    },
    []
  );

  const handlePoolStageNumberChange = (stageId: string, value: number) => {
    updatePoolStageField(stageId, (item) => ({ ...item, stageNumber: value }));
  };

  const handlePoolStageNameChange = (stageId: string, value: string) => {
    updatePoolStageField(stageId, (item) => ({ ...item, name: value }));
  };

  const handlePoolStagePoolCountChange = (stageId: string, value: number) => {
    updatePoolStageField(stageId, (item) => ({ ...item, poolCount: value }));
  };

  const handlePoolStagePlayersPerPoolChange = (stageId: string, value: number) => {
    updatePoolStageField(stageId, (item) => ({ ...item, playersPerPool: value }));
  };

  const handlePoolStageAdvanceCountChange = (stageId: string, value: number) => {
    updatePoolStageField(stageId, (item) => ({ ...item, advanceCount: value }));
  };

  const handlePoolStageStatusChange = (stage: PoolStageConfig, nextStatus: string) => {
    updatePoolStageField(stage.id, (item) => ({ ...item, status: nextStatus }));
    savePoolStage({ ...stage, status: nextStatus });
  };

  const updateBracketField = useCallback(
    (bracketId: string, updater: (bracket: BracketConfig) => BracketConfig) => {
      setBrackets((current) =>
        current.map((item) => (item.id === bracketId ? updater(item) : item))
      );
    },
    []
  );

  const handleBracketNameChange = (bracketId: string, value: string) => {
    updateBracketField(bracketId, (item) => ({ ...item, name: value }));
  };

  const handleBracketTypeChange = (bracketId: string, value: string) => {
    updateBracketField(bracketId, (item) => ({ ...item, bracketType: value }));
  };

  const handleBracketRoundsChange = (bracketId: string, value: number) => {
    updateBracketField(bracketId, (item) => ({ ...item, totalRounds: value }));
  };

  const handleBracketStatusChange = (bracketId: string, value: string) => {
    updateBracketField(bracketId, (item) => ({ ...item, status: value }));
  };

  const addPoolStage = async () => {
    if (!editingTournament) return;
    if (!newPoolStage.name.trim()) {
      setPoolStagesError(t('edit.error.stageNameRequired'));
      return;
    }
    setPoolStagesError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await createPoolStage(editingTournament.id, newPoolStage, token);
      await loadPoolStages(editingTournament.id);
      setNewPoolStage((current) => ({ ...current, name: '' }));
    } catch (err) {
      setPoolStagesError(err instanceof Error ? err.message : t('edit.error.failedAddPoolStage'));
    }
  };

  const savePoolStage = async (stage: PoolStageConfig) => {
    if (!editingTournament) return;
    setPoolStagesError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updatePoolStage(editingTournament.id, stage.id, {
        stageNumber: stage.stageNumber,
        name: stage.name,
        poolCount: stage.poolCount,
        playersPerPool: stage.playersPerPool,
        advanceCount: stage.advanceCount,
        status: stage.status,
      }, token);
      await loadPoolStages(editingTournament.id);
    } catch (err) {
      setPoolStagesError(err instanceof Error ? err.message : t('edit.error.failedUpdatePoolStage'));
    }
  };

  const removePoolStage = async (stageId: string) => {
    if (!editingTournament) return;
    if (!confirm('Delete this pool stage?')) return;
    setPoolStagesError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await deletePoolStage(editingTournament.id, stageId, token);
      await loadPoolStages(editingTournament.id);
    } catch (err) {
      setPoolStagesError(err instanceof Error ? err.message : t('edit.error.failedDeletePoolStage'));
    }
  };

  const openPoolStageAssignments = async (stage: PoolStageConfig) => {
    if (!editingTournament) return;
    setPoolStageEditError(null);
    setEditingPoolStage(stage);
    setPoolStagePools([]);
    setPoolStagePlayers([]);
    setPoolStageAssignments({});
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const [playersData, poolsData] = await Promise.all([
        fetchTournamentPlayers(editingTournament.id, token),
        fetchPoolStagePools(editingTournament.id, stage.id, token),
      ]);
      setPoolStagePlayers(playersData);
      setPoolStagePools(poolsData);
      const initialAssignments: Record<string, string[]> = {};
      poolsData.forEach((pool) => {
        const poolAssignments = (pool.assignments || []).map((assignment) => assignment.playerId);
        initialAssignments[pool.id] = poolAssignments;
      });
      setPoolStageAssignments(initialAssignments);
    } catch (err) {
      setPoolStageEditError(err instanceof Error ? err.message : t('edit.error.failedLoadPoolAssignments'));
    }
  };

  const closePoolStageAssignments = () => {
    setEditingPoolStage(null);
    setPoolStagePools([]);
    setPoolStagePlayers([]);
    setPoolStageAssignments({});
    setPoolStageEditError(null);
    setIsSavingAssignments(false);
  };

  const updatePoolStageAssignment = (poolId: string, index: number, playerId: string) => {
    setPoolStageAssignments((current) => {
      const next = { ...current };
      const poolAssignments = [...(next[poolId] || [])];
      poolAssignments[index] = playerId;
      next[poolId] = poolAssignments;
      return next;
    });
  };

  const savePoolStageAssignments = async () => {
    if (!editingTournament || !editingPoolStage) return;
    setPoolStageEditError(null);
    setIsSavingAssignments(true);
    try {
      const assignments: PoolAssignmentPayload[] = [];
      Object.entries(poolStageAssignments).forEach(([poolId, playerIds]) => {
        playerIds
          .filter(Boolean)
          .forEach((playerId, index) => {
            assignments.push({
              poolId,
              playerId,
              assignmentType: AssignmentType.RANDOM,
              seedNumber: index + 1,
            });
          });
      });

      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updatePoolAssignments(editingTournament.id, editingPoolStage.id, assignments, token);
      closePoolStageAssignments();
    } catch (err) {
      setPoolStageEditError(err instanceof Error ? err.message : t('edit.error.failedUpdatePoolAssignments'));
    } finally {
      setIsSavingAssignments(false);
    }
  };

  const addBracket = async () => {
    if (!editingTournament) return;
    if (!newBracket.name.trim()) {
      setBracketsError(t('edit.error.bracketNameRequired'));
      return;
    }
    setBracketsError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await createBracket(editingTournament.id, newBracket, token);
      await loadBrackets(editingTournament.id);
      setNewBracket((current) => ({ ...current, name: '' }));
    } catch (err) {
      setBracketsError(err instanceof Error ? err.message : t('edit.error.failedAddBracket'));
    }
  };

  const saveBracket = async (bracket: BracketConfig) => {
    if (!editingTournament) return;
    setBracketsError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updateBracket(editingTournament.id, bracket.id, {
        name: bracket.name,
        bracketType: bracket.bracketType,
        totalRounds: bracket.totalRounds,
        status: bracket.status,
      }, token);
      await loadBrackets(editingTournament.id);
    } catch (err) {
      setBracketsError(err instanceof Error ? err.message : t('edit.error.failedUpdateBracket'));
    }
  };

  const removeBracket = async (bracketId: string) => {
    if (!editingTournament) return;
    if (!confirm('Delete this bracket?')) return;
    setBracketsError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await deleteBracket(editingTournament.id, bracketId, token);
      await loadBrackets(editingTournament.id);
    } catch (err) {
      setBracketsError(err instanceof Error ? err.message : t('edit.error.failedDeleteBracket'));
    }
  };

  const registerPlayer = async () => {
    if (!editingTournament) return;
    if (!playerForm.firstName.trim() || !playerForm.lastName.trim()) {
      setPlayersError('First and last name are required');
      return;
    }

    setIsRegisteringPlayer(true);
    setPlayersError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await registerTournamentPlayer(
        editingTournament.id,
        {
          firstName: playerForm.firstName.trim(),
          lastName: playerForm.lastName.trim(),
          surname: playerForm.surname?.trim() || undefined,
          teamName: playerForm.teamName?.trim() || undefined,
          email: playerForm.email?.trim() || undefined,
          phone: playerForm.phone?.trim() || undefined,
          skillLevel: playerForm.skillLevel,
        },
        token
      );
      setPlayerForm({
        firstName: '',
        lastName: '',
        surname: '',
        teamName: '',
        email: '',
        phone: '',
        skillLevel: undefined,
      });
      await fetchPlayers(editingTournament.id);
    } catch (err) {
      console.error('Error registering player:', err);
      setPlayersError(err instanceof Error ? err.message : t('edit.error.failedRegisterPlayer'));
    } finally {
      setIsRegisteringPlayer(false);
    }
  };

  const autoFillPlayers = async () => {
    if (!editingTournament) return;
    const totalSlots = editingTournament.totalParticipants || 0;
    const remainingSlots = Math.max(totalSlots - players.length, 0);
    if (remainingSlots === 0) {
      setPlayersError('All spots are already filled.');
      return;
    }

    setIsAutoFillingPlayers(true);
    setPlayersError(null);

    const sampleNames = [
      { firstName: 'Alex', lastName: 'Morgan' },
      { firstName: 'Jamie', lastName: 'Lee' },
      { firstName: 'Taylor', lastName: 'Jordan' },
      { firstName: 'Casey', lastName: 'Nguyen' },
      { firstName: 'Jordan', lastName: 'Patel' },
      { firstName: 'Morgan', lastName: 'Santos' },
      { firstName: 'Riley', lastName: 'Chen' },
      { firstName: 'Cameron', lastName: 'Brooks' },
      { firstName: 'Drew', lastName: 'Fischer' },
      { firstName: 'Avery', lastName: 'Lopez' },
      { firstName: 'Parker', lastName: 'Kim' },
      { firstName: 'Skyler', lastName: 'Wright' },
    ];

    const pickRandomName = () => sampleNames[Math.floor(Math.random() * sampleNames.length)];
    const existingNames = new Set(players.map((player) => player.name.toLowerCase()));
    const uniqueRegistrations: CreatePlayerPayload[] = [];
    let attempts = 0;

    while (uniqueRegistrations.length < remainingSlots && attempts < remainingSlots * 10) {
      attempts += 1;
      const baseName = pickRandomName();
      const suffix = String(Math.floor(Math.random() * 900) + 100);
      const firstName = baseName.firstName;
      const lastName = `${baseName.lastName} ${suffix}`;
      const fullName = `${firstName} ${lastName}`.toLowerCase();

      if (existingNames.has(fullName)) {
        continue;
      }

      existingNames.add(fullName);
      uniqueRegistrations.push({
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replaceAll(/\s+/g, '')}@example.com`,
      });
    }

    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      for (const registration of uniqueRegistrations) {
        await registerTournamentPlayer(editingTournament.id, registration, token);
      }

      await fetchPlayers(editingTournament.id);
    } catch (err) {
      console.error('Error auto-filling players:', err);
      setPlayersError(err instanceof Error ? err.message : t('edit.error.failedAutoFillPlayers'));
    } finally {
      setIsAutoFillingPlayers(false);
    }
  };

  const startEditPlayer = (player: TournamentPlayer) => {
    setEditingPlayerId(player.playerId);
    setPlayerForm({
      firstName: player.firstName || player.name.split(' ')[0] || '',
      lastName: player.lastName || player.name.split(' ').slice(1).join(' ') || '',
      surname: player.surname || '',
      teamName: player.teamName || '',
      email: player.email || '',
      phone: player.phone || '',
      skillLevel: player.skillLevel,
    });
    setPlayersError(null);
  };

  const cancelEditPlayer = () => {
    setEditingPlayerId(null);
    setPlayerForm({
      firstName: '',
      lastName: '',
      surname: '',
      teamName: '',
      email: '',
      phone: '',
      skillLevel: undefined,
    });
  };

  const savePlayerEdit = async () => {
    if (!editingTournament || !editingPlayerId) return;
    if (!playerForm.firstName.trim() || !playerForm.lastName.trim()) {
      setPlayersError('First and last name are required');
      return;
    }

    setIsRegisteringPlayer(true);
    setPlayersError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updateTournamentPlayer(
        editingTournament.id,
        editingPlayerId,
        {
          firstName: playerForm.firstName.trim(),
          lastName: playerForm.lastName.trim(),
          surname: playerForm.surname?.trim() || undefined,
          teamName: playerForm.teamName?.trim() || undefined,
          email: playerForm.email?.trim() || undefined,
          phone: playerForm.phone?.trim() || undefined,
          skillLevel: playerForm.skillLevel,
        },
        token
      );
      await fetchPlayers(editingTournament.id);
      cancelEditPlayer();
    } catch (err) {
      console.error('Error updating player:', err);
      setPlayersError(err instanceof Error ? err.message : t('edit.error.failedUpdatePlayer'));
    } finally {
      setIsRegisteringPlayer(false);
    }
  };

  const removePlayer = async (playerId: string) => {
    if (!editingTournament) return;
    if (!confirm('Remove this player from the tournament?')) return;
    setPlayersError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await removeTournamentPlayer(editingTournament.id, playerId, token);
      await fetchPlayers(editingTournament.id);
    } catch (err) {
      console.error('Error removing player:', err);
      setPlayersError(err instanceof Error ? err.message : t('edit.error.failedRemovePlayer'));
    }
  };

  const togglePlayerCheckIn = async (player: TournamentPlayer) => {
    if (!editingTournament) return;
    setCheckingInPlayerId(player.playerId);
    setPlayersError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updateTournamentPlayerCheckIn(
        editingTournament.id,
        player.playerId,
        !player.checkedIn,
        token
      );
      await fetchPlayers(editingTournament.id);
    } catch (err) {
      console.error('Error updating check-in:', err);
      setPlayersError(err instanceof Error ? err.message : t('edit.error.failedUpdateCheckIn'));
    } finally {
      setCheckingInPlayerId(null);
    }
  };

  const confirmAllPlayers = async () => {
    if (!editingTournament || players.length === 0) return;
    setIsConfirmingAll(true);
    setPlayersError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const pendingPlayers = players.filter((player) => !player.checkedIn);

      for (const player of pendingPlayers) {
        await updateTournamentPlayerCheckIn(editingTournament.id, player.playerId, true, token);
      }

      await fetchPlayers(editingTournament.id);
    } catch (err) {
      console.error('Error confirming all players:', err);
      setPlayersError(err instanceof Error ? err.message : t('edit.error.failedConfirmAllPlayers'));
    } finally {
      setIsConfirmingAll(false);
    }
  };

  const saveEdit = async () => {
    if (!editingTournament || !editForm) return;
    if (!editForm.name.trim()) {
      setEditError(t('edit.error.nameRequired'));
      return;
    }

    setIsSaving(true);
    setEditError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updateTournament(
        editingTournament.id,
        {
          name: editForm.name.trim(),
          format: editForm.format,
          durationType: editForm.durationType,
          startTime: editForm.startTime ? new Date(editForm.startTime).toISOString() : undefined,
          endTime: editForm.endTime ? new Date(editForm.endTime).toISOString() : undefined,
          totalParticipants: Number(editForm.totalParticipants || 0),
          targetCount: Number(editForm.targetCount || 0),
        },
        token
      );
      closeEdit();
      fetchTournaments();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('edit.error.failedUpdateTournament'));
    } finally {
      setIsSaving(false);
    }
  };

  const openRegistration = async () => {
    if (!editingTournament) return;
    if (normalizeStatus(editingTournament.status) === 'OPEN') {
      setEditError(t('edit.error.registrationAlreadyOpen'));
      return;
    }
    setIsSaving(true);
    setEditError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updateTournamentStatus(editingTournament.id, 'OPEN', token);
      closeEdit();
      fetchTournaments();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('edit.error.failedOpenRegistration'));
    } finally {
      setIsSaving(false);
    }
  };

  const moveToSignature = async () => {
    if (!editingTournament) return;
    if (normalizeStatus(editingTournament.status) !== 'OPEN') {
      setEditError(t('edit.error.mustBeOpenToSignature'));
      return;
    }
    setIsSaving(true);
    setEditError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updateTournamentStatus(editingTournament.id, 'SIGNATURE', token);
      closeEdit();
      fetchTournaments();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('edit.error.failedMoveToSignature'));
    } finally {
      setIsSaving(false);
    }
  };

  const moveToLive = async () => {
    if (!editingTournament) return;
    if (normalizeStatus(editingTournament.status) !== 'SIGNATURE') {
      setEditError(t('edit.error.mustBeSignatureToLive'));
      return;
    }
    if (players.length === 0 || !players.every((player) => player.checkedIn)) {
      setEditError(t('edit.error.allPlayersMustBeConfirmed'));
      return;
    }

    setIsSaving(true);
    setEditError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await updateTournamentStatus(editingTournament.id, 'LIVE', token);
      closeEdit();
      fetchTournaments();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('edit.error.failedStartLive'));
    } finally {
      setIsSaving(false);
    }
  };

  const playerActionLabel = useMemo(
    () =>
      getPlayerActionLabel({
        isRegistering: isRegisteringPlayer,
        isAutoFilling: isAutoFillingPlayers,
        isEditing: Boolean(editingPlayerId),
        t,
      }),
    [editingPlayerId, isAutoFillingPlayers, isRegisteringPlayer, t]
  );

  const renderCard = (tournament: Tournament) => (
    <div
      key={tournament.id}
      className="group relative overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.8)] transition hover:border-cyan-400/50 hover:shadow-[0_20px_60px_-40px_rgba(34,211,238,0.8)]"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">
            {tournament.name}
          </h3>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{tournament.format}</p>
        </div>
        <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200">
          {tournament.status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-500">{t('common.players')}</p>
          <p className="mt-2 text-lg font-semibold text-white">{tournament.totalParticipants}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-500">{t('common.status')}</p>
          <p className="mt-2 text-lg font-semibold text-white">{tournament.status}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        {normalizeStatus(tournament.status) === 'LIVE' && (
          <a
            href={`/?view=live&tournamentId=${tournament.id}`}
            className="rounded-full border border-emerald-500/60 px-4 py-1.5 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300"
          >
            {t('tournaments.viewLive')}
          </a>
        )}
        <button
          onClick={() => openEdit(tournament)}
          className="rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
        >
          {t('tournaments.edit')}
        </button>
        <button
          onClick={() => deleteTournament(tournament.id)}
          className="rounded-full border border-rose-500/60 px-4 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
        >
          {t('tournaments.delete')}
        </button>
      </div>
    </div>
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        </div>
        <span className="ml-3 text-slate-300">{t('auth.checkingSession')}</span>
      </div>
    );
  }

  if (authEnabled && !isAuthenticated) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
        <h3 className="text-xl font-semibold text-white">{t('auth.signInToViewTournaments')}</h3>
        <p className="mt-2 text-sm text-slate-300">
          {t('auth.protectedContinue')}
        </p>
        <button
          onClick={() => loginWithRedirect()}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
        >
          {t('auth.signIn')}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        </div>
        <span className="ml-3 text-slate-300">{t('tournaments.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <div className="text-rose-200 mb-4">Error: {error}</div>
        <button
          onClick={fetchTournaments}
          className="inline-flex items-center gap-2 rounded-full bg-rose-500/80 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('tournaments.hub')}</p>
          <h2 className="text-2xl font-semibold text-white mt-2">
            {t('tournaments.hub')} <span className="text-slate-400">({tournaments.length})</span>
          </h2>
        </div>
        <button
          onClick={createTournament}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
        >
          + {t('tournaments.create')}
        </button>
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-700 p-10 text-center text-slate-300">
          <p className="text-lg font-semibold text-white">{t('tournaments.none')}</p>
          <p className="mt-2">{t('tournaments.none.subtitle')}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedTournaments.map((group) => (
            <div key={group.status} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{group.title}</h3>
                <span className="text-sm text-slate-400">{group.items.length}</span>
              </div>
              {group.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                  {t('common.noCategory')}
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  {group.items.map(renderCard)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editingTournament && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6">
          <div className="flex w-full max-w-2xl max-h-[85vh] flex-col rounded-3xl border border-slate-800/70 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{t('edit.title')}</h3>
              <button
                onClick={closeEdit}
                className="text-sm text-slate-400 hover:text-white"
              >
                {t('edit.close')}
              </button>
            </div>

            <div className="mt-6 flex-1 space-y-6 overflow-y-auto pr-1">
              <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-300">
                {t('edit.name')}
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                {t('edit.format')}
                <select
                  value={editForm.format}
                  onChange={(e) => setEditForm({ ...editForm, format: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                >
                  {formatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                {t('edit.durationType')}
                <select
                  value={editForm.durationType}
                  onChange={(e) => setEditForm({ ...editForm, durationType: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                >
                  {durationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                {t('edit.participants')}
                <input
                  type="number"
                  value={editForm.totalParticipants}
                  onChange={(e) => setEditForm({ ...editForm, totalParticipants: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                {t('edit.startTime')}
                <input
                  type="datetime-local"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                {t('edit.endTime')}
                <input
                  type="datetime-local"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                {t('edit.targetCount')}
                <input
                  type="number"
                  value={editForm.targetCount}
                  onChange={(e) => setEditForm({ ...editForm, targetCount: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
              </label>
              </div>

              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
                <h4 className="text-base font-semibold text-white">{t('edit.details')}</h4>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{t('common.status')}</p>
                    <p className="mt-2 text-sm text-slate-200">{editingTournament.status}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{t('edit.historicalFlag')}</p>
                    <p className="mt-2 text-sm text-slate-200">
                      {editingTournament.historicalFlag ? t('common.yes') : t('common.no')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{t('edit.created')}</p>
                    <p className="mt-2 text-sm text-slate-200">
                      {editingTournament.createdAt
                        ? new Date(editingTournament.createdAt).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{t('edit.completed')}</p>
                    <p className="mt-2 text-sm text-slate-200">
                      {editingTournament.completedAt
                        ? new Date(editingTournament.completedAt).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-xs uppercase tracking-widest text-slate-500">{t('edit.logo')}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    {editingTournament.logoUrl ? (
                      <img
                        src={editingTournament.logoUrl}
                        alt={t('edit.logoAlt')}
                        className="h-16 w-16 rounded-xl border border-slate-700 object-cover"
                      />
                    ) : (
                      <div className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-slate-700 text-xs text-slate-500">
                        {t('edit.noLogo')}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                        className="text-xs text-slate-300"
                      />
                      <button
                        onClick={uploadLogo}
                        disabled={!logoFile || isUploadingLogo}
                        className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-60"
                      >
                        {isUploadingLogo ? t('edit.uploading') : t('edit.uploadLogo')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-base font-semibold text-white">{t('edit.poolStages')}</h4>
                  <button
                    onClick={() => editingTournament && loadPoolStages(editingTournament.id)}
                    className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                  >
                    {t('common.refresh')}
                  </button>
                </div>
                {poolStagesError && (
                  <p className="mt-3 text-sm text-rose-300">{poolStagesError}</p>
                )}
                <div className="mt-4 space-y-3">
                  {poolStages.length === 0 ? (
                    <p className="text-sm text-slate-400">{t('edit.noPoolStages')}</p>
                  ) : (
                    poolStages.map((stage) => (
                      <div key={stage.id} className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4">
                        <div className="grid gap-3 md:grid-cols-5">
                          <label className="text-xs text-slate-400">
                            {t('edit.stageNumber')}
                            <input
                              type="number"
                              value={stage.stageNumber}
                              onChange={(e) => handlePoolStageNumberChange(stage.id, Number(e.target.value))}
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            />
                          </label>
                          <label className="text-xs text-slate-400 md:col-span-2">
                            {t('edit.name')}
                            <input
                              type="text"
                              value={stage.name}
                              onChange={(e) => handlePoolStageNameChange(stage.id, e.target.value)}
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            />
                          </label>
                          <label className="text-xs text-slate-400">
                            {t('edit.pools')}
                            <input
                              type="number"
                              value={stage.poolCount}
                              onChange={(e) => handlePoolStagePoolCountChange(stage.id, Number(e.target.value))}
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            />
                          </label>
                          <label className="text-xs text-slate-400">
                            {t('edit.perPool')}
                            <input
                              type="number"
                              value={stage.playersPerPool}
                              onChange={(e) => handlePoolStagePlayersPerPoolChange(stage.id, Number(e.target.value))}
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            />
                          </label>
                          <label className="text-xs text-slate-400">
                            {t('edit.advance')}
                            <input
                              type="number"
                              value={stage.advanceCount}
                              onChange={(e) => handlePoolStageAdvanceCountChange(stage.id, Number(e.target.value))}
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            />
                          </label>
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <select
                            value={stage.status}
                            onChange={(e) => handlePoolStageStatusChange(stage, e.target.value)}
                            className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
                          >
                            {Object.values(StageStatus).map((status) => (
                              <option key={status} value={status}>
                                {getStatusLabel('stage', status)}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => openPoolStageAssignments(stage)}
                            disabled={stage.status !== StageStatus.EDITION}
                            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {t('edit.editPlayers')}
                          </button>
                          <button
                            onClick={() => savePoolStage(stage)}
                            className="rounded-full border border-cyan-500/60 px-3 py-1 text-xs text-cyan-200 hover:border-cyan-300"
                          >
                            {t('common.save')}
                          </button>
                          <button
                            onClick={() => removePoolStage(stage.id)}
                            className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-5">
                  <label className="text-xs text-slate-400">
                    {t('edit.stageNumber')}
                    <input
                      type="number"
                      value={newPoolStage.stageNumber}
                      onChange={(e) =>
                        setNewPoolStage((current) => ({
                          ...current,
                          stageNumber: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                    />
                  </label>
                  <label className="text-xs text-slate-400 md:col-span-2">
                    {t('edit.name')}
                    <input
                      type="text"
                      value={newPoolStage.name}
                      onChange={(e) =>
                        setNewPoolStage((current) => ({
                          ...current,
                          name: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    {t('edit.pools')}
                    <input
                      type="number"
                      value={newPoolStage.poolCount}
                      onChange={(e) =>
                        setNewPoolStage((current) => ({
                          ...current,
                          poolCount: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    {t('edit.perPool')}
                    <input
                      type="number"
                      value={newPoolStage.playersPerPool}
                      onChange={(e) =>
                        setNewPoolStage((current) => ({
                          ...current,
                          playersPerPool: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    {t('edit.advance')}
                    <input
                      type="number"
                      value={newPoolStage.advanceCount}
                      onChange={(e) =>
                        setNewPoolStage((current) => ({
                          ...current,
                          advanceCount: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                    />
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={addPoolStage}
                    disabled={!newPoolStage.name.trim()}
                    className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
                  >
                    {t('edit.addStage')}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-base font-semibold text-white">{t('edit.brackets')}</h4>
                  <button
                    onClick={() => editingTournament && loadBrackets(editingTournament.id)}
                    className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                  >
                    {t('common.refresh')}
                  </button>
                </div>
                {bracketsError && (
                  <p className="mt-3 text-sm text-rose-300">{bracketsError}</p>
                )}
                <div className="mt-4 space-y-3">
                  {brackets.length === 0 ? (
                    <p className="text-sm text-slate-400">{t('edit.noBrackets')}</p>
                  ) : (
                    brackets.map((bracket) => (
                      <div key={bracket.id} className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4">
                        <div className="grid gap-3 md:grid-cols-4">
                          <label className="text-xs text-slate-400 md:col-span-2">
                            {t('edit.name')}
                            <input
                              type="text"
                              value={bracket.name}
                              onChange={(e) => handleBracketNameChange(bracket.id, e.target.value)}
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            />
                          </label>
                          <label className="text-xs text-slate-400">
                            {t('edit.type')}
                            <select
                              value={bracket.bracketType}
                              onChange={(e) => handleBracketTypeChange(bracket.id, e.target.value)}
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            >
                              {Object.values(BracketType).map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-xs text-slate-400">
                            {t('edit.rounds')}
                            <input
                              type="number"
                              value={bracket.totalRounds}
                              onChange={(e) => handleBracketRoundsChange(bracket.id, Number(e.target.value))}
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            />
                          </label>
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <select
                            value={bracket.status}
                            onChange={(e) => handleBracketStatusChange(bracket.id, e.target.value)}
                            className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
                          >
                            {Object.values(BracketStatus).map((status) => (
                              <option key={status} value={status}>
                                {getStatusLabel('bracket', status)}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => saveBracket(bracket)}
                            className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs text-emerald-200 hover:border-emerald-300"
                          >
                            {t('common.save')}
                          </button>
                          <button
                            onClick={() => removeBracket(bracket.id)}
                            className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <label className="text-xs text-slate-400 md:col-span-2">
                    {t('edit.name')}
                    <input
                      type="text"
                      value={newBracket.name}
                      onChange={(e) =>
                        setNewBracket((current) => ({
                          ...current,
                          name: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    {t('edit.type')}
                    <select
                      value={newBracket.bracketType}
                      onChange={(e) =>
                        setNewBracket((current) => ({
                          ...current,
                          bracketType: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                    >
                      {Object.values(BracketType).map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-400">
                    {t('edit.rounds')}
                    <input
                      type="number"
                      value={newBracket.totalRounds}
                      onChange={(e) =>
                        setNewBracket((current) => ({
                          ...current,
                          totalRounds: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                    />
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={addBracket}
                    disabled={!newBracket.name.trim()}
                    className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
                  >
                    {t('edit.addBracket')}
                  </button>
                </div>
              </div>

            {normalizeStatus(editingTournament.status) === 'OPEN' && (
              <div className="mt-8 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-white">{t('edit.playerRegistration')}</h4>
                    <p className="text-sm text-slate-400">
                      {players.length} {t('edit.spotsFilled.of')} {editingTournament.totalParticipants} {t('edit.spotsFilled.spotsFilled')}
                    </p>
                  </div>
                  <button
                    onClick={() => fetchPlayers(editingTournament.id)}
                    className="rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
                  >
                    {t('common.refresh')}
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-sm text-slate-300">
                    {t('edit.firstName')}
                    <input
                      type="text"
                      value={playerForm.firstName}
                      onChange={(e) => setPlayerForm({ ...playerForm, firstName: e.target.value })}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    {t('edit.lastName')}
                    <input
                      type="text"
                      value={playerForm.lastName}
                      onChange={(e) => setPlayerForm({ ...playerForm, lastName: e.target.value })}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    {t('edit.surname')}
                    <input
                      type="text"
                      value={playerForm.surname || ''}
                      onChange={(e) => setPlayerForm({ ...playerForm, surname: e.target.value })}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  {(editingTournament.format === TournamentFormat.DOUBLE
                    || editingTournament.format === TournamentFormat.TEAM_4_PLAYER) && (
                    <label className="text-sm text-slate-300">
                      {t('edit.teamName')}
                      <input
                        type="text"
                        value={playerForm.teamName || ''}
                        onChange={(e) => setPlayerForm({ ...playerForm, teamName: e.target.value })}
                        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                      />
                    </label>
                  )}
                  <label className="text-sm text-slate-300">
                    {t('edit.email')}
                    <input
                      type="email"
                      value={playerForm.email || ''}
                      onChange={(e) => setPlayerForm({ ...playerForm, email: e.target.value })}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    {t('edit.phone')}
                    <input
                      type="text"
                      value={playerForm.phone || ''}
                      onChange={(e) => setPlayerForm({ ...playerForm, phone: e.target.value })}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-sm text-slate-300 md:col-span-2">
                    {t('edit.skillLevel')}
                    <select
                      value={playerForm.skillLevel || ''}
                      onChange={(e) =>
                        setPlayerForm({
                          ...playerForm,
                          skillLevel: (e.target.value as SkillLevel) || undefined,
                        })
                      }
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    >
                      <option value="">{t('edit.selectSkillLevelOptional')}</option>
                      {skillLevelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {playersError && <p className="mt-3 text-sm text-rose-300">{playersError}</p>}

                <div className="mt-4 flex flex-wrap justify-end gap-3">
                  {editingPlayerId && (
                    <button
                      onClick={cancelEditPlayer}
                      className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                    >
                      {t('edit.cancelEdit')}
                    </button>
                  )}
                  <button
                    onClick={autoFillPlayers}
                    disabled={isRegisteringPlayer || isAutoFillingPlayers}
                    className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-60"
                  >
                    {isAutoFillingPlayers ? t('edit.filling') : t('edit.autoFillPlayers')}
                  </button>
                  <button
                    onClick={editingPlayerId ? savePlayerEdit : registerPlayer}
                    disabled={isRegisteringPlayer || isAutoFillingPlayers}
                    className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:opacity-60"
                  >
                    {playerActionLabel}
                  </button>
                </div>

                <div className="mt-6 space-y-2">
                  <h5 className="text-sm font-semibold text-slate-200">{t('edit.registeredPlayers')}</h5>
                  <RegistrationPlayersList
                    players={players}
                    playersLoading={playersLoading}
                    t={t}
                    onEdit={startEditPlayer}
                    onRemove={removePlayer}
                  />
                </div>
              </div>
            )}

            {normalizeStatus(editingTournament.status) === 'SIGNATURE' && (
              <div className="mt-8 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-white">{t('edit.signatureCheckIn')}</h4>
                    <p className="text-sm text-slate-400">
                      {t('edit.confirmPresence')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={confirmAllPlayers}
                      disabled={isConfirmingAll || players.every((player) => player.checkedIn)}
                      className="rounded-full border border-emerald-500/70 px-4 py-1.5 text-xs font-semibold text-emerald-200 hover:border-emerald-300 disabled:opacity-60"
                    >
                      {isConfirmingAll ? t('edit.confirming') : t('edit.confirmAll')}
                    </button>
                    <button
                      onClick={() => fetchPlayers(editingTournament.id)}
                      className="rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
                    >
                      {t('common.refresh')}
                    </button>
                  </div>
                </div>

                {playersError && <p className="mt-3 text-sm text-rose-300">{playersError}</p>}

                <div className="mt-6 space-y-2">
                  <h5 className="text-sm font-semibold text-slate-200">{t('edit.registeredPlayers')}</h5>
                  <SignaturePlayersList
                    players={players}
                    playersLoading={playersLoading}
                    t={t}
                    checkingInPlayerId={checkingInPlayerId}
                    onToggleCheckIn={togglePlayerCheckIn}
                  />
                </div>
              </div>
            )}

              {editError && (
                <p className="text-sm text-rose-300">{editError}</p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeEdit}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                {t('common.cancel')}
              </button>
              {normalizeStatus(editingTournament.status) === 'OPEN' && (
                <button
                  onClick={moveToSignature}
                  disabled={isSaving}
                  className="rounded-full border border-indigo-500/70 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:border-indigo-300 disabled:opacity-60"
                >
                  {t('edit.moveToSignature')}
                </button>
              )}
              {normalizeStatus(editingTournament.status) === 'SIGNATURE' && (
                <button
                  onClick={moveToLive}
                  disabled={
                    isSaving ||
                    players.length === 0 ||
                    !players.every((player) => player.checkedIn)
                  }
                  className="rounded-full border border-emerald-500/70 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
                >
                  {t('edit.startLive')}
                </button>
              )}
              <button
                onClick={openRegistration}
                disabled={isSaving || normalizeStatus(editingTournament.status) === 'OPEN'}
                className="rounded-full border border-cyan-500/70 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 disabled:opacity-60"
              >
                {normalizeStatus(editingTournament.status) === 'OPEN'
                  ? t('edit.registrationOpen')
                  : t('edit.openRegistration')}
              </button>
              <button
                onClick={saveEdit}
                disabled={isSaving}
                className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {isSaving ? t('edit.saving') : t('edit.saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPoolStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6">
          <div className="flex w-full max-w-3xl max-h-[85vh] flex-col rounded-3xl border border-slate-800/70 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{t('edit.poolPlayersTitle')}</h3>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mt-1">
                  {editingPoolStage.name}
                </p>
              </div>
              <button
                onClick={closePoolStageAssignments}
                className="text-sm text-slate-400 hover:text-white"
              >
                {t('edit.close')}
              </button>
            </div>

            {poolStageEditError && (
              <p className="mt-4 text-sm text-rose-300">{poolStageEditError}</p>
            )}

            <div className="mt-5 flex-1 space-y-4 overflow-y-auto pr-1">
              {poolStagePools.length === 0 ? (
                <p className="text-sm text-slate-400">{t('edit.noPoolsAvailable')}</p>
              ) : (
                poolStagePools.map((pool) => (
                  <div key={pool.id} className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{pool.name}</p>
                        <p className="text-xs text-slate-500">{t('edit.poolNumber')} {pool.poolNumber}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {Array.from({ length: editingPoolStage.playersPerPool }, (_, slot) => slot + 1).map((slotNumber) => {
                        const index = slotNumber - 1;
                        const value = poolStageAssignments[pool.id]?.[index] || '';
                        return (
                          <label key={`${pool.id}-slot-${slotNumber}`} className="text-xs text-slate-400">
                            {t('edit.slot')} {slotNumber}
                            <select
                              value={value}
                              onChange={(e) => updatePoolStageAssignment(pool.id, index, e.target.value)}
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            >
                              <option value="">{t('edit.unassigned')}</option>
                              {poolStagePlayers.map((player) => {
                                const label = player.name || `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim() || player.playerId;
                                return (
                                  <option key={player.playerId} value={player.playerId}>
                                    {label}
                                  </option>
                                );
                              })}
                            </select>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={closePoolStageAssignments}
                className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-200 hover:border-slate-500"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={savePoolStageAssignments}
                disabled={isSavingAssignments}
                className="rounded-full border border-emerald-500/60 px-4 py-2 text-xs font-semibold text-emerald-200 hover:border-emerald-300 disabled:opacity-60"
              >
                {isSavingAssignments ? t('edit.saving') : t('edit.saveAssignments')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TournamentList;