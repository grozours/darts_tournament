import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LiveViewData } from '../../../src/components/live-tournament/types';
import LiveTournamentView from '../../../src/components/live-tournament/live-tournament-view';

vi.mock('../../../src/components/live-tournament/match-queue-section', () => ({
  default: () => <div>queue</div>,
}));

vi.mock('../../../src/components/live-tournament/pool-stages-section', () => ({
  default: () => <div>pools</div>,
}));

vi.mock('../../../src/components/live-tournament/brackets-section', () => ({
  default: () => <div>brackets</div>,
}));

const baseProperties = {
  t: (key: string) => key,
  isAdmin: false,
  viewMode: 'live' as const,
  isAggregateView: false,
  visibleLiveViewsCount: 1,
  showGlobalQueue: false,
  isPoolStagesReadonly: true,
  isBracketsReadonly: true,
  availableTargetsByTournament: new Map(),
  matchTargetSelections: {},
  matchScores: {},
  getMatchKey: () => 'key',
  getTargetIdForSelection: () => '',
  getStatusLabel: () => 'label',
  formatTargetLabel: () => 'target',
  getTargetLabel: () => 'target',
  getMatchTargetLabel: () => 'target',
  onTargetSelectionChange: vi.fn(),
  onStartMatch: vi.fn(),
  onCompleteMatch: vi.fn(),
  onEditMatch: vi.fn(),
  onUpdateCompletedMatch: vi.fn(),
  onCancelMatchEdit: vi.fn(),
  onScoreChange: vi.fn(),
  onEditStage: vi.fn(),
  onCancelEditStage: vi.fn(),
  onUpdateStage: vi.fn(),
  onCompleteStageWithScores: vi.fn(),
  onDeleteStage: vi.fn(),
  onStagePoolCountChange: vi.fn(),
  onStagePlayersPerPoolChange: vi.fn(),
  onStageStatusChange: vi.fn(),
  stageStatusDrafts: {},
  stagePoolCountDrafts: {},
  stagePlayersPerPoolDrafts: {},
  playerIdByTournament: {},
  onCompleteBracketRound: vi.fn(),
  onSelectBracket: vi.fn(),
  activeBracketId: '',
  onRefresh: vi.fn(),
};

const makeView = (overrides?: Partial<LiveViewData>): LiveViewData => ({
  id: 't1',
  name: 'Tournament',
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
  brackets: [
    {
      id: 'b1',
      name: 'Bracket',
      bracketType: 'MAIN',
      status: 'IN_PROGRESS',
      matches: [{ id: 'm1', matchNumber: 1, roundNumber: 1, status: 'IN_PROGRESS' }],
    },
  ],
  ...overrides,
});

describe('LiveTournamentView', () => {
  it('shows pools and hides brackets in pool-stages view', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="pool-stages"
        view={makeView()}
      />
    );

    expect(screen.getByText('pools')).toBeInTheDocument();
    expect(screen.queryByText('brackets')).not.toBeInTheDocument();
  });

  it('shows brackets in brackets view even when pools are running', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="brackets"
        view={makeView()}
      />
    );

    expect(screen.getByText('brackets')).toBeInTheDocument();
  });

  it('hides brackets in live view when pools are running for non-admin', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="live"
        view={makeView()}
      />
    );

    expect(screen.queryByText('brackets')).not.toBeInTheDocument();
  });

  it('shows brackets in live view for admins', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        isAdmin={true}
        viewMode="live"
        view={makeView()}
      />
    );

    expect(screen.getByText('brackets')).toBeInTheDocument();
  });
});
