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
  email?: string;
  phone?: string;
  skillLevel?: SkillLevel;
}

export interface TournamentPlayer {
  playerId: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email?: string;
  phone?: string;
  skillLevel?: SkillLevel;
  registeredAt?: string;
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
    throw new Error('Failed to create tournament');
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
    throw new Error('Failed to update tournament');
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
    throw new Error('Failed to update tournament status');
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
