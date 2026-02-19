import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  completeMatch,
  createPoolStage,
  createTournament,
  deletePoolStage,
  deleteBracket,
  fetchBrackets,
  fetchOrphanPlayers,
  fetchPoolStagePools,
  fetchTournamentLiveView,
  fetchPoolStages,
  fetchTournamentPlayers,
  registerTournamentPlayer,
  removeTournamentPlayer,
  updateCompletedMatchScores,
  updateTournament,
  unregisterTournamentPlayer,
  updateTournamentPlayer,
  updateTournamentPlayerCheckIn,
  updateMatchStatus,
  updateTournamentStatus,
  uploadTournamentLogo,
  completePoolStageWithScores,
  createBracket,
  updateBracket,
  completeBracketRoundWithScores,
} from '../../../src/services/tournament-service';

type MockFetch = ReturnType<typeof vi.fn>;

describe('tournament-service', () => {
  const mockFetch = vi.fn() as MockFetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('creates tournaments and surfaces API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 't-1', name: 'Spring Cup' }),
    });

    await expect(createTournament({
      name: 'Spring Cup',
      format: 'SINGLE',
      durationType: 'FULL_DAY',
      startTime: '2026-04-01T10:00:00Z',
      endTime: '2026-04-01T18:00:00Z',
      totalParticipants: 16,
      targetCount: 4,
    })).resolves.toEqual({ id: 't-1', name: 'Spring Cup' });

    const request = mockFetch.mock.calls[0]?.[1] as RequestInit;
    expect(request?.method).toBe('POST');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid payload' }),
    });

    await expect(createTournament({
      name: 'Bad',
      format: 'SINGLE',
      durationType: 'FULL_DAY',
      startTime: 'bad',
      endTime: 'bad',
      totalParticipants: 2,
      targetCount: 1,
    })).rejects.toThrow('Failed to create tournament: Invalid payload');
  });

  it('updates tournament status and handles failures', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await expect(updateTournamentStatus('t-1', 'OPEN')).resolves.toBeUndefined();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'Status error',
    });

    await expect(updateTournamentStatus('t-1', 'OPEN')).rejects.toThrow('Status error');
  });

  it('updates and uploads tournaments', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 't-1', name: 'Updated' }),
    });

    await expect(updateTournament('t-1', { name: 'Updated' })).resolves.toEqual({
      id: 't-1',
      name: 'Updated',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ logo_url: 'cdn/logo.png' }),
    });

    await expect(uploadTournamentLogo('t-1', new File(['x'], 'logo.png'))).resolves.toEqual({
      logo_url: 'cdn/logo.png',
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'Update failed',
    });

    await expect(updateTournament('t-1', { name: 'Bad' })).rejects.toThrow('Update failed');
  });

  it('fetches tournament players and pool stages', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ players: [{ playerId: 'p-1', name: 'Ana' }] }),
    });

    await expect(fetchTournamentPlayers('t-1')).resolves.toEqual([
      { playerId: 'p-1', name: 'Ana' },
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ poolStages: [{ id: 's-1' }] }),
    });

    await expect(fetchPoolStages('t-1')).resolves.toEqual([{ id: 's-1' }]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pools: [{ id: 'p-1' }] }),
    });

    await expect(fetchPoolStagePools('t-1', 's-1')).resolves.toEqual([{ id: 'p-1' }]);
  });

  it('creates pool stages and updates matches', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 's-1' }),
    });

    await expect(createPoolStage('t-1', {
      stageNumber: 1,
      name: 'Stage 1',
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
      losersAdvanceToBracket: false,
    })).resolves.toEqual({ id: 's-1' });

    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(updateMatchStatus('t-1', 'm-1', 'IN_PROGRESS', 'target-1')).resolves.toBeUndefined();

    const updateMatchRequest = mockFetch.mock.calls[1]?.[1] as RequestInit;
    const updateBody = JSON.parse(updateMatchRequest?.body as string);
    expect(updateBody).toEqual({ status: 'IN_PROGRESS', targetId: 'target-1' });

    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(completeMatch('t-1', 'm-1', [{ playerId: 'p-1', scoreTotal: 3 }])).resolves.toBeUndefined();

    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(completePoolStageWithScores('t-1', 's-1')).resolves.toBeUndefined();
  });

  it('handles delete and unregister flows', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Delete failed' });
    await expect(deleteBracket('t-1', 'b-1')).rejects.toThrow('Delete failed');

    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(unregisterTournamentPlayer('t-1', 'p-1')).resolves.toBeUndefined();

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Remove failed' });
    await expect(removeTournamentPlayer('t-1', 'p-1')).rejects.toThrow('Remove failed');

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Pool stage delete failed' });
    await expect(deletePoolStage('t-1', 's-1')).rejects.toThrow('Pool stage delete failed');
  });

  it('handles player registrations and updates', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(registerTournamentPlayer('t-1', { firstName: 'Ana', lastName: 'Diaz' }))
      .resolves.toBeUndefined();

    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(updateTournamentPlayer('t-1', 'p-1', { firstName: 'Ana', lastName: 'Diaz' }))
      .resolves.toBeUndefined();

    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(updateTournamentPlayerCheckIn('t-1', 'p-1', true)).resolves.toBeUndefined();

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Check-in failed' });
    await expect(updateTournamentPlayerCheckIn('t-1', 'p-1', true)).rejects.toThrow('Check-in failed');
  });

  it('handles bracket operations and score updates', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ brackets: [{ id: 'b-1' }] }) });
    await expect(fetchBrackets('t-1')).resolves.toEqual([{ id: 'b-1' }]);

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'b-2' }) });
    await expect(createBracket('t-1', { name: 'Main', bracketType: 'SINGLE', totalRounds: 2 }))
      .resolves.toEqual({ id: 'b-2' });

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'b-2' }) });
    await expect(updateBracket('t-1', 'b-2', { name: 'Updated' })).resolves.toEqual({ id: 'b-2' });

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Score update failed' });
    await expect(updateCompletedMatchScores('t-1', 'm-1', [{ playerId: 'p-1', scoreTotal: 2 }]))
      .rejects.toThrow('Score update failed');

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Round failed' });
    await expect(completeBracketRoundWithScores('t-1', 'b-1', 1)).rejects.toThrow('Round failed');
  });

  it('fetches live view and orphan players', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 't-1' }) });
    await expect(fetchTournamentLiveView('t-1')).resolves.toEqual({ id: 't-1' });

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ players: [{ playerId: 'p-1' }] }) });
    await expect(fetchOrphanPlayers()).resolves.toEqual([{ playerId: 'p-1' }]);

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Live view failed' });
    await expect(fetchTournamentLiveView('t-1')).rejects.toThrow('Live view failed');
  });
});
