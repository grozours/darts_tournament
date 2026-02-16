import { TournamentFormat, DurationType, SkillLevel } from '@shared/types';

export interface CreateTournamentPayload {
  name: string;
  format: TournamentFormat | string;
  durationType: DurationType | string;
  startTime: string;
  endTime: string;
  totalParticipants: number;
  targetCount: number;
}

export interface CreateTournamentResponse {
  id: string;
  name?: string;
}

export interface CreatePlayerPayload {
  firstName: string;
  lastName: string;
  surname?: string;
  teamName?: string;
  email?: string;
  phone?: string;
  skillLevel?: SkillLevel;
}

export interface TournamentPlayer {
  playerId: string;
  personId?: string;
  firstName?: string;
  lastName?: string;
  surname?: string;
  teamName?: string;
  name: string;
  email?: string;
  phone?: string;
  skillLevel?: SkillLevel;
  registeredAt?: string;
  checkedIn?: boolean;
}

export interface PoolStageConfig {
  id: string;
  tournamentId: string;
  stageNumber: number;
  name: string;
  poolCount: number;
  playersPerPool: number;
  advanceCount: number;
  status: string;
}

export interface BracketConfig {
  id: string;
  tournamentId: string;
  name: string;
  bracketType: string;
  totalRounds: number;
  status: string;
}

export interface PoolAssignmentPlayer {
  id: string;
  firstName?: string;
  lastName?: string;
}

export interface PoolAssignmentInfo {
  id: string;
  playerId: string;
  player: PoolAssignmentPlayer;
}

export interface PoolStagePool {
  id: string;
  poolNumber: number;
  name: string;
  assignments?: PoolAssignmentInfo[];
}

export interface PoolAssignmentPayload {
  poolId: string;
  playerId: string;
  assignmentType: string;
  seedNumber?: number;
}

export async function createTournament(
  payload: CreateTournamentPayload,
  token?: string
): Promise<CreateTournamentResponse> {
  const response = await fetch('/api/tournaments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
    throw new Error(`Failed to create tournament: ${errorMessage}`);
  }

  return response.json();
}

export async function uploadTournamentLogo(
  tournamentId: string,
  file: File,
  token?: string
): Promise<{ logo_url: string } | void> {
  const formData = new FormData();
  formData.append('logo', file);

  const response = await fetch(`/api/tournaments/${tournamentId}/logo`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload tournament logo');
  }

  return response.json();
}

