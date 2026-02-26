import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PoolStageAssignmentsModal from '../../../../src/components/live-tournament/pool-stage-assignments-modal';

describe('PoolStageAssignmentsModal (live-tournament)', () => {
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

  it('renders pool slots and calls update handler', () => {
    const onUpdateAssignment = vi.fn();

    render(
      <PoolStageAssignmentsModal
        t={t}
        editingPoolStage={{ id: 's1', name: 'Stage 1', playersPerPool: 2 }}
        poolStagePools={[{ id: 'pool-1', name: 'Pool 1', poolNumber: 1 }] as never}
        poolStagePlayers={[
          { playerId: 'p1', name: 'P1' },
          { playerId: 'p2', name: 'P2' },
        ] as never}
        poolStageAssignments={{ 'pool-1': ['p1'] }}
        isSavingAssignments={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onUpdateAssignment={onUpdateAssignment}
      />
    );

    expect(screen.getByText('edit.slot 1')).toBeInTheDocument();
    expect(screen.getByText('edit.slot 2')).toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1]!, { target: { value: 'p2' } });
    expect(onUpdateAssignment).toHaveBeenCalledWith('pool-1', 1, 'p2');
  });
});
