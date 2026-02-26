import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PoolStagesSection from '../../../../src/components/live-tournament/pool-stages-section';

const computeOptimisticStartTimesMock = vi.fn();
const capturedCards: Array<Record<string, unknown>> = [];

vi.mock('../../../../src/components/live-tournament/pool-stage-card', () => ({
  __esModule: true,
  default: (properties: Record<string, unknown>) => {
    capturedCards.push(properties);
    return <div data-testid="pool-stage-card">{String((properties.stage as { name?: string })?.name ?? '')}</div>;
  },
  computeOptimisticStartTimes: (...arguments_: unknown[]) => computeOptimisticStartTimesMock(...arguments_),
}));

vi.mock('../../../../src/utils/match-format-presets', () => ({
  getMatchFormatPresets: () => [{ key: 'BO3', durationMinutes: 15 }],
}));

describe('PoolStagesSection', () => {
  const baseProperties = {
    t: (key: string) => key,
    tournamentId: 't1',
    tournamentStartTime: '2030-01-01T10:00:00.000Z',
    tournamentStatus: 'LIVE',
    doubleStageEnabled: false,
    stages: [],
    isAdmin: true,
    isPoolStagesReadonly: false,
    getStatusLabel: (_scope: string, status?: string) => status ?? '',
    getMatchTargetLabel: () => 'Target',
    getTargetLabel: () => 'Target',
    matchScores: {},
    matchTargetSelections: {},
    updatingMatchId: undefined,
    resettingPoolId: undefined,
    editingMatchId: undefined,
    availableTargetsByTournament: new Map(),
    schedulableTargetCount: 2,
    getMatchKey: () => 'k',
    getTargetIdForSelection: () => undefined,
    onTargetSelectionChange: vi.fn(),
    onScoreChange: vi.fn(),
    onStartMatch: vi.fn(),
    onCompleteMatch: vi.fn(),
    onCancelMatch: vi.fn(),
    onEditMatch: vi.fn(),
    onSaveMatchScores: vi.fn(),
    onCancelMatchEdit: vi.fn(),
    onResetPoolMatches: vi.fn(),
    onEditStage: vi.fn(),
    onCancelEditStage: vi.fn(),
    onUpdateStage: vi.fn(),
    onCompleteStageWithScores: vi.fn(),
    onDeleteStage: vi.fn(),
    onRecomputeDoubleStage: vi.fn(),
    onStagePoolCountChange: vi.fn(),
    onStagePlayersPerPoolChange: vi.fn(),
    onStageStatusChange: vi.fn(),
    onLaunchStage: vi.fn(),
    onResetStage: vi.fn(),
    canDeleteStage: true,
    editingStageId: undefined,
    updatingStageId: undefined,
    stageStatusDrafts: {},
    stagePoolCountDrafts: {},
    stagePlayersPerPoolDrafts: {},
    playerIdByTournament: {},
  };

  beforeEach(() => {
    computeOptimisticStartTimesMock.mockReset();
    capturedCards.length = 0;
  });

  it('renders empty state when no stages are available', () => {
    render(<PoolStagesSection {...baseProperties} stages={[]} />);

    expect(screen.getByText('live.noPoolStages')).toBeTruthy();
    expect(screen.queryByTestId('pool-stage-card')).toBeNull();
  });

  it('renders stage cards and computes schedule with parallel groups', () => {
    const now = new Date('2030-01-01T10:00:00.000Z').getTime();
    computeOptimisticStartTimesMock.mockReturnValue({
      optimisticById: new Map([
        ['m1', '10:00'],
        ['m2', '10:10'],
      ]),
      finishTimestampByMatchId: new Map([
        ['m1', now + 10 * 60_000],
        ['m2', now + 20 * 60_000],
      ]),
      estimatedDurationMinutes: 20,
    });

    const stages = [
      {
        id: 's1',
        stageNumber: 1,
        name: 'Stage 1',
        status: 'IN_PROGRESS',
        playersPerPool: 4,
        inParallelWith: ['stage:2'],
        pools: [{ id: 'p1', poolNumber: 1, matches: [{ id: 'm1', status: 'SCHEDULED' }] }],
      },
      {
        id: 's2',
        stageNumber: 2,
        name: 'Stage 2',
        status: 'IN_PROGRESS',
        playersPerPool: 4,
        pools: [{ id: 'p2', poolNumber: 2, matches: [{ id: 'm2', status: 'SCHEDULED' }] }],
      },
    ];

    render(
      <PoolStagesSection
        {...baseProperties}
        stages={stages as never}
        playerIdByTournament={{ t1: 'player-42' }}
      />
    );

    expect(screen.getAllByTestId('pool-stage-card')).toHaveLength(2);
    expect(computeOptimisticStartTimesMock).toHaveBeenCalledTimes(1);
    const computeArguments = computeOptimisticStartTimesMock.mock.calls[0]?.[0] as {
      prioritizeLeastProgressedPools?: boolean;
      stagePlayersPerPool?: number;
    };
    expect(computeArguments.prioritizeLeastProgressedPools).toBe(true);
    expect(computeArguments.stagePlayersPerPool).toBe(4);

    expect(capturedCards[0]?.preferredPlayerId).toBe('player-42');
    expect(capturedCards[0]?.estimatedDurationMinutesOverride).toBe(10);
    expect(capturedCards[1]?.estimatedDurationMinutesOverride).toBe(20);
   });

  it('disables stage actions when source stages are not completed', () => {
    computeOptimisticStartTimesMock.mockReturnValue({
      optimisticById: new Map(),
      finishTimestampByMatchId: new Map(),
      estimatedDurationMinutes: 0,
    });

    const stages = [
      {
        id: 's1',
        stageNumber: 1,
        name: 'Stage 1',
        status: 'IN_PROGRESS',
        pools: [],
        rankingDestinations: [
          { destinationType: 'POOL_STAGE', poolStageId: 's2', position: 1 },
        ],
      },
      {
        id: 's2',
        stageNumber: 2,
        name: 'Stage 2',
        status: 'NOT_STARTED',
        pools: [],
      },
    ];

    render(<PoolStagesSection {...baseProperties} stages={stages as never} />);

    const stageOneCard = capturedCards.find((card) => (card.stage as { id?: string })?.id === 's1');
    const stageTwoCard = capturedCards.find((card) => (card.stage as { id?: string })?.id === 's2');

    expect(stageOneCard?.canManageStageActions).toBe(true);
    expect(stageTwoCard?.canManageStageActions).toBe(false);
  });
 });
