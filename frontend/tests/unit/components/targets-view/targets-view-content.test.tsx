import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TargetsViewContent from '../../../../src/components/targets-view/targets-view-content';

vi.mock('../../../../src/components/targets-view/targets-view-header', () => ({
  default: () => <div data-testid="targets-view-header">HEADER</div>,
}));

vi.mock('../../../../src/components/targets-view/targets-grid', () => ({
  default: () => <div data-testid="targets-grid">GRID</div>,
}));

vi.mock('../../../../src/components/targets-view/targets-queue-panel', () => ({
  default: () => <div data-testid="targets-queue-panel">QUEUE</div>,
}));

const baseProps = {
  t: (key: string) => key,
  isAdmin: true,
  tournamentId: 't1',
  scopedViews: [{ id: 't1', name: 'Cup', status: 'LIVE' }],
  sharedTargets: [{
    targetNumber: 1,
    label: 'Target 1',
    isInUse: false,
    targetIdsByTournament: new Map([['t1', 'target-1']]),
  }],
  queueItems: [{
    tournamentId: 't1',
    tournamentName: 'Cup',
    source: 'pool' as const,
    matchId: 'm1',
    poolId: 'pool-1',
    stageNumber: 1,
    stageName: 'Stage 1',
    poolNumber: 1,
    poolName: 'Pool 1',
    matchNumber: 1,
    roundNumber: 1,
    status: 'PENDING',
    players: ['Ana', 'Bob'],
    blocked: false,
  }],
  queuePreview: [{
    tournamentId: 't1',
    tournamentName: 'Cup',
    source: 'pool' as const,
    matchId: 'm1',
    poolId: 'pool-1',
    stageNumber: 1,
    stageName: 'Stage 1',
    poolNumber: 1,
    poolName: 'Pool 1',
    matchNumber: 1,
    roundNumber: 1,
    status: 'PENDING',
    players: ['Ana', 'Bob'],
    blocked: false,
  }],
  matchDetailsById: new Map(),
  matchSelectionByTarget: {},
  matchScores: {},
  updatingMatchId: undefined,
  startingMatchId: undefined,
  cancellingMatchId: undefined,
  onQueueSelectionChange: vi.fn(),
  onStartMatch: vi.fn(),
  onScoreChange: vi.fn(),
  onCompleteMatch: vi.fn(),
  onCancelMatch: vi.fn(),
};

describe('targets-view-content', () => {
  it('renders empty fallback when there are no shared targets', () => {
    render(
      <TargetsViewContent
        {...baseProps}
        sharedTargets={[]}
      />
    );

    expect(screen.getByText('targets.none')).toBeInTheDocument();
    expect(screen.queryByTestId('targets-view-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('targets-grid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('targets-queue-panel')).not.toBeInTheDocument();
  });

  it('renders header, grid and queue panel when shared targets exist', () => {
    render(<TargetsViewContent {...baseProps} />);

    expect(screen.getByTestId('targets-view-header')).toBeInTheDocument();
    expect(screen.getByTestId('targets-grid')).toBeInTheDocument();
    expect(screen.getByTestId('targets-queue-panel')).toBeInTheDocument();
  });
});
