import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { render } from '@testing-library/react';
import { getServiceMocks } from './live-tournament/live-tournament-test-mocks';
import { HookHarness } from './live-tournament/live-tournament-hook-harness';
import useLiveTournamentLoaders from '../../../src/components/live-tournament/use-live-tournament-loaders';
import useLiveTournamentMatchUpdate from '../../../src/components/live-tournament/use-live-tournament-match-update';
import type { LiveViewMatch } from '../../../src/components/live-tournament/types';

const serviceMocks = getServiceMocks();

const originalFetch = globalThis.fetch;

beforeEach(() => {
  serviceMocks.fetchTournamentLiveView.mockReset();
  serviceMocks.updateMatchStatus.mockReset();
  serviceMocks.completeMatch.mockReset();
  serviceMocks.saveMatchScores.mockReset();
  serviceMocks.updatePoolStage.mockReset();
  serviceMocks.deletePoolStage.mockReset();
  serviceMocks.completePoolStageWithScores.mockReset();
  serviceMocks.completeBracketRoundWithScores.mockReset();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('live tournament loaders', () => {
  it('loads live views for single and aggregate modes', async () => {
    let latest: ReturnType<typeof useLiveTournamentLoaders> | undefined;
    const getSafeAccessToken = vi.fn().mockResolvedValue('token');

    serviceMocks.fetchTournamentLiveView.mockResolvedValue({ id: 't1', name: 'One', status: 'LIVE' });

    const { rerender } = render(
      <HookHarness
        useHook={() => useLiveTournamentLoaders({
          getSafeAccessToken,
          viewStatus: 'LIVE',
          tournamentId: 't1',
          isAggregateView: false,
        })}
        onUpdate={(value) => {
          latest = value;
        }}
      />
    );

    await act(async () => {
      await latest?.reloadLiveViews();
    });

    expect(serviceMocks.fetchTournamentLiveView).toHaveBeenCalledWith('t1', 'token');
    expect(latest?.liveViews).toHaveLength(1);
    serviceMocks.fetchTournamentLiveView.mockClear();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tournaments: [
          { id: 't1', status: 'LIVE' },
          { id: 't2', status: 'LIVE' },
          { id: 't3', status: 'SIGNATURE' },
        ],
      }),
    }) as typeof fetch;

    serviceMocks.fetchTournamentLiveView.mockResolvedValueOnce({ id: 't1', name: 'One', status: 'LIVE' });
    serviceMocks.fetchTournamentLiveView.mockResolvedValueOnce({ id: 't2', name: 'Two', status: 'LIVE' });

    rerender(
      <HookHarness
        useHook={() => useLiveTournamentLoaders({
          getSafeAccessToken,
          viewStatus: 'LIVE',
          isAggregateView: true,
        })}
        onUpdate={(value) => {
          latest = value;
        }}
      />
    );

    await act(async () => {
      await latest?.reloadLiveViews();
    });

    expect(serviceMocks.fetchTournamentLiveView).toHaveBeenCalledTimes(2);
    expect(serviceMocks.fetchTournamentLiveView).toHaveBeenCalledWith('t1', 'token');
    expect(serviceMocks.fetchTournamentLiveView).toHaveBeenCalledWith('t2', 'token');
    expect(latest?.liveViews).toHaveLength(2);
  });
});

describe('live tournament match updates', () => {
  it('updates match status and completion flows', async () => {
    let latest: ReturnType<typeof useLiveTournamentMatchUpdate> | undefined;
    const getSafeAccessToken = vi.fn().mockResolvedValue('token');
    const reloadLiveViews = vi.fn().mockImplementation(async () => {});
    const setError = vi.fn();
    const clearMatchTargetSelection = vi.fn();
    const onSavedMatchScores = vi.fn();

    const matchScores = {
      't1:m1': {
        p1: '10',
        p2: '15',
      },
    };

    render(
      <HookHarness
        useHook={() => useLiveTournamentMatchUpdate({
          getSafeAccessToken,
          reloadLiveViews,
          setError,
          getMatchKey: (tournamentId, matchId) => `${tournamentId}:${matchId}`,
          matchScores,
          clearMatchTargetSelection,
          onSavedMatchScores,
        })}
        onUpdate={(value) => {
          latest = value;
        }}
      />
    );

    await act(async () => {
      await latest?.handleMatchStatusUpdate('t1', 'm1', 'IN_PROGRESS', 'target-1');
    });

    expect(serviceMocks.updateMatchStatus).toHaveBeenCalledWith('t1', 'm1', 'IN_PROGRESS', 'target-1', 'token');
    expect(clearMatchTargetSelection).toHaveBeenCalledWith('t1:m1');

    const match: LiveViewMatch = {
      id: 'm1',
      matchNumber: 1,
      roundNumber: 1,
      status: 'IN_PROGRESS',
      playerMatches: [
        { player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' }, playerPosition: 1 },
        { player: { id: 'p2', firstName: 'Bea', lastName: 'Bell' }, playerPosition: 2 },
      ],
    };

    await act(async () => {
      await latest?.handleCompleteMatch('t1', match);
    });

    expect(serviceMocks.completeMatch).toHaveBeenCalledWith('t1', 'm1', [
      { playerId: 'p1', scoreTotal: 10 },
      { playerId: 'p2', scoreTotal: 15 },
    ], 'token');

    await act(async () => {
      await latest?.handleSaveMatchScores('t1', match);
    });

    expect(serviceMocks.saveMatchScores).toHaveBeenCalledWith('t1', 'm1', [
      { playerId: 'p1', scoreTotal: 10 },
      { playerId: 'p2', scoreTotal: 15 },
    ], 'token');
    expect(onSavedMatchScores).toHaveBeenCalled();
    expect(reloadLiveViews).toHaveBeenCalledWith({ showLoader: false });
    expect(setError.mock.calls[0]?.[0]).toBeUndefined();
    expect(setError.mock.calls.some(([value]) => typeof value === 'string' && value.length > 0)).toBe(false);
  });

  it('reports validation errors before completing matches', async () => {
    let latest: ReturnType<typeof useLiveTournamentMatchUpdate> | undefined;
    const setError = vi.fn();

    render(
      <HookHarness
        useHook={() => useLiveTournamentMatchUpdate({
          getSafeAccessToken: vi.fn().mockResolvedValue('token'),
          reloadLiveViews: vi.fn().mockImplementation(async () => {}),
          setError,
          getMatchKey: (tournamentId, matchId) => `${tournamentId}:${matchId}`,
          matchScores: {},
          clearMatchTargetSelection: vi.fn(),
          onSavedMatchScores: vi.fn(),
        })}
        onUpdate={(value) => {
          latest = value;
        }}
      />
    );

    const match: LiveViewMatch = {
      id: 'm2',
      matchNumber: 1,
      roundNumber: 1,
      status: 'PENDING',
      playerMatches: [],
    };

    await act(async () => {
      await latest?.handleCompleteMatch('t1', match);
    });

    expect(setError).toHaveBeenCalledWith('Match does not have enough players to complete.');
    expect(serviceMocks.completeMatch).not.toHaveBeenCalled();
  });
});
