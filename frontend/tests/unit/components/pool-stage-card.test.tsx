import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PoolStageCard from '../../../src/components/live-tournament/pool-stage-card';

vi.mock('../../../src/components/live-tournament/match-score-inputs', () => ({
  default: () => <div>match-score-inputs</div>,
}));

vi.mock('../../../src/components/live-tournament/match-target-selector', () => ({
  default: () => <div>match-target-selector</div>,
}));

const baseProperties = {
  t: (key: string) => key,
  tournamentId: 't1',
  stage: {
    id: 'stage-1',
    stageNumber: 1,
    name: 'Stage 1',
    status: 'IN_PROGRESS',
    playersPerPool: 4,
    pools: [],
  },
  isPoolStagesReadonly: false,
  getStatusLabel: (_scope: string, status?: string) => status ?? '',
  getMatchTargetLabel: () => 'Target',
  getTargetLabel: () => 'Target',
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
});
