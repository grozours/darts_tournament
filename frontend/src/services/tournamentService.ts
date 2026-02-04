import { TournamentFormat, DurationType } from '@shared/types';

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
