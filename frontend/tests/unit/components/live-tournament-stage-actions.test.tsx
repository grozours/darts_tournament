import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { getServiceMocks, makeMatch, translate } from './live-tournament/live-tournament-test-mocks';
import { HookHarness } from './live-tournament/live-tournament-hook-harness';
import useLiveTournamentStageUpdate from '../../../src/components/live-tournament/use-live-tournament-stage-update';
import useLiveTournamentParameters from '../../../src/components/live-tournament/use-live-tournament-parameters';
import useLiveTournamentBracketActions from '../../../src/components/live-tournament/use-live-tournament-bracket-actions';

const serviceMocks = getServiceMocks();

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

describe('live tournament stage updates', () => {
  it('updates, deletes, and completes pool stages', async () => {
    let latest: ReturnType<typeof useLiveTournamentStageUpdate> | undefined;
    const reloadLiveViews = vi.fn().mockImplementation(async () => {});
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
          t: translate,
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
    expect(setError.mock.calls[0]?.[0]).toBeUndefined();
    globalThis.confirm = originalConfirm;
  });
});

describe('live tournament parameters', () => {
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
});

describe('live tournament bracket actions', () => {
  it('completes bracket rounds and selects brackets', async () => {
    let latest: ReturnType<typeof useLiveTournamentBracketActions> | undefined;
    const reloadLiveViews = vi.fn().mockImplementation(async () => {});
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
});
