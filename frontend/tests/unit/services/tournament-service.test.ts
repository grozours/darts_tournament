import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  completeMatch,
  completePoolStageWithScores,
  completeBracketRoundWithScores,
  createBracket,
  createPoolStage,
  createTournament,
  deletePoolStage,
  deleteBracket,
  fetchBrackets,
  fetchTournamentTargets,
  fetchOrphanPlayers,
  fetchPoolStagePools,
  fetchTournamentLiveView,
  fetchTournamentPresets,
  fetchMatchFormatPresets,
  fetchPoolStages,
  fetchTournamentPlayers,
  createTournamentPreset,
  updateTournamentPreset,
  deleteTournamentPreset,
  createMatchFormatPreset,
  updateMatchFormatPreset,
  deleteMatchFormatPreset,
  registerTournamentPlayer,
  removeTournamentPlayer,
  updateBracket,
  saveMatchScores,
  resetPoolMatches,
  updatePoolAssignments,
  updatePoolStage,
  recomputeDoubleStageProgression,
  populateBracketFromPools,
  resetBracketMatches,
  updateBracketTargets,
  updateTournament,
  unregisterTournamentPlayer,
  updateTournamentPlayer,
  updateTournamentPlayerCheckIn,
  updateMatchStatus,
  updateTournamentStatus,
  uploadTournamentLogo,
} from '../../../src/services/tournament-service';

type MockFetch = ReturnType<typeof vi.fn>;

const mockFetch = vi.fn() as MockFetch;
const jsonHeaders = { get: () => 'application/json' };

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('tournament-service create/update', () => {
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
});

describe('tournament-service pools and matches', () => {
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
});

describe('tournament-service deletions', () => {
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
});

describe('tournament-service player updates', () => {
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
});

describe('tournament-service bracket operations', () => {
  it('handles bracket operations and score updates', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ brackets: [{ id: 'b-1' }] }) });
    await expect(fetchBrackets('t-1')).resolves.toEqual([{ id: 'b-1' }]);

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'b-2' }) });
    await expect(createBracket('t-1', { name: 'Main', bracketType: 'SINGLE', totalRounds: 2 }))
      .resolves.toEqual({ id: 'b-2' });

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'b-2' }) });
    await expect(updateBracket('t-1', 'b-2', { name: 'Updated' })).resolves.toEqual({ id: 'b-2' });

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Score update failed' });
    await expect(saveMatchScores('t-1', 'm-1', [{ playerId: 'p-1', scoreTotal: 2 }]))
      .rejects.toThrow('Score update failed');

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Round failed' });
    await expect(completeBracketRoundWithScores('t-1', 'b-1', 1)).rejects.toThrow('Round failed');
  });
});

describe('tournament-service live view', () => {
  it('fetches live view and orphan players', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, headers: jsonHeaders, json: async () => ({ id: 't-1' }) });
    await expect(fetchTournamentLiveView('t-1')).resolves.toEqual({ id: 't-1' });

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ players: [{ playerId: 'p-1' }] }) });
    await expect(fetchOrphanPlayers()).resolves.toEqual([{ playerId: 'p-1' }]);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      headers: jsonHeaders,
      json: async () => ({ message: 'Live view failed' }),
      text: async () => 'Live view failed',
    });
    await expect(fetchTournamentLiveView('t-1')).rejects.toThrow('Live view failed');
  });
});

describe('tournament-service presets and match formats', () => {
  it('handles tournament presets fetch and CRUD operations', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ presets: [{ id: 'preset-1', name: 'Preset' }] }),
    });
    await expect(fetchTournamentPresets('token-1')).resolves.toEqual([{ id: 'preset-1', name: 'Preset' }]);

    const fetchPresetsRequest = mockFetch.mock.calls[0]?.[1] as RequestInit;
    expect(fetchPresetsRequest.headers).toEqual({ Authorization: 'Bearer token-1' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'preset-2', name: 'Preset 2' }),
    });
    await expect(createTournamentPreset({
      name: 'Preset 2',
      presetType: 'custom',
      totalParticipants: 16,
      targetCount: 4,
    }, 'token-2')).resolves.toEqual({ id: 'preset-2', name: 'Preset 2' });

    const createPresetRequest = mockFetch.mock.calls[1]?.[1] as RequestInit;
    expect(createPresetRequest.method).toBe('POST');
    expect(createPresetRequest.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-2',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'preset-2', name: 'Preset 2 Updated' }),
    });
    await expect(updateTournamentPreset('preset-2', { name: 'Preset 2 Updated' }))
      .resolves.toEqual({ id: 'preset-2', name: 'Preset 2 Updated' });

    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(deleteTournamentPreset('preset-2')).resolves.toBeUndefined();
  });

  it('parses API errors for presets and match formats', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: { message: 'Preset already exists', code: 'PRESET_EXISTS' } }),
    });

    await expect(createTournamentPreset({
      name: 'Duplicate',
      presetType: 'custom',
      totalParticipants: 16,
      targetCount: 4,
    })).rejects.toMatchObject({
      message: 'Preset already exists',
      code: 'PRESET_EXISTS',
      status: 409,
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: { get: () => 'text/plain' },
      text: async () => '{"message":"Delete match format blocked","code":"FORMAT_BLOCKED"}',
    });

    await expect(deleteMatchFormatPreset('format-1')).rejects.toMatchObject({
      message: 'Delete match format blocked',
      code: 'FORMAT_BLOCKED',
      status: 400,
    });
  });

  it('handles match formats fetch and update paths', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ presets: [{ id: 'fmt-1', key: 'BO3' }] }),
    });
    await expect(fetchMatchFormatPresets()).resolves.toEqual([{ id: 'fmt-1', key: 'BO3' }]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'fmt-2', key: 'BO5' }),
    });
    await expect(createMatchFormatPreset({
      key: 'BO5',
      durationMinutes: 20,
      segments: [{ game: '501_DO', targetCount: 2 }],
    })).resolves.toEqual({ id: 'fmt-2', key: 'BO5' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'fmt-2', key: 'BO5_F' }),
    });
    await expect(updateMatchFormatPreset('fmt-2', { key: 'BO5_F' }, 'token-x'))
      .resolves.toEqual({ id: 'fmt-2', key: 'BO5_F' });

    const updateRequest = mockFetch.mock.calls[2]?.[1] as RequestInit;
    expect(updateRequest.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-x',
    });
  });
});

