import { useState, useEffect, useMemo } from 'react';
import { useOptionalAuth } from '../auth/optionalAuth';
import { TournamentFormat, DurationType, SkillLevel, BracketType, BracketStatus, StageStatus } from '@shared/types';
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
  type CreatePlayerPayload,
  type TournamentPlayer,
  type PoolStageConfig,
  type BracketConfig,
} from '../services/tournamentService';

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

function TournamentList() {
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useOptionalAuth();
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
    email: '',
    phone: '',
    skillLevel: undefined,
  });

  const formatOptions = useMemo(
    () => [
      { value: TournamentFormat.SINGLE, label: 'Single' },
      { value: TournamentFormat.DOUBLE, label: 'Double' },
      { value: TournamentFormat.TEAM_4_PLAYER, label: 'Team (4 players)' },
    ],
    []
  );

  const durationOptions = useMemo(
    () => [
      { value: DurationType.HALF_DAY_MORNING, label: 'Half day morning' },
      { value: DurationType.HALF_DAY_AFTERNOON, label: 'Half day afternoon' },
      { value: DurationType.HALF_DAY_NIGHT, label: 'Half day night' },
      { value: DurationType.FULL_DAY, label: 'Full day' },
      { value: DurationType.TWO_DAY, label: 'Two day' },
    ],
    []
  );

  const skillLevelOptions = useMemo(
    () => [
      { value: SkillLevel.BEGINNER, label: 'Beginner' },
      { value: SkillLevel.INTERMEDIATE, label: 'Intermediate' },
      { value: SkillLevel.ADVANCED, label: 'Advanced' },
      { value: SkillLevel.EXPERT, label: 'Expert' },
    ],
    []
  );

  const statusFilter = useMemo(() => {
    if (typeof window === 'undefined') return 'ALL';
    const params = new URLSearchParams(window.location.search);
    return params.get('status')?.toUpperCase() || 'ALL';
  }, []);

  const normalizeStatus = (status?: string) => {
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
  };

  const normalizedStatusFilter = statusFilter === 'ALL' ? 'ALL' : normalizeStatus(statusFilter);

  const toLocalInput = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (v: number) => String(v).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  const fetchTournaments = async () => {
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
  };

  useEffect(() => {
    if (!authEnabled || isAuthenticated) {
      fetchTournaments();
    }
  }, [authEnabled, isAuthenticated]);

  useEffect(() => {
    if (!editingTournament) return;
    const normalizedStatus = normalizeStatus(editingTournament.status);
    if (normalizedStatus === 'OPEN' || normalizedStatus === 'SIGNATURE') {
      void fetchPlayers(editingTournament.id);
    }
  }, [editingTournament]);

  const createTournament = async () => {
    const name = prompt('Tournament name:');
    if (!name) return;

    try {
      const startTime = new Date(Date.now() + 60 * 60 * 1000);
      const endTime = new Date(Date.now() + 5 * 60 * 60 * 1000);
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
      email: '',
      phone: '',
      skillLevel: undefined,
    });
  };

  const fetchPlayers = async (tournamentId: string) => {
    setPlayersLoading(true);
    setPlayersError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const data = await fetchTournamentPlayers(tournamentId, token);
      setPlayers(data);
    } catch (err) {
      console.error('Error fetching players:', err);
      setPlayersError('Failed to load players');
    } finally {
      setPlayersLoading(false);
    }
  };

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
      setEditError(err instanceof Error ? err.message : 'Failed to upload logo');
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
      setPoolStagesError(err instanceof Error ? err.message : 'Failed to load pool stages');
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
      setBracketsError(err instanceof Error ? err.message : 'Failed to load brackets');
    }
  };

  const addPoolStage = async () => {
    if (!editingTournament) return;
    if (!newPoolStage.name.trim()) {
      setPoolStagesError('Stage name is required');
      return;
    }
    setPoolStagesError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await createPoolStage(editingTournament.id, newPoolStage, token);
      await loadPoolStages(editingTournament.id);
      setNewPoolStage((current) => ({ ...current, name: '' }));
    } catch (err) {
      setPoolStagesError(err instanceof Error ? err.message : 'Failed to add pool stage');
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
      setPoolStagesError(err instanceof Error ? err.message : 'Failed to update pool stage');
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
      setPoolStagesError(err instanceof Error ? err.message : 'Failed to delete pool stage');
    }
  };

  const addBracket = async () => {
    if (!editingTournament) return;
    if (!newBracket.name.trim()) {
      setBracketsError('Bracket name is required');
      return;
    }
    setBracketsError(null);
    try {
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      await createBracket(editingTournament.id, newBracket, token);
      await loadBrackets(editingTournament.id);
      setNewBracket((current) => ({ ...current, name: '' }));
    } catch (err) {
      setBracketsError(err instanceof Error ? err.message : 'Failed to add bracket');
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
      setBracketsError(err instanceof Error ? err.message : 'Failed to update bracket');
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
      setBracketsError(err instanceof Error ? err.message : 'Failed to delete bracket');
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
          email: playerForm.email?.trim() || undefined,
          phone: playerForm.phone?.trim() || undefined,
          skillLevel: playerForm.skillLevel,
        },
        token
      );
      setPlayerForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        skillLevel: undefined,
      });
      await fetchPlayers(editingTournament.id);
    } catch (err) {
      console.error('Error registering player:', err);
      setPlayersError(err instanceof Error ? err.message : 'Failed to register player');
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
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}@example.com`,
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
      setPlayersError(err instanceof Error ? err.message : 'Failed to auto-fill players');
    } finally {
      setIsAutoFillingPlayers(false);
    }
  };

  const startEditPlayer = (player: TournamentPlayer) => {
    setEditingPlayerId(player.playerId);
    setPlayerForm({
      firstName: player.firstName || player.name.split(' ')[0] || '',
      lastName: player.lastName || player.name.split(' ').slice(1).join(' ') || '',
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
      setPlayersError(err instanceof Error ? err.message : 'Failed to update player');
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
      setPlayersError(err instanceof Error ? err.message : 'Failed to remove player');
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
      setPlayersError(err instanceof Error ? err.message : 'Failed to update check-in');
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
      setPlayersError(err instanceof Error ? err.message : 'Failed to confirm all players');
    } finally {
      setIsConfirmingAll(false);
    }
  };

  const saveEdit = async () => {
    if (!editingTournament || !editForm) return;
    if (!editForm.name.trim()) {
      setEditError('Name is required');
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
      setEditError(err instanceof Error ? err.message : 'Failed to update tournament');
    } finally {
      setIsSaving(false);
    }
  };

  const openRegistration = async () => {
    if (!editingTournament) return;
    if (normalizeStatus(editingTournament.status) === 'OPEN') {
      setEditError('Registration is already open for this tournament.');
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
      setEditError(err instanceof Error ? err.message : 'Failed to open registration');
    } finally {
      setIsSaving(false);
    }
  };

  const moveToSignature = async () => {
    if (!editingTournament) return;
    if (normalizeStatus(editingTournament.status) !== 'OPEN') {
      setEditError('Tournament must be open to move to signature.');
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
      setEditError(err instanceof Error ? err.message : 'Failed to move to signature');
    } finally {
      setIsSaving(false);
    }
  };

  const moveToLive = async () => {
    if (!editingTournament) return;
    if (normalizeStatus(editingTournament.status) !== 'SIGNATURE') {
      setEditError('Tournament must be in signature to start live.');
      return;
    }
    if (players.length === 0 || !players.every((player) => player.checkedIn)) {
      setEditError('All players must be confirmed before starting live.');
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
      setEditError(err instanceof Error ? err.message : 'Failed to start live');
    } finally {
      setIsSaving(false);
    }
  };

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
          <p className="text-xs uppercase tracking-widest text-slate-500">Players</p>
          <p className="mt-2 text-lg font-semibold text-white">{tournament.totalParticipants}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-500">Status</p>
          <p className="mt-2 text-lg font-semibold text-white">{tournament.status}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        {normalizeStatus(tournament.status) === 'LIVE' && (
          <a
            href={`/?view=live&tournamentId=${tournament.id}`}
            className="rounded-full border border-emerald-500/60 px-4 py-1.5 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300"
          >
            View live
          </a>
        )}
        <button
          onClick={() => openEdit(tournament)}
          className="rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
        >
          Edit
        </button>
        <button
          onClick={() => deleteTournament(tournament.id)}
          className="rounded-full border border-rose-500/60 px-4 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
        >
          Delete
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
        <span className="ml-3 text-slate-300">Checking session...</span>
      </div>
    );
  }

  if (authEnabled && !isAuthenticated) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
        <h3 className="text-xl font-semibold text-white">Sign in to view tournaments</h3>
        <p className="mt-2 text-sm text-slate-300">
          Your tournaments are protected. Please sign in to continue.
        </p>
        <button
          onClick={() => loginWithRedirect()}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
        >
          Sign in
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
        <span className="ml-3 text-slate-300">Loading tournaments...</span>
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
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Tournament hub</p>
          <h2 className="text-2xl font-semibold text-white mt-2">
            Tournaments <span className="text-slate-400">({tournaments.length})</span>
          </h2>
        </div>
        <button
          onClick={createTournament}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
        >
          + Create Tournament
        </button>
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-700 p-10 text-center text-slate-300">
          <p className="text-lg font-semibold text-white">No tournaments yet</p>
          <p className="mt-2">Create your first tournament to start tracking matches and standings.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {statusFilter === 'ALL' ? (
            ([
              { title: 'Draft tournaments', status: 'DRAFT' },
              { title: 'Registration open', status: 'OPEN' },
            ] as const).map((group) => {
              const groupItems = tournaments.filter(
                (tournament) => normalizeStatus(tournament.status) === group.status
              );

              return (
                <div key={group.status} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{group.title}</h3>
                    <span className="text-sm text-slate-400">{groupItems.length}</span>
                  </div>
                  {groupItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                      No tournaments in this category yet.
                    </div>
                  ) : (
                    <div className="grid gap-6 lg:grid-cols-2">
                      {groupItems.map(renderCard)}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            (() => {
              const filteredTournaments = tournaments.filter(
                (tournament) => normalizeStatus(tournament.status) === normalizedStatusFilter
              );

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                      {normalizedStatusFilter === 'DRAFT' ? 'Draft tournaments' : 'Registration open'}
                    </h3>
                    <span className="text-sm text-slate-400">{filteredTournaments.length}</span>
                  </div>
                  {filteredTournaments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                      No tournaments in this category yet.
                    </div>
                  ) : (
                    <div className="grid gap-6 lg:grid-cols-2">
                      {filteredTournaments.map(renderCard)}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}

      {editingTournament && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6">
          <div className="flex w-full max-w-2xl max-h-[85vh] flex-col rounded-3xl border border-slate-800/70 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Edit tournament</h3>
              <button
                onClick={closeEdit}
                className="text-sm text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-6 flex-1 space-y-6 overflow-y-auto pr-1">
              <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-300">
                Name
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                Format
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
                Duration type
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
                Participants
                <input
                  type="number"
                  value={editForm.totalParticipants}
                  onChange={(e) => setEditForm({ ...editForm, totalParticipants: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                Start time
                <input
                  type="datetime-local"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                End time
                <input
                  type="datetime-local"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                Target count
                <input
                  type="number"
                  value={editForm.targetCount}
                  onChange={(e) => setEditForm({ ...editForm, targetCount: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
              </label>
              </div>

              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
                <h4 className="text-base font-semibold text-white">Tournament details</h4>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Status</p>
                    <p className="mt-2 text-sm text-slate-200">{editingTournament.status}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Historical flag</p>
                    <p className="mt-2 text-sm text-slate-200">
                      {editingTournament.historicalFlag ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Created</p>
                    <p className="mt-2 text-sm text-slate-200">
                      {editingTournament.createdAt
                        ? new Date(editingTournament.createdAt).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Completed</p>
                    <p className="mt-2 text-sm text-slate-200">
                      {editingTournament.completedAt
                        ? new Date(editingTournament.completedAt).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Logo</p>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    {editingTournament.logoUrl ? (
                      <img
                        src={editingTournament.logoUrl}
                        alt="Tournament logo"
                        className="h-16 w-16 rounded-xl border border-slate-700 object-cover"
                      />
                    ) : (
                      <div className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-slate-700 text-xs text-slate-500">
                        No logo
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
                        {isUploadingLogo ? 'Uploading...' : 'Upload logo'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-base font-semibold text-white">Pool stages</h4>
                  <button
                    onClick={() => editingTournament && loadPoolStages(editingTournament.id)}
                    className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                  >
                    Refresh
                  </button>
                </div>
                {poolStagesError && (
                  <p className="mt-3 text-sm text-rose-300">{poolStagesError}</p>
                )}
                <div className="mt-4 space-y-3">
                  {poolStages.length === 0 ? (
                    <p className="text-sm text-slate-400">No pool stages yet.</p>
                  ) : (
                    poolStages.map((stage) => (
                      <div key={stage.id} className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4">
                        <div className="grid gap-3 md:grid-cols-5">
                          <label className="text-xs text-slate-400">
                            Stage #
                            <input
                              type="number"
                              value={stage.stageNumber}
                              onChange={(e) =>
                                setPoolStages((current) =>
                                  current.map((item) =>
                                    item.id === stage.id
                                      ? { ...item, stageNumber: Number(e.target.value) }
                                      : item
                                  )
                                )
                              }
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            />
                          </label>
                          <label className="text-xs text-slate-400 md:col-span-2">
                            Name
                            <input
                              type="text"
                              value={stage.name}
                              onChange={(e) =>
                                setPoolStages((current) =>
                                  current.map((item) =>
                                    item.id === stage.id
                                      ? { ...item, name: e.target.value }
                                      : item
                                  )
                                )
                              }
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            />
                          </label>
                          <label className="text-xs text-slate-400">
                            Pools
                            <input
                              type="number"
                              value={stage.poolCount}
                              onChange={(e) =>
                                setPoolStages((current) =>
                                  current.map((item) =>
                                    item.id === stage.id
                                      ? { ...item, poolCount: Number(e.target.value) }
                                      : item
                                  )
                                )
                              }
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            />
                          </label>
                          <label className="text-xs text-slate-400">
                            Per pool
                            <input
                              type="number"
                              value={stage.playersPerPool}
                              onChange={(e) =>
                                setPoolStages((current) =>
                                  current.map((item) =>
                                    item.id === stage.id
                                      ? { ...item, playersPerPool: Number(e.target.value) }
                                      : item
                                  )
                                )
                              }
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            />
                          </label>
                          <label className="text-xs text-slate-400">
                            Advance
                            <input
                              type="number"
                              value={stage.advanceCount}
                              onChange={(e) =>
                                setPoolStages((current) =>
                                  current.map((item) =>
                                    item.id === stage.id
                                      ? { ...item, advanceCount: Number(e.target.value) }
                                      : item
                                  )
                                )
                              }
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            />
                          </label>
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <select
                            value={stage.status}
                            onChange={(e) =>
                              (() => {
                                const nextStatus = e.target.value;
                                setPoolStages((current) =>
                                  current.map((item) =>
                                    item.id === stage.id
                                      ? { ...item, status: nextStatus }
                                      : item
                                  )
                                );
                                void savePoolStage({ ...stage, status: nextStatus });
                              })()
                            }
                            className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
                          >
                            {Object.values(StageStatus).map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => savePoolStage(stage)}
                            className="rounded-full border border-cyan-500/60 px-3 py-1 text-xs text-cyan-200 hover:border-cyan-300"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => removePoolStage(stage.id)}
                            className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-5">
                  <label className="text-xs text-slate-400">
                    Stage #
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
                    Name
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
                    Pools
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
                    Per pool
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
                    Advance
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
                    Add stage
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-base font-semibold text-white">Brackets</h4>
                  <button
                    onClick={() => editingTournament && loadBrackets(editingTournament.id)}
                    className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                  >
                    Refresh
                  </button>
                </div>
                {bracketsError && (
                  <p className="mt-3 text-sm text-rose-300">{bracketsError}</p>
                )}
                <div className="mt-4 space-y-3">
                  {brackets.length === 0 ? (
                    <p className="text-sm text-slate-400">No brackets yet.</p>
                  ) : (
                    brackets.map((bracket) => (
                      <div key={bracket.id} className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4">
                        <div className="grid gap-3 md:grid-cols-4">
                          <label className="text-xs text-slate-400 md:col-span-2">
                            Name
                            <input
                              type="text"
                              value={bracket.name}
                              onChange={(e) =>
                                setBrackets((current) =>
                                  current.map((item) =>
                                    item.id === bracket.id
                                      ? { ...item, name: e.target.value }
                                      : item
                                  )
                                )
                              }
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            />
                          </label>
                          <label className="text-xs text-slate-400">
                            Type
                            <select
                              value={bracket.bracketType}
                              onChange={(e) =>
                                setBrackets((current) =>
                                  current.map((item) =>
                                    item.id === bracket.id
                                      ? { ...item, bracketType: e.target.value }
                                      : item
                                  )
                                )
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
                            Rounds
                            <input
                              type="number"
                              value={bracket.totalRounds}
                              onChange={(e) =>
                                setBrackets((current) =>
                                  current.map((item) =>
                                    item.id === bracket.id
                                      ? { ...item, totalRounds: Number(e.target.value) }
                                      : item
                                  )
                                )
                              }
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                            />
                          </label>
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <select
                            value={bracket.status}
                            onChange={(e) =>
                              setBrackets((current) =>
                                current.map((item) =>
                                  item.id === bracket.id
                                    ? { ...item, status: e.target.value }
                                    : item
                                )
                              )
                            }
                            className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
                          >
                            {Object.values(BracketStatus).map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => saveBracket(bracket)}
                            className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs text-emerald-200 hover:border-emerald-300"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => removeBracket(bracket.id)}
                            className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <label className="text-xs text-slate-400 md:col-span-2">
                    Name
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
                    Type
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
                    Rounds
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
                    Add bracket
                  </button>
                </div>
              </div>

            {normalizeStatus(editingTournament.status) === 'OPEN' && (
              <div className="mt-8 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-white">Player registration</h4>
                    <p className="text-sm text-slate-400">
                      {players.length} of {editingTournament.totalParticipants} spots filled
                    </p>
                  </div>
                  <button
                    onClick={() => fetchPlayers(editingTournament.id)}
                    className="rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
                  >
                    Refresh
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-sm text-slate-300">
                    First name
                    <input
                      type="text"
                      value={playerForm.firstName}
                      onChange={(e) => setPlayerForm({ ...playerForm, firstName: e.target.value })}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    Last name
                    <input
                      type="text"
                      value={playerForm.lastName}
                      onChange={(e) => setPlayerForm({ ...playerForm, lastName: e.target.value })}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    Email
                    <input
                      type="email"
                      value={playerForm.email || ''}
                      onChange={(e) => setPlayerForm({ ...playerForm, email: e.target.value })}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    Phone
                    <input
                      type="text"
                      value={playerForm.phone || ''}
                      onChange={(e) => setPlayerForm({ ...playerForm, phone: e.target.value })}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-sm text-slate-300 md:col-span-2">
                    Skill level
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
                      <option value="">Select level (optional)</option>
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
                      Cancel edit
                    </button>
                  )}
                  <button
                    onClick={autoFillPlayers}
                    disabled={isRegisteringPlayer || isAutoFillingPlayers}
                    className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-60"
                  >
                    {isAutoFillingPlayers ? 'Filling...' : 'Auto-fill players'}
                  </button>
                  <button
                    onClick={editingPlayerId ? savePlayerEdit : registerPlayer}
                    disabled={isRegisteringPlayer || isAutoFillingPlayers}
                    className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:opacity-60"
                  >
                    {isRegisteringPlayer || isAutoFillingPlayers
                      ? 'Saving...'
                      : editingPlayerId
                      ? 'Save changes'
                      : 'Add player'}
                  </button>
                </div>

                <div className="mt-6 space-y-2">
                  <h5 className="text-sm font-semibold text-slate-200">Registered players</h5>
                  {playersLoading ? (
                    <p className="text-sm text-slate-400">Loading players...</p>
                  ) : players.length === 0 ? (
                    <p className="text-sm text-slate-400">No players registered yet.</p>
                  ) : (
                    <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
                      {players.map((player) => (
                        <div
                          key={player.playerId}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/60 bg-slate-950/50 px-4 py-2 text-sm"
                        >
                          <div>
                            <p className="text-slate-100">{player.name}</p>
                            <p className="text-xs text-slate-500">
                              {player.email || 'No email'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {player.skillLevel && (
                              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                                {player.skillLevel}
                              </span>
                            )}
                            <button
                              onClick={() => startEditPlayer(player)}
                              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => removePlayer(player.playerId)}
                              className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {normalizeStatus(editingTournament.status) === 'SIGNATURE' && (
              <div className="mt-8 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-white">Signature check-in</h4>
                    <p className="text-sm text-slate-400">
                      Confirm presence for all registered players
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={confirmAllPlayers}
                      disabled={isConfirmingAll || players.length === 0 || players.every((player) => player.checkedIn)}
                      className="rounded-full border border-emerald-500/70 px-4 py-1.5 text-xs font-semibold text-emerald-200 hover:border-emerald-300 disabled:opacity-60"
                    >
                      {isConfirmingAll ? 'Confirming...' : 'Confirm all'}
                    </button>
                    <button
                      onClick={() => fetchPlayers(editingTournament.id)}
                      className="rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                {playersError && <p className="mt-3 text-sm text-rose-300">{playersError}</p>}

                <div className="mt-6 space-y-2">
                  <h5 className="text-sm font-semibold text-slate-200">Registered players</h5>
                  {playersLoading ? (
                    <p className="text-sm text-slate-400">Loading players...</p>
                  ) : players.length === 0 ? (
                    <p className="text-sm text-slate-400">No players registered yet.</p>
                  ) : (
                    <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
                      {players.map((player) => (
                        <div
                          key={player.playerId}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/60 bg-slate-950/50 px-4 py-2 text-sm"
                        >
                          <div>
                            <p className="text-slate-100">{player.name}</p>
                            <p className="text-xs text-slate-500">
                              {player.email || 'No email'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {player.checkedIn && (
                              <span className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs text-emerald-200">
                                Present
                              </span>
                            )}
                            <button
                              onClick={() => togglePlayerCheckIn(player)}
                              disabled={checkingInPlayerId === player.playerId}
                              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-60"
                            >
                              {checkingInPlayerId === player.playerId
                                ? 'Saving...'
                                : player.checkedIn
                                ? 'Undo'
                                : '✓ Confirm'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                Cancel
              </button>
              {normalizeStatus(editingTournament.status) === 'OPEN' && (
                <button
                  onClick={moveToSignature}
                  disabled={isSaving}
                  className="rounded-full border border-indigo-500/70 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:border-indigo-300 disabled:opacity-60"
                >
                  Move to signature
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
                  Start live
                </button>
              )}
              <button
                onClick={openRegistration}
                disabled={isSaving || normalizeStatus(editingTournament.status) === 'OPEN'}
                className="rounded-full border border-cyan-500/70 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 disabled:opacity-60"
              >
                {normalizeStatus(editingTournament.status) === 'OPEN'
                  ? 'Registration open'
                  : 'Open registration'}
              </button>
              <button
                onClick={saveEdit}
                disabled={isSaving}
                className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TournamentList;