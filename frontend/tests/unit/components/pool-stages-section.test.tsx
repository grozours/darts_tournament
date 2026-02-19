import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PoolStagesSection from '../../../src/components/live-tournament/pool-stages-section';

const baseProperties = {
  t: (key: string) => key,
  tournamentId: 't1',
  stages: [],
  isPoolStagesReadonly: true,
  getStatusLabel: () => 'label',
  getMatchTargetLabel: () => 'target',
  getTargetLabel: () => 'target',
  matchScores: {},
  matchTargetSelections: {},
  updatingMatchId: '',
  availableTargetsByTournament: new Map(),
  getMatchKey: () => 'key',
  getTargetIdForSelection: () => '',
  onTargetSelectionChange: vi.fn(),
  onScoreChange: vi.fn(),
  onStartMatch: vi.fn(),
  onCompleteMatch: vi.fn(),
  onEditMatch: vi.fn(),
  onUpdateCompletedMatch: vi.fn(),
  onCancelMatchEdit: vi.fn(),
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
};

vi.mock('../../../src/components/live-tournament/pool-stage-card', () => ({
  default: ({ stage }: { stage: { id: string; name: string } }) => (
    <div>stage:{stage.id}:{stage.name}</div>
  ),
}));

describe('PoolStagesSection', () => {
  it('renders empty state when no stages are available', () => {
    render(<PoolStagesSection {...baseProperties} stages={[]} />);
    expect(screen.getByText('live.poolStages')).toBeInTheDocument();
    expect(screen.getByText('live.noPoolStages')).toBeInTheDocument();
  });

  it('renders stage cards when stages exist', () => {
    render(
      <PoolStagesSection
        {...baseProperties}
        stages={[{ id: 's1', stageNumber: 1, name: 'Stage 1', status: 'IN_PROGRESS', pools: [] }]}
      />
    );

    expect(screen.getByText('live.poolStages')).toBeInTheDocument();
    expect(screen.getByText('stage:s1:Stage 1')).toBeInTheDocument();
  });
});
