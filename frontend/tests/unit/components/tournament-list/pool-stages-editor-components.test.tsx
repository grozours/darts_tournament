import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StageStatus } from '@shared/types';
import {
  NewPoolStageForm,
  PoolStagesList,
} from '../../../../src/components/tournament-list/pool-stages-editor-components';

const translate = (key: string) => key;

const baseStage = {
  id: 'stage-1',
  tournamentId: 't1',
  stageNumber: 1,
  name: 'Stage 1',
  poolCount: 2,
  playersPerPool: 4,
  advanceCount: 2,
  losersAdvanceToBracket: false,
  status: StageStatus.NOT_STARTED,
};

const baseBracket = {
  id: 'bracket-1',
  tournamentId: 't1',
  name: 'Winner Bracket',
  bracketType: 'SINGLE_ELIMINATION',
  totalRounds: 3,
  status: 'NOT_STARTED',
};

describe('pool-stages-editor-components', () => {
  it('renders empty state when there are no pool stages', () => {
    render(
      <PoolStagesList
        t={translate}
        poolStages={[]}
        brackets={[]}
        isTournamentLive={false}
        onPoolStageNumberChange={vi.fn()}
        onPoolStageNameChange={vi.fn()}
        onPoolStagePoolCountChange={vi.fn()}
        onPoolStagePlayersPerPoolChange={vi.fn()}
        onPoolStageAdvanceCountChange={vi.fn()}
        onPoolStageMatchFormatChange={vi.fn()}
        onPoolStageLosersAdvanceChange={vi.fn()}
        onPoolStageRankingDestinationChange={vi.fn()}
        onPoolStageStatusChange={vi.fn()}
        onOpenPoolStageAssignments={vi.fn()}
        onSavePoolStage={vi.fn()}
        onRemovePoolStage={vi.fn()}
        getStatusLabel={(_kind, status) => status}
        normalizeStageStatus={(status) => status ?? StageStatus.NOT_STARTED}
      />
    );

    expect(screen.getByText('edit.noPoolStages')).toBeInTheDocument();
  });

  it('triggers save/remove actions for a stage', () => {
    const onSavePoolStage = vi.fn();
    const onRemovePoolStage = vi.fn();

    render(
      <PoolStagesList
        t={translate}
        poolStages={[baseStage] as never}
        brackets={[baseBracket] as never}
        isTournamentLive={false}
        onPoolStageNumberChange={vi.fn()}
        onPoolStageNameChange={vi.fn()}
        onPoolStagePoolCountChange={vi.fn()}
        onPoolStagePlayersPerPoolChange={vi.fn()}
        onPoolStageAdvanceCountChange={vi.fn()}
        onPoolStageMatchFormatChange={vi.fn()}
        onPoolStageLosersAdvanceChange={vi.fn()}
        onPoolStageRankingDestinationChange={vi.fn()}
        onPoolStageStatusChange={vi.fn()}
        onOpenPoolStageAssignments={vi.fn()}
        onSavePoolStage={onSavePoolStage}
        onRemovePoolStage={onRemovePoolStage}
        getStatusLabel={(_kind, status) => status}
        normalizeStageStatus={(status) => status ?? StageStatus.NOT_STARTED}
      />
    );

    fireEvent.click(screen.getByText('common.save'));
    fireEvent.click(screen.getByText('common.delete'));

    expect(onSavePoolStage).toHaveBeenCalledTimes(1);
    expect(onRemovePoolStage).toHaveBeenCalledWith('stage-1');
  });

  it('shows add button when not adding and starts add mode', () => {
    const onStartAddPoolStage = vi.fn();

    render(
      <NewPoolStageForm
        t={translate}
        brackets={[baseBracket] as never}
        poolStages={[baseStage] as never}
        isAddingPoolStage={false}
        newPoolStage={{
          stageNumber: 2,
          name: 'Stage 2',
          poolCount: 2,
          playersPerPool: 4,
          advanceCount: 2,
          losersAdvanceToBracket: false,
        }}
        onStartAddPoolStage={onStartAddPoolStage}
        onCancelAddPoolStage={vi.fn()}
        onNewPoolStageStageNumberChange={vi.fn()}
        onNewPoolStageNameChange={vi.fn()}
        onNewPoolStagePoolCountChange={vi.fn()}
        onNewPoolStagePlayersPerPoolChange={vi.fn()}
        onNewPoolStageAdvanceCountChange={vi.fn()}
        onNewPoolStageMatchFormatChange={vi.fn()}
        onNewPoolStageLosersAdvanceChange={vi.fn()}
        onNewPoolStageRankingDestinationChange={vi.fn()}
        onAddPoolStage={vi.fn(async () => true)}
      />
    );

    fireEvent.click(screen.getByText('edit.addStage'));
    expect(onStartAddPoolStage).toHaveBeenCalledTimes(1);
  });
});
