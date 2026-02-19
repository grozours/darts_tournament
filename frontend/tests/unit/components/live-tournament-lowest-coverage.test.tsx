import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import useLiveTournamentLoaders from '../../../src/components/live-tournament/use-live-tournament-loaders';
import useLiveTournamentMatchUpdate from '../../../src/components/live-tournament/use-live-tournament-match-update';
import useLiveTournamentSelection from '../../../src/components/live-tournament/use-live-tournament-selection';
import useLiveTournamentTargets from '../../../src/components/live-tournament/use-live-tournament-targets';
import useLiveTournamentStageDrafts from '../../../src/components/live-tournament/use-live-tournament-stage-drafts';
import useLiveTournamentStageUpdate from '../../../src/components/live-tournament/use-live-tournament-stage-update';
import useLiveTournamentParameters from '../../../src/components/live-tournament/use-live-tournament-parameters';
import useLiveTournamentBracketActions from '../../../src/components/live-tournament/use-live-tournament-bracket-actions';
import LiveTournamentGate from '../../../src/components/live-tournament/live-tournament-gate';
import MatchQueueSection from '../../../src/components/live-tournament/match-queue-section';
import type { LiveViewData, LiveViewMatch } from '../../../src/components/live-tournament/types';

const serviceMocks = vi.hoisted(() => ({
  fetchTournamentLiveView: vi.fn(),
  updateMatchStatus: vi.fn(),
  completeMatch: vi.fn(),
  updateCompletedMatchScores: vi.fn(),
  updatePoolStage: vi.fn(),
  deletePoolStage: vi.fn(),
  completePoolStageWithScores: vi.fn(),
  completeBracketRoundWithScores: vi.fn(),
}));

vi.mock('../../../src/services/tournament-service', () => ({
  fetchTournamentLiveView: serviceMocks.fetchTournamentLiveView,
  updateMatchStatus: serviceMocks.updateMatchStatus,
  completeMatch: serviceMocks.completeMatch,
  updateCompletedMatchScores: serviceMocks.updateCompletedMatchScores,
  updatePoolStage: serviceMocks.updatePoolStage,
  deletePoolStage: serviceMocks.deletePoolStage,
  completePoolStageWithScores: serviceMocks.completePoolStageWithScores,
  completeBracketRoundWithScores: serviceMocks.completeBracketRoundWithScores,
}));

