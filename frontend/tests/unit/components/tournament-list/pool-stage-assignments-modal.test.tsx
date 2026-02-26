import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PoolStageAssignmentsModal from '../../../../src/components/tournament-list/pool-stage-assignments-modal';

describe('PoolStageAssignmentsModal (tournament-list)', () => {
  const t = (key: string) => key;

  it('returns nothing when no editing stage', () => {
    const { container } = render(
      <PoolStageAssignmentsModal
        t={t}
        editingPoolStage={undefined}
        poolStagePools={[]}
        poolStagePlayers={[]}
        poolStageAssignments={{}}
        isSavingAssignments={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onUpdateAssignment={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows no pools message and callbacks', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <PoolStageAssignmentsModal
        t={t}
        editingPoolStage={{ id: 's1', name: 'Stage 1', playersPerPool: 2 } as never}
        poolStagePools={[]}
        poolStagePlayers={[]}
        poolStageAssignments={{}}
        poolStageEditError="error"
        isSavingAssignments={false}
        onClose={onClose}
        onSave={onSave}
        onUpdateAssignment={vi.fn()}
      />
    );

    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('edit.noPoolsAvailable')).toBeInTheDocument();
    fireEvent.click(screen.getByText('edit.close'));
    fireEvent.click(screen.getByText('edit.saveAssignments'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('filters assigned players except current value and updates assignment', () => {
    const onUpdateAssignment = vi.fn();

    render(
      <PoolStageAssignmentsModal
        t={t}
        editingPoolStage={{ id: 's1', name: 'Stage 1', playersPerPool: 1 } as never}
        poolStagePools={[{ id: 'pool-1', name: 'Pool 1', poolNumber: 1 }] as never}
        poolStagePlayers={[
          { playerId: 'p1', name: 'P1' },
          { playerId: 'p2', name: 'P2' },
        ] as never}
        poolStageAssignments={{ 'pool-1': ['p1'], 'pool-2': ['p2'] }}
        isSavingAssignments={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onUpdateAssignment={onUpdateAssignment}
      />
    );

    const select = screen.getByDisplayValue('P1');
    fireEvent.change(select, { target: { value: '' } });
    expect(onUpdateAssignment).toHaveBeenCalledWith('pool-1', 0, '');
    expect(screen.getByText('edit.saving')).toBeInTheDocument();
    expect(screen.queryByText('P2')).not.toBeInTheDocument();
  });
});
