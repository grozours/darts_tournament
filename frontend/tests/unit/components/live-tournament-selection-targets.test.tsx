import { describe, expect, it, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import useLiveTournamentSelection from '../../../src/components/live-tournament/use-live-tournament-selection';
import useLiveTournamentTargets from '../../../src/components/live-tournament/use-live-tournament-targets';
import type { LiveViewData } from '../../../src/components/live-tournament/types';
import { HookHarness } from './live-tournament/live-tournament-hook-harness';
import { getServiceMocks } from './live-tournament/live-tournament-test-mocks';

const serviceMocks = getServiceMocks();

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

describe('live tournament selection', () => {
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
            pools: [
              {
                id: 'p1',
                poolNumber: 1,
                name: 'Pool 1',
                status: 'IN_PROGRESS',
                assignments: [{ id: 'a1', player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' } }],
              },
            ],
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
          liveViews,
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
});

describe('live tournament targets', () => {
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
});