describe('tournament-service additional operations', () => {
  it('handles target and assignment operations', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ targets: [{ id: 'tg-1', targetNumber: 1 }] }) });
    await expect(fetchTournamentTargets('t-1')).resolves.toEqual([{ id: 'tg-1', targetNumber: 1 }]);

    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(resetPoolMatches('t-1', 's-1', 'p-1', 'token-z')).resolves.toBeUndefined();

    const resetRequest = mockFetch.mock.calls[1]?.[1] as RequestInit;
    expect(resetRequest.headers).toEqual({ Authorization: 'Bearer token-z' });

    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(updatePoolAssignments('t-1', 's-1', [{ poolId: 'p-1', playerId: 'pl-1', assignmentType: 'AUTO' }]))
      .resolves.toBeUndefined();

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Assignments failed' });
    await expect(updatePoolAssignments('t-1', 's-1', [])).rejects.toThrow('Assignments failed');
  });

  it('handles stage and bracket helper operations', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 's-1', name: 'Updated stage' }) });
    await expect(updatePoolStage('t-1', 's-1', { name: 'Updated stage' })).resolves.toEqual({
      id: 's-1',
      name: 'Updated stage',
    });

    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(recomputeDoubleStageProgression('t-1', 's-1')).resolves.toBeUndefined();

    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(populateBracketFromPools('t-1', 'b-1', 's-1', undefined)).resolves.toBeUndefined();

    const populateRequest = mockFetch.mock.calls[2]?.[1] as RequestInit;
    expect(populateRequest.body).toBe(JSON.stringify({ stageId: 's-1' }));

    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(resetBracketMatches('t-1', 'b-1')).resolves.toBeUndefined();

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'b-1', targetIds: ['t1'] }) });
    await expect(updateBracketTargets('t-1', 'b-1', ['t1'])).resolves.toEqual({ id: 'b-1', targetIds: ['t1'] });

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Populate failed' });
    await expect(populateBracketFromPools('t-1', 'b-1', 's-1', 'WINNER')).rejects.toThrow('Populate failed');
  });

  it('covers remaining service failure branches', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => '' });
    await expect(fetchTournamentTargets('t-1')).rejects.toThrow('Failed to fetch tournament targets');

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => '' });
    await expect(fetchPoolStagePools('t-1', 's-1')).rejects.toThrow('Failed to fetch pool stage pools');

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => '' });
    await expect(registerTournamentPlayer('t-1', { firstName: 'A', lastName: 'B' }))
      .rejects.toThrow('Failed to register player');

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => '' });
    await expect(updateTournamentPlayer('t-1', 'p-1', { firstName: 'A', lastName: 'B' }))
      .rejects.toThrow('Failed to update player');

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => '' });
    await expect(createPoolStage('t-1', {
      stageNumber: 1,
      name: 'S1',
      poolCount: 2,
      playersPerPool: 4,
      advanceCount: 2,
      losersAdvanceToBracket: false,
    })).rejects.toThrow('Failed to create pool stage');

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => '' });
    await expect(updatePoolStage('t-1', 's-1', { name: 'x' }))
      .rejects.toThrow('Failed to update pool stage');

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => '' });
    await expect(completePoolStageWithScores('t-1', 's-1')).rejects.toThrow('Failed to complete pool stage');

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => '' });
    await expect(recomputeDoubleStageProgression('t-1', 's-1'))
      .rejects.toThrow('Failed to recompute double-stage progression');

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => '' });
    await expect(resetPoolMatches('t-1', 's-1', 'p-1')).rejects.toThrow('Failed to reset pool matches');

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => '' });
    await expect(resetBracketMatches('t-1', 'b-1')).rejects.toThrow('Failed to reset bracket matches');

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => '' });
    await expect(updateBracketTargets('t-1', 'b-1', ['x'])).rejects.toThrow('Failed to update bracket targets');

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => '' });
    await expect(fetchBrackets('t-1')).rejects.toThrow('Failed to fetch brackets');
  });
});
