import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PoolStageCard, { computeOptimisticStartTimes } from '../../../src/components/live-tournament/pool-stage-card';

vi.mock('../../../src/components/live-tournament/match-score-inputs', () => ({
  default: () => <div>match-score-inputs</div>,
}));

vi.mock('../../../src/components/live-tournament/match-target-selector', () => ({
  default: () => <div>match-target-selector</div>,
}));

const baseProperties = {
  t: (key: string) => key,
  tournamentId: 't1',
  tournamentStartTime: new Date('2026-04-10T10:00:00.000Z').toISOString(),
  tournamentStatus: 'LIVE',
  doubleStageEnabled: false,
  stage: {
    id: 'stage-1',
    stageNumber: 1,
    name: 'Stage 1',
    status: 'IN_PROGRESS',
    playersPerPool: 4,
    pools: [],
  },
  estimatedStartOffsetMinutes: 0,
  isAdmin: true,
  isPoolStagesReadonly: false,
  getStatusLabel: (_scope: string, status?: string) => status ?? '',
  getMatchTargetLabel: () => 'Target',
  getTargetLabel: () => 'Target',
  matchScores: {},
  matchTargetSelections: {},
  updatingMatchId: '',
  resettingPoolId: '',
  editingMatchId: '',
  availableTargetsByTournament: new Map(),
  schedulableTargetCount: 1,
  getMatchKey: () => 'key',
  getTargetIdForSelection: () => '',
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
  preferredPlayerId: undefined,
  editingStageId: undefined,
  updatingStageId: undefined,
  stageStatusDrafts: {},
  stagePoolCountDrafts: {},
  stagePlayersPerPoolDrafts: {},
};

describe('PoolStageCard', () => {
  it('shows empty pools message when no pools exist', () => {
    render(<PoolStageCard {...baseProperties} isPoolStagesReadonly={true} />);
    expect(screen.getByText('live.noPools')).toBeInTheDocument();
  });

  it('shows stage actions when editable', () => {
    render(<PoolStageCard {...baseProperties} />);

    expect(screen.getByText('live.completeStage')).toBeInTheDocument();
    expect(screen.getByText('live.editStage')).toBeInTheDocument();
    expect(screen.getByText('common.delete')).toBeInTheDocument();

    fireEvent.click(screen.getByText('live.completeStage'));
    expect(baseProperties.onCompleteStageWithScores).toHaveBeenCalledWith('t1', baseProperties.stage);
  });

  it('renders edit controls when editing stage', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        editingStageId="stage-1"
        stagePoolCountDrafts={{ 'stage-1': '3' }}
        stagePlayersPerPoolDrafts={{ 'stage-1': '4' }}
        stageStatusDrafts={{ 'stage-1': 'EDITION' }}
      />
    );

    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('EDITION')).toBeInTheDocument();
  });

  it('renders pool assignments for the active pool', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        stage={{
          ...baseProperties.stage,
          pools: [
            {
              id: 'p1',
              poolNumber: 1,
              name: 'Pool 1',
              status: 'IN_PROGRESS',
              assignments: [
                {
                  id: 'a1',
                  player: { id: 'pl1', firstName: 'Ava', lastName: 'Archer' },
                },
              ],
            },
          ],
        }}
      />
    );

    expect(screen.getAllByText('Ava Archer').length).toBeGreaterThan(0);
  });

  it('hides fill and edit stage actions when dependent stages are not completed', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        stage={{
          ...baseProperties.stage,
          status: 'EDITION',
        }}
        canManageStageActions={false}
      />
    );

    expect(screen.queryByText('live.fillStage')).not.toBeInTheDocument();
    expect(screen.queryByText('live.editStage')).not.toBeInTheDocument();
    expect(screen.getByText('live.resetStage')).toBeInTheDocument();
  });

  it('shows fill and edit stage actions when dependent stages are completed', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        stage={{
          ...baseProperties.stage,
          status: 'EDITION',
        }}
        canManageStageActions={true}
      />
    );

    expect(screen.getByText('live.fillStage')).toBeInTheDocument();
    expect(screen.getByText('live.editStage')).toBeInTheDocument();
  });
});

