import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StageStatus } from '@shared/types';
import {
  PoolStageItem,
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

  it('updates ranking destination and stage actions from pool stage item', () => {
    const onPoolStageRankingDestinationChange = vi.fn();
    const onOpenPoolStageAssignments = vi.fn();
    const onPoolStageStatusChange = vi.fn();

    render(
      <PoolStageItem
        t={translate}
        stage={{
          ...baseStage,
          status: StageStatus.EDITION,
          rankingDestinations: [
            { position: 1, destinationType: 'ELIMINATED' },
            { position: 2, destinationType: 'ELIMINATED' },
            { position: 3, destinationType: 'ELIMINATED' },
            { position: 4, destinationType: 'ELIMINATED' },
          ],
        } as never}
        brackets={[baseBracket] as never}
        poolStages={[baseStage, { ...baseStage, id: 'stage-2', name: 'Stage 2' }] as never}
        isTournamentLive={true}
        onPoolStageNumberChange={vi.fn()}
        onPoolStageNameChange={vi.fn()}
        onPoolStagePoolCountChange={vi.fn()}
        onPoolStagePlayersPerPoolChange={vi.fn()}
        onPoolStageAdvanceCountChange={vi.fn()}
        onPoolStageMatchFormatChange={vi.fn()}
        onPoolStageLosersAdvanceChange={vi.fn()}
        onPoolStageRankingDestinationChange={onPoolStageRankingDestinationChange}
        onPoolStageStatusChange={onPoolStageStatusChange}
        onOpenPoolStageAssignments={onOpenPoolStageAssignments}
        onSavePoolStage={vi.fn()}
        onRemovePoolStage={vi.fn()}
        getStatusLabel={(_kind, status) => status}
        normalizeStageStatus={(status) => status ?? StageStatus.NOT_STARTED}
      />
    );

    const selectInputs = screen.getAllByRole('combobox');
    fireEvent.change(selectInputs[2], { target: { value: 'BRACKET:bracket-1' } });

    expect(onPoolStageRankingDestinationChange).toHaveBeenCalledWith(
      'stage-1',
      1,
      { destinationType: 'BRACKET', bracketId: 'bracket-1' }
    );

    fireEvent.click(screen.getByText('edit.editPlayers'));
    expect(onOpenPoolStageAssignments).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getAllByRole('combobox').at(-1) as HTMLSelectElement, {
      target: { value: StageStatus.COMPLETED },
    });
    expect(onPoolStageStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'stage-1' }),
      StageStatus.COMPLETED
    );
  });

  it('handles add mode controls and destination selection in new stage form', () => {
    const onCancelAddPoolStage = vi.fn();
    const onAddPoolStage = vi.fn(async () => true);
    const onNewPoolStageRankingDestinationChange = vi.fn();
    const onNewPoolStageNameChange = vi.fn();

    render(
      <NewPoolStageForm
        t={translate}
        brackets={[baseBracket] as never}
        poolStages={[baseStage] as never}
        isAddingPoolStage={true}
        newPoolStage={{
          stageNumber: 2,
          name: 'New stage',
          poolCount: 2,
          playersPerPool: 4,
          advanceCount: 2,
          losersAdvanceToBracket: false,
          rankingDestinations: [
            { position: 1, destinationType: 'ELIMINATED' },
            { position: 2, destinationType: 'ELIMINATED' },
            { position: 3, destinationType: 'ELIMINATED' },
            { position: 4, destinationType: 'ELIMINATED' },
          ],
        }}
        onStartAddPoolStage={vi.fn()}
        onCancelAddPoolStage={onCancelAddPoolStage}
        onNewPoolStageStageNumberChange={vi.fn()}
        onNewPoolStageNameChange={onNewPoolStageNameChange}
        onNewPoolStagePoolCountChange={vi.fn()}
        onNewPoolStagePlayersPerPoolChange={vi.fn()}
        onNewPoolStageAdvanceCountChange={vi.fn()}
        onNewPoolStageMatchFormatChange={vi.fn()}
        onNewPoolStageLosersAdvanceChange={vi.fn()}
        onNewPoolStageRankingDestinationChange={onNewPoolStageRankingDestinationChange}
        onAddPoolStage={onAddPoolStage}
      />
    );

    fireEvent.change(screen.getByDisplayValue('New stage'), { target: { value: 'Stage Finale' } });
    expect(onNewPoolStageNameChange).toHaveBeenCalledWith('Stage Finale');

    const selectInputs = screen.getAllByRole('combobox');
    fireEvent.change(selectInputs[3], { target: { value: 'POOL_STAGE:stage-1' } });
    expect(onNewPoolStageRankingDestinationChange).toHaveBeenCalledWith(2, {
      destinationType: 'POOL_STAGE',
      poolStageId: 'stage-1',
    });

    fireEvent.click(screen.getByText('common.cancel'));
    expect(onCancelAddPoolStage).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('edit.addStage'));
    expect(onAddPoolStage).toHaveBeenCalledTimes(1);
  });

  it('hides optional stage controls when disabled through props', () => {
    render(
      <PoolStageItem
        t={translate}
        stage={{ ...baseStage, status: StageStatus.EDITION } as never}
        brackets={[baseBracket] as never}
        poolStages={[baseStage] as never}
        isTournamentLive={false}
        showStageStatusControl={false}
        showEditPlayersButton={false}
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

    expect(screen.queryByText('edit.editPlayers')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: StageStatus.IN_PROGRESS })).not.toBeInTheDocument();
  });
});