vi.mock('../../../src/auth/sign-in-panel', () => ({
  default: ({ title, description }: { title: string; description: string }) => (
    <div>
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

type HookHarnessProps<T> = {
  useHook: () => T;
  onUpdate: (value: T) => void;
};

const HookHarness = <T,>({ useHook, onUpdate }: HookHarnessProps<T>) => {
  const value = useHook();
  useEffect(() => {
    onUpdate(value);
  }, [value, onUpdate]);
  return null;
};

const makeMatch = (id: string, status: string): LiveViewMatch => ({
  id,
  matchNumber: 1,
  roundNumber: 1,
  status,
});

describe('live tournament lowest coverage targets', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    serviceMocks.fetchTournamentLiveView.mockReset();
    serviceMocks.updateMatchStatus.mockReset();
    serviceMocks.completeMatch.mockReset();
    serviceMocks.updateCompletedMatchScores.mockReset();
    serviceMocks.updatePoolStage.mockReset();
    serviceMocks.deletePoolStage.mockReset();
    serviceMocks.completePoolStageWithScores.mockReset();
    serviceMocks.completeBracketRoundWithScores.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('selects pool stage defaults when no tournament id is provided', async () => {
    let latest: ReturnType<typeof useLiveTournamentSelection> | undefined;
    const liveViews: LiveViewData[] = [
      {
        id: 't1',
        name: 'One',
        status: 'LIVE',
        poolStages: [
          {
            id: 's1',
            stageNumber: 1,
            name: 'Stage 1',
            status: 'IN_PROGRESS',
            pools: [{ id: 'p1', poolNumber: 1, name: 'Pool 1', status: 'IN_PROGRESS' }],
          },
        ],
        brackets: [],
      },
      {
        id: 't2',
        name: 'Two',
        status: 'LIVE',
        poolStages: [],
        brackets: [],
      },
    ];

    render(
      <HookHarness
        useHook={() => useLiveTournamentSelection({
          viewMode: 'pool-stages',
          viewStatus: 'LIVE',
          tournamentId: undefined,
          liveViews,
          isAdmin: false,
        })}
        onUpdate={(value) => {
          latest = value;
        }}
      />
    );

    await waitFor(() => {
      expect(latest?.selectedPoolStagesTournamentId).toBe('t1');
    });
    expect(latest?.displayedLiveViews.map((view) => view.id)).toEqual(['t1']);
  });

  it('builds available targets and updates selections', async () => {
    let latest: ReturnType<typeof useLiveTournamentTargets> | undefined;
    const liveViews: LiveViewData[] = [
      {
        id: 't1',
        name: 'One',
        status: 'LIVE',
        poolStages: [
          {
            id: 's1',
            stageNumber: 1,
            name: 'Stage 1',
            status: 'IN_PROGRESS',
            pools: [
              {
                id: 'p1',
                poolNumber: 1,
                name: 'Pool 1',
                status: 'IN_PROGRESS',
                matches: [
                  { id: 'm1', matchNumber: 1, roundNumber: 1, status: 'COMPLETED' },
                ],
              },
            ],
          },
        ],
        brackets: [],
        targets: [
          { id: 'target-1', targetNumber: 1, status: 'IN_USE' },
          { id: 'target-2', targetNumber: 2, status: 'MAINTENANCE' },
          { id: 'target-3', targetNumber: 3, status: 'IN_USE', currentMatchId: 'm1' },
          { id: 'target-4', targetNumber: 4, status: 'AVAILABLE' },
        ],
      },
    ];

    render(
      <HookHarness
        useHook={() => useLiveTournamentTargets({ liveViews })}
        onUpdate={(value) => {
          latest = value;
        }}
      />
    );

    await waitFor(() => {
      const available = latest?.availableTargetsByTournament.get('t1') ?? [];
      expect(available.map((target) => target.id)).toEqual(['target-3', 'target-4']);
    });

    expect(latest?.getTargetIdForSelection('t1', '4')).toBe('target-4');
    expect(latest?.getTargetIdForSelection('t1', 'nope')).toBeUndefined();

    act(() => {
      latest?.handleTargetSelectionChange('match-key', 'target-4');
    });
    await waitFor(() => {
      expect(latest?.matchTargetSelections).toEqual({ 'match-key': 'target-4' });
    });

    act(() => {
      latest?.clearMatchTargetSelection('match-key');
    });
    await waitFor(() => {
      expect(latest?.matchTargetSelections).toEqual({});
    });
  });

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
          tournamentId: undefined,
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

  it('updates match status and completion flows', async () => {
    let latest: ReturnType<typeof useLiveTournamentMatchUpdate> | undefined;
    const getSafeAccessToken = vi.fn().mockResolvedValue('token');
    const reloadLiveViews = vi.fn().mockResolvedValue(undefined);
    const setError = vi.fn();
    const clearMatchTargetSelection = vi.fn();
    const onUpdatedCompletedMatch = vi.fn();

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
          onUpdatedCompletedMatch,
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
      await latest?.handleUpdateCompletedMatch('t1', match);
    });

    expect(serviceMocks.updateCompletedMatchScores).toHaveBeenCalledWith('t1', 'm1', [
      { playerId: 'p1', scoreTotal: 10 },
      { playerId: 'p2', scoreTotal: 15 },
    ], 'token');
    expect(onUpdatedCompletedMatch).toHaveBeenCalled();
    expect(reloadLiveViews).toHaveBeenCalledWith({ showLoader: false });
    expect(setError).toHaveBeenCalledWith(undefined);
    expect(setError.mock.calls.some(([value]) => typeof value === 'string' && value.length > 0)).toBe(false);
  });

  it('reports validation errors before completing matches', async () => {
    let latest: ReturnType<typeof useLiveTournamentMatchUpdate> | undefined;
    const setError = vi.fn();

    render(
      <HookHarness
        useHook={() => useLiveTournamentMatchUpdate({
          getSafeAccessToken: vi.fn().mockResolvedValue('token'),
          reloadLiveViews: vi.fn().mockResolvedValue(undefined),
          setError,
          getMatchKey: (tournamentId, matchId) => `${tournamentId}:${matchId}`,
          matchScores: {},
          clearMatchTargetSelection: vi.fn(),
          onUpdatedCompletedMatch: vi.fn(),
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

  it('renders gate states for auth, error, and selection', () => {
    const t = (key: string) => key;

    const { rerender } = render(
      <LiveTournamentGate
        authLoading={true}
        authEnabled={false}
        isAuthenticated={false}
        authError={undefined}
        tournamentId={undefined}
        requireTournamentId={false}
        loading={false}
        error={undefined}
        onRetry={vi.fn()}
        t={t}
      />
    );

    expect(screen.getByText('auth.checkingSession')).toBeInTheDocument();

    globalThis.window?.history.pushState({}, '', '/?code=abc');
    rerender(
      <LiveTournamentGate
        authLoading={false}
        authEnabled={true}
        isAuthenticated={false}
        authError={undefined}
        tournamentId={undefined}
        requireTournamentId={false}
        loading={false}
        error={undefined}
        onRetry={vi.fn()}
        t={t}
      />
    );

    expect(screen.getByText('auth.signInToViewLive')).toBeInTheDocument();
    expect(screen.getByText('Auth callback detected but session not established.')).toBeInTheDocument();

    rerender(
      <LiveTournamentGate
        authLoading={false}
        authEnabled={true}
        isAuthenticated={true}
        authError={new Error('boom')}
        tournamentId="t1"
        requireTournamentId={false}
        loading={false}
        error={undefined}
        onRetry={vi.fn()}
        t={t}
      />
    );

    expect(screen.getByText('auth.signInFailed')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('manages stage drafts and updates', async () => {
    let drafts: ReturnType<typeof useLiveTournamentStageDrafts> | undefined;
    const stage = {
      id: 'stage-1',
      stageNumber: 1,
      name: 'Stage 1',
      status: 'IN_PROGRESS',
      pools: [
        { id: 'p1', poolNumber: 1, name: 'Pool 1', status: 'IN_PROGRESS' },
        { id: 'p2', poolNumber: 2, name: 'Pool 2', status: 'IN_PROGRESS' },
      ],
      playersPerPool: 4,
    };

    render(
      <HookHarness
        useHook={() => useLiveTournamentStageDrafts()}
        onUpdate={(value) => {
          drafts = value;
        }}
      />
    );

    act(() => {
      drafts?.handleEditStage(stage);
    });

    await waitFor(() => {
      expect(drafts?.editingStageId).toBe('stage-1');
      expect(drafts?.stageStatusDrafts['stage-1']).toBe('IN_PROGRESS');
      expect(drafts?.stagePoolCountDrafts['stage-1']).toBe('2');
      expect(drafts?.stagePlayersPerPoolDrafts['stage-1']).toBe('4');
    });

    act(() => {
      drafts?.handleStageStatusChange('stage-1', 'COMPLETED');
      drafts?.handleStagePoolCountChange('stage-1', '3');
      drafts?.handleStagePlayersPerPoolChange('stage-1', '5');
    });

    await waitFor(() => {
      expect(drafts?.stageStatusDrafts['stage-1']).toBe('COMPLETED');
      expect(drafts?.stagePoolCountDrafts['stage-1']).toBe('3');
      expect(drafts?.stagePlayersPerPoolDrafts['stage-1']).toBe('5');
    });

    act(() => {
      drafts?.cancelEditStage();
    });

    await waitFor(() => {
      expect(drafts?.editingStageId).toBeUndefined();
    });
  });

  it('updates, deletes, and completes pool stages', async () => {
    let latest: ReturnType<typeof useLiveTournamentStageUpdate> | undefined;
    const reloadLiveViews = vi.fn().mockResolvedValue(undefined);
    const setError = vi.fn();
    const onFinishEdit = vi.fn();
    const getSafeAccessToken = vi.fn().mockResolvedValue('token');
    const stage = {
      id: 'stage-1',
      stageNumber: 1,
      name: 'Stage 1',
      status: 'IN_PROGRESS',
    };

    const originalConfirm = globalThis.confirm;
    const confirmSpy = vi.fn().mockReturnValue(true);
    globalThis.confirm = confirmSpy as typeof confirm;

    render(
      <HookHarness
        useHook={() => useLiveTournamentStageUpdate({
          t: (key: string) => key,
          getSafeAccessToken,
          reloadLiveViews,
          setError,
          stageStatusDrafts: { 'stage-1': 'COMPLETED' },
          stagePoolCountDrafts: { 'stage-1': '3' },
          stagePlayersPerPoolDrafts: { 'stage-1': '5' },
          onFinishEdit,
        })}
        onUpdate={(value) => {
          latest = value;
        }}
      />
    );

    await act(async () => {
      await latest?.handleUpdateStage('t1', stage);
    });

    expect(serviceMocks.updatePoolStage).toHaveBeenCalledWith('t1', 'stage-1', {
      status: 'COMPLETED',
      poolCount: 3,
      playersPerPool: 5,
    }, 'token');
    expect(onFinishEdit).toHaveBeenCalled();

    await act(async () => {
      await latest?.handleDeleteStage('t1', stage);
    });

    expect(serviceMocks.deletePoolStage).toHaveBeenCalledWith('t1', 'stage-1', 'token');

    await act(async () => {
      await latest?.handleCompleteStageWithScores('t1', stage);
    });

    expect(serviceMocks.completePoolStageWithScores).toHaveBeenCalledWith('t1', 'stage-1', 'token');
    expect(confirmSpy).toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(undefined);
    globalThis.confirm = originalConfirm;
  });

  it('reads live tournament parameters from the URL', async () => {
    let latest: ReturnType<typeof useLiveTournamentParameters> | undefined;
    globalThis.window?.history.pushState({}, '', '/?view=pool-stages&status=LIVE&tournamentId=t-1');

    render(
      <HookHarness
        useHook={() => useLiveTournamentParameters()}
        onUpdate={(value) => {
          latest = value;
        }}
      />
    );

    await waitFor(() => {
      expect(latest?.viewMode).toBe('pool-stages');
      expect(latest?.viewStatus).toBe('LIVE');
      expect(latest?.tournamentId).toBe('t-1');
      expect(latest?.isAggregateView).toBe(false);
    });
  });

  it('completes bracket rounds and selects brackets', async () => {
    let latest: ReturnType<typeof useLiveTournamentBracketActions> | undefined;
    const reloadLiveViews = vi.fn().mockResolvedValue(undefined);
    const setError = vi.fn();

    render(
      <HookHarness
        useHook={() => useLiveTournamentBracketActions({
          getSafeAccessToken: vi.fn().mockResolvedValue('token'),
          reloadLiveViews,
          setError,
        })}
        onUpdate={(value) => {
          latest = value;
        }}
      />
    );

    const bracket = {
      id: 'b1',
      name: 'Bracket',
      bracketType: 'MAIN',
      status: 'IN_PROGRESS',
      matches: [
        makeMatch('m1', 'IN_PROGRESS'),
        { ...makeMatch('m2', 'SCHEDULED'), roundNumber: 2 },
      ],
    };

    await act(async () => {
      await latest?.handleCompleteBracketRound('t1', bracket);
    });

    expect(serviceMocks.completeBracketRoundWithScores).toHaveBeenCalledWith('t1', 'b1', 1, 'token');
    expect(reloadLiveViews).toHaveBeenCalledWith({ showLoader: false });

    act(() => {
      latest?.handleSelectBracket('t1', 'b1');
    });

    await waitFor(() => {
      expect(latest?.activeBracketByTournament).toEqual({ t1: 'b1' });
    });

    const emptyBracket = {
      id: 'b2',
      name: 'Empty',
      bracketType: 'MAIN',
      status: 'IN_PROGRESS',
      matches: [makeMatch('m3', 'COMPLETED')],
    };

    await act(async () => {
      await latest?.handleCompleteBracketRound('t1', emptyBracket);
    });

    expect(setError).toHaveBeenCalledWith('No matches available to complete in this bracket round.');
  });

  it('renders match queue items and start actions', () => {
    const onStartMatch = vi.fn();
    const onTargetSelectionChange = vi.fn();
    const queue = [
      {
        tournamentId: 't1',
        tournamentName: 'Open',
        stageId: 's1',
        stageName: 'Stage 1',
        stageNumber: 1,
        poolId: 'p1',
        poolName: 'Pool 1',
        poolNumber: 1,
        matchId: 'm1',
        matchNumber: 1,
        roundNumber: 1,
        status: 'SCHEDULED',
        targetNumber: 3,
        players: ['Ava', 'Bea'],
        match: makeMatch('m1', 'SCHEDULED'),
      },
    ];

    render(
      <MatchQueueSection
        t={(key) => key}
        queue={queue}
        showTournamentName={true}
        availableTargetsByTournament={new Map([
          ['t1', [{ id: 'target-3', targetNumber: 3 }]],
        ])}
        matchTargetSelections={{ 't1:m1': '3' }}
        updatingMatchId={undefined}
        isPoolStagesReadonly={false}
        getMatchKey={(tournamentId, matchId) => `${tournamentId}:${matchId}`}
        getTargetIdForSelection={() => 'target-3'}
        onTargetSelectionChange={onTargetSelectionChange}
        onStartMatch={onStartMatch}
        getStatusLabel={(_, status) => status ?? ''}
        formatTargetLabel={(value) => value}
        getTargetLabel={(target) => String(target.targetNumber)}
      />
    );

    expect(screen.getByText('live.queue.title')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'live.startMatch' });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(onStartMatch).toHaveBeenCalledWith('t1', 'm1', 'target-3');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '3' } });
    expect(onTargetSelectionChange).toHaveBeenCalledWith('t1:m1', '3');
  });
});