describe('computeOptimisticStartTimes', () => {
  type OptimisticPools = Parameters<typeof computeOptimisticStartTimes>[0]['pools'];

  it('returns zero estimated duration when there are no matches', () => {
    const result = computeOptimisticStartTimes({
      pools: [],
      schedulableTargetCount: 0,
      nowTimestamp: 0,
      resolveDurationMinutes: () => 10,
    });

    expect(result.optimisticById.size).toBe(0);
    expect(result.finishTimestampByMatchId.size).toBe(0);
    expect(result.estimatedDurationMinutes).toBe(0);
  });

  it('reserves in-progress matches and computes optimistic slots for scheduled matches', () => {
    const pools = [
      {
        id: 'pool-1',
        poolNumber: 1,
        assignments: [{ player: { id: 'p1' } }, { player: { id: 'p2' } }],
        matches: [
          {
            id: 'm-in-progress',
            status: 'IN_PROGRESS',
            roundNumber: 1,
            matchNumber: 1,
            playerMatches: [{ player: { id: 'p1' } }, { player: { id: 'p2' } }],
          },
          {
            id: 'm-next-1',
            status: 'SCHEDULED',
            roundNumber: 1,
            matchNumber: 2,
            playerMatches: [{ player: { id: 'p3' } }, { player: { id: 'p4' } }],
          },
        ],
      },
      {
        id: 'pool-2',
        poolNumber: 2,
        assignments: [{ player: { id: 'p5' } }, { player: { id: 'p6' } }],
        matches: [
          {
            id: 'm-next-2',
            status: 'SCHEDULED',
            roundNumber: 1,
            matchNumber: 1,
            playerMatches: [{ player: { id: 'p5' } }, { player: { id: 'p6' } }],
          },
        ],
      },
    ] as unknown as OptimisticPools;

    const durationById: Record<string, number> = {
      'm-in-progress': 12,
      'm-next-1': 8,
      'm-next-2': 6,
    };

    const result = computeOptimisticStartTimes({
      pools,
      stagePlayersPerPool: 4,
      schedulableTargetCount: 1,
      nowTimestamp: 0,
      resolveDurationMinutes: (match) => durationById[match.id] ?? 10,
    });

    expect(result.finishTimestampByMatchId.get('m-in-progress')).toBe(12 * 60_000);
    expect(result.optimisticById.has('m-next-1')).toBe(true);
    expect(result.optimisticById.has('m-next-2')).toBe(true);
    expect(result.estimatedDurationMinutes).toBeGreaterThan(12);
  });

  it('uses fallback concurrency with stagePlayersPerPool when player assignments are missing', () => {
    const pools = [
      {
        id: 'pool-1',
        poolNumber: 1,
        assignments: [],
        matches: [
          {
            id: 'm1',
            status: 'SCHEDULED',
            roundNumber: 1,
            matchNumber: 1,
            playerMatches: [],
          },
          {
            id: 'm2',
            status: 'SCHEDULED',
            roundNumber: 1,
            matchNumber: 2,
            playerMatches: [],
          },
        ],
      },
    ] as unknown as OptimisticPools;

    const result = computeOptimisticStartTimes({
      pools,
      stagePlayersPerPool: 4,
      schedulableTargetCount: 2,
      nowTimestamp: 0,
      resolveDurationMinutes: () => 5,
    });

    expect(result.optimisticById.size).toBe(2);
    expect(result.estimatedDurationMinutes).toBeGreaterThanOrEqual(5);
  });

  it('falls back to global best queue when fairness queue would delay start despite idle target', () => {
    const pools = [
      {
        id: 'pool-fair',
        poolNumber: 1,
        assignments: [{ player: { id: 'p1' } }, { player: { id: 'p2' } }],
        matches: [
          {
            id: 'm-delayed',
            status: 'SCHEDULED',
            roundNumber: 1,
            matchNumber: 1,
            playerMatches: [{ player: { id: 'p1' } }, { player: { id: 'p2' } }],
          },
        ],
      },
      {
        id: 'pool-loaded',
        poolNumber: 2,
        assignments: [
          { player: { id: 'p3' } },
          { player: { id: 'p4' } },
          { player: { id: 'p7' } },
          { player: { id: 'p8' } },
        ],
        matches: [
          {
            id: 'm-in-progress',
            status: 'IN_PROGRESS',
            roundNumber: 1,
            matchNumber: 1,
            playerMatches: [{ player: { id: 'p1' } }, { player: { id: 'p2' } }],
          },
          {
            id: 'm-ready-now',
            status: 'SCHEDULED',
            roundNumber: 1,
            matchNumber: 2,
            playerMatches: [{ player: { id: 'p3' } }, { player: { id: 'p4' } }],
          },
          {
            id: 'm-completed',
            status: 'COMPLETED',
            roundNumber: 1,
            matchNumber: 3,
            playerMatches: [{ player: { id: 'p5' } }, { player: { id: 'p6' } }],
          },
        ],
      },
    ] as unknown as OptimisticPools;

    const result = computeOptimisticStartTimes({
      pools,
      schedulableTargetCount: 2,
      nowTimestamp: 0,
      prioritizeLeastProgressedPools: true,
      resolveDurationMinutes: () => 10,
    });

    expect(result.finishTimestampByMatchId.get('m-in-progress')).toBe(600_000);
    expect(result.finishTimestampByMatchId.get('m-ready-now')).toBe(600_000);
    expect(result.finishTimestampByMatchId.get('m-delayed')).toBe(1_200_000);
  });

  it('limits in-progress reservation to available targets', () => {
    const pools = [
      {
        id: 'pool-1',
        poolNumber: 1,
        matches: [
          {
            id: 'm-in-progress-1',
            status: 'IN_PROGRESS',
            roundNumber: 1,
            matchNumber: 1,
            playerMatches: [{ player: { id: 'p1' } }, { player: { id: 'p2' } }],
          },
        ],
      },
      {
        id: 'pool-2',
        poolNumber: 2,
        matches: [
          {
            id: 'm-in-progress-2',
            status: 'IN_PROGRESS',
            roundNumber: 1,
            matchNumber: 1,
            playerMatches: [{ player: { id: 'p3' } }, { player: { id: 'p4' } }],
          },
          {
            id: 'm-scheduled',
            status: 'SCHEDULED',
            roundNumber: 1,
            matchNumber: 2,
            playerMatches: [{ player: { id: 'p5' } }, { player: { id: 'p6' } }],
          },
        ],
      },
    ] as unknown as OptimisticPools;

    const result = computeOptimisticStartTimes({
      pools,
      schedulableTargetCount: 1,
      nowTimestamp: 0,
      resolveDurationMinutes: () => 7,
    });

    expect(result.finishTimestampByMatchId.has('m-in-progress-1')).toBe(true);
    expect(result.finishTimestampByMatchId.has('m-in-progress-2')).toBe(false);
    expect(result.finishTimestampByMatchId.has('m-scheduled')).toBe(true);
  });
});
