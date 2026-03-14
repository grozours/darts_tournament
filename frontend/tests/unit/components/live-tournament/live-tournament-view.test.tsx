import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TournamentFormat } from '@shared/types';
import LiveTournamentView from '../../../../src/components/live-tournament/live-tournament-view';
import type { ComponentProps } from 'react';

vi.mock('../../../../src/components/live-tournament/pool-stages-section', () => ({
  default: () => <div>PoolStagesSection</div>,
}));

vi.mock('../../../../src/components/live-tournament/brackets-section', () => ({
  default: () => <div>BracketsSection</div>,
}));

vi.mock('../../../../src/components/live-tournament/match-queue-section', () => ({
  default: () => <div>MatchQueueSection</div>,
}));

vi.mock('../../../../src/components/live-tournament/tournament-logo-rotator', () => ({
  default: () => <div>TournamentLogoRotator</div>,
}));

const baseProperties = {
  t: (key: string) => key,
  view: {
    id: 't1',
    name: 'Spring Cup',
    status: 'LIVE',
    format: TournamentFormat.SINGLE,
    startTime: new Date('2026-01-01T10:00:00.000Z').toISOString(),
    poolStages: [
      {
        id: 's1',
        stageNumber: 1,
        name: 'Stage 1',
        status: 'IN_PROGRESS',
        pools: [],
      },
    ],
    brackets: [
      {
        id: 'b1',
        name: 'Winners',
        status: 'IN_PROGRESS',
        bracketType: 'SINGLE',
        totalRounds: 1,
        entries: [{ id: 'e1' }],
        matches: [],
      },
    ],
  },
  isAdmin: true,
  viewMode: 'pool-stages',
  viewStatus: 'live',
  stageId: undefined,
  isAggregateView: false,
  screenMode: false,
  visibleLiveViewsCount: 1,
  showGlobalQueue: false,
  isPoolStagesReadonly: false,
  isBracketsReadonly: false,
  availableTargetsByTournament: new Map(),
  schedulableTargetCountByTournament: new Map([['t1', 2]]),
  matchTargetSelections: {},
  updatingMatchId: undefined,
  resettingPoolId: undefined,
  editingMatchId: undefined,
  updatingRoundKey: undefined,
  resettingBracketId: undefined,
  matchScores: {},
  getMatchKey: vi.fn(() => ''),
  getTargetIdForSelection: vi.fn(() => undefined),
  getStatusLabel: vi.fn(() => 'label'),
  formatTargetLabel: vi.fn(() => 'target'),
  getTargetLabel: vi.fn(() => 'target'),
  getMatchTargetLabel: vi.fn(() => 'target'),
  onTargetSelectionChange: vi.fn(),
  onStartMatch: vi.fn(),
  onCompleteMatch: vi.fn(),
  onCancelMatch: vi.fn(),
  onEditMatch: vi.fn(),
  onSaveMatchScores: vi.fn(),
  onCancelMatchEdit: vi.fn(),
  onScoreChange: vi.fn(),
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
  onCompleteBracketRound: vi.fn(),
  onResetBracketMatches: vi.fn(),
  onSelectBracket: vi.fn(),
  activeBracketId: 'b1',
  onRefresh: vi.fn(),
} as const;

type LiveTournamentViewProperties = ComponentProps<typeof LiveTournamentView>;

describe('LiveTournamentView', () => {
  it('renders pool stages and queue in pool-stages mode', () => {
    render(<LiveTournamentView {...(baseProperties as unknown as LiveTournamentViewProperties)} />);

    expect(screen.getByText('PoolStagesSection')).toBeInTheDocument();
    expect(screen.queryByText('MatchQueueSection')).not.toBeInTheDocument();
    expect(screen.queryByText('BracketsSection')).not.toBeInTheDocument();
  });

  it('renders brackets section in brackets mode', () => {
    render(
      <LiveTournamentView
        {...({
          ...baseProperties,
          viewMode: 'brackets',
        } as unknown as LiveTournamentViewProperties)}
      />
    );

    expect(screen.getByText('BracketsSection')).toBeInTheDocument();
  });
});