export async function updateTournament(
  tournamentId: string,
  payload: Partial<CreateTournamentPayload>,
  token?: string
): Promise<CreateTournamentResponse> {
  const response = await fetch(`/api/tournaments/${tournamentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to update tournament');
  }

  return response.json();
}

export async function updateTournamentStatus(
  tournamentId: string,
  status: string,
  token?: string
): Promise<void> {
  const response = await fetch(`/api/tournaments/${tournamentId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to update tournament status');
  }
}

export async function fetchTournamentPlayers(
  tournamentId: string,
  token?: string
): Promise<TournamentPlayer[]> {
  const response = await fetch(`/api/tournaments/${tournamentId}/players`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch tournament players');
  }

  const data = await response.json();
  return data.players || [];
}

export async function fetchOrphanPlayers(token?: string): Promise<TournamentPlayer[]> {
  const response = await fetch('/api/tournaments/players/orphans', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to fetch orphan players');
  }

  const data = await response.json();
  return data.players || [];
}

export async function fetchTournamentLiveView(
  tournamentId: string,
  token?: string
): Promise<unknown> {
  const response = await fetch(`/api/tournaments/${tournamentId}/live`, {
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to fetch live tournament view');
  }

  return response.json();
}

export async function fetchPoolStagePools(
  tournamentId: string,
  stageId: string,
  token?: string
): Promise<PoolStagePool[]> {
  const response = await fetch(`/api/tournaments/${tournamentId}/pool-stages/${stageId}/pools`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to fetch pool stage pools');
  }

  const data = await response.json();
  return data.pools || [];
}

export async function updatePoolAssignments(
  tournamentId: string,
  stageId: string,
  assignments: PoolAssignmentPayload[],
  token?: string
): Promise<void> {
  const response = await fetch(`/api/tournaments/${tournamentId}/pool-stages/${stageId}/assignments`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ assignments }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to update pool assignments');
  }
}

export async function registerTournamentPlayer(
  tournamentId: string,
  payload: CreatePlayerPayload,
  token?: string
): Promise<void> {
  const response = await fetch(`/api/tournaments/${tournamentId}/players`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to register player');
  }
}

export async function updateTournamentPlayer(
  tournamentId: string,
  playerId: string,
  payload: CreatePlayerPayload,
  token?: string
): Promise<void> {
  const response = await fetch(`/api/tournaments/${tournamentId}/players/${playerId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to update player');
  }
}

export async function updateTournamentPlayerCheckIn(
  tournamentId: string,
  playerId: string,
  checkedIn: boolean,
  token?: string
): Promise<void> {
  const response = await fetch(`/api/tournaments/${tournamentId}/players/${playerId}/check-in`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ checkedIn }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to update player check-in');
  }
}

export async function fetchPoolStages(
  tournamentId: string,
  token?: string
): Promise<PoolStageConfig[]> {
  const response = await fetch(`/api/tournaments/${tournamentId}/pool-stages`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to fetch pool stages');
  }

  const data = await response.json();
  return data.poolStages || [];
}

export async function createPoolStage(
  tournamentId: string,
  payload: Omit<PoolStageConfig, 'id' | 'tournamentId' | 'status'>,
  token?: string
): Promise<PoolStageConfig> {
  const response = await fetch(`/api/tournaments/${tournamentId}/pool-stages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to create pool stage');
  }

  return response.json();
}

export async function updatePoolStage(
  tournamentId: string,
  stageId: string,
  payload: Partial<Omit<PoolStageConfig, 'id' | 'tournamentId'>>,
  token?: string
): Promise<PoolStageConfig> {
  const response = await fetch(`/api/tournaments/${tournamentId}/pool-stages/${stageId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to update pool stage');
  }

  return response.json();
}

export async function completePoolStageWithScores(
  tournamentId: string,
  stageId: string,
  token?: string
): Promise<void> {
  const response = await fetch(`/api/tournaments/${tournamentId}/pool-stages/${stageId}/complete`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to complete pool stage');
  }
}

export async function updateMatchStatus(
  tournamentId: string,
  matchId: string,
  status: string,
  targetId?: string,
  token?: string
): Promise<void> {
  const response = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ status, ...(targetId ? { targetId } : {}) }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to update match status');
  }
}

export async function completeMatch(
  tournamentId: string,
  matchId: string,
  scores: Array<{ playerId: string; scoreTotal: number }>,
  token?: string
): Promise<void> {
  const response = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/complete`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ scores }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to complete match');
  }
}

export async function updateCompletedMatchScores(
  tournamentId: string,
  matchId: string,
  scores: Array<{ playerId: string; scoreTotal: number }>,
  token?: string
): Promise<void> {
  const response = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/scores`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ scores }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to update match scores');
  }
}

export async function completeBracketRoundWithScores(
  tournamentId: string,
  bracketId: string,
  roundNumber: number,
  token?: string
): Promise<void> {
  const response = await fetch(`/api/tournaments/${tournamentId}/brackets/${bracketId}/rounds/${roundNumber}/complete`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to complete bracket round');
  }
}

export async function deletePoolStage(
  tournamentId: string,
  stageId: string,
  token?: string
): Promise<void> {
  const response = await fetch(`/api/tournaments/${tournamentId}/pool-stages/${stageId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to delete pool stage');
  }
}

export async function fetchBrackets(
  tournamentId: string,
  token?: string
): Promise<BracketConfig[]> {
  const response = await fetch(`/api/tournaments/${tournamentId}/brackets`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to fetch brackets');
  }

  const data = await response.json();
  return data.brackets || [];
}

export async function createBracket(
  tournamentId: string,
  payload: Omit<BracketConfig, 'id' | 'tournamentId' | 'status'>,
  token?: string
): Promise<BracketConfig> {
  const response = await fetch(`/api/tournaments/${tournamentId}/brackets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to create bracket');
  }

  return response.json();
}

export async function updateBracket(
  tournamentId: string,
  bracketId: string,
  payload: Partial<Omit<BracketConfig, 'id' | 'tournamentId'>>,
  token?: string
): Promise<BracketConfig> {
  const response = await fetch(`/api/tournaments/${tournamentId}/brackets/${bracketId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to update bracket');
  }

  return response.json();
}

export async function deleteBracket(
  tournamentId: string,
  bracketId: string,
  token?: string
): Promise<void> {
  const response = await fetch(`/api/tournaments/${tournamentId}/brackets/${bracketId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to delete bracket');
  }
}

export async function removeTournamentPlayer(
  tournamentId: string,
  playerId: string,
  token?: string
): Promise<void> {
  const response = await fetch(`/api/tournaments/${tournamentId}/players/${playerId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to remove player');
  }
}
