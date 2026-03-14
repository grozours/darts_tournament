import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BracketsEditor from '../../../../src/components/tournament-list/brackets-editor';

vi.mock('../../../../src/utils/match-format-presets', () => ({
  getMatchFormatPresets: () => [{ key: 'BO3' }, { key: 'BO5' }],
}));

describe('BracketsEditor', () => {
  const t = (key: string) => key;

  const base = {
    t,
    canEditBrackets: true,
    canAddBrackets: true,
    brackets: [],
    targets: [],
    isAddingBracket: false,
    newBracket: { name: '', bracketType: 'SINGLE_ELIMINATION', totalRounds: 2, roundMatchFormats: {} },
    onLoadBrackets: vi.fn(),
    onBracketNameChange: vi.fn(),
    onBracketTypeChange: vi.fn(),
    onBracketRoundsChange: vi.fn(),
    onBracketRoundMatchFormatChange: vi.fn(),
    onBracketStatusChange: vi.fn(),
    onBracketTargetToggle: vi.fn(),
    onSaveBracket: vi.fn(),
    onSaveBracketTargets: vi.fn(),
    onRemoveBracket: vi.fn(),
    onStartAddBracket: vi.fn(),
    onCancelAddBracket: vi.fn(),
    onNewBracketNameChange: vi.fn(),
    onNewBracketTypeChange: vi.fn(),
    onNewBracketRoundsChange: vi.fn(),
    onNewBracketRoundMatchFormatChange: vi.fn(),
    onAddBracket: vi.fn(),
    getStatusLabel: (_kind: 'stage' | 'bracket', status: string) => status,
  };

  it('shows empty state and add button branch', () => {
    render(<BracketsEditor {...base} />);

    expect(screen.getByText('edit.noBrackets')).toBeInTheDocument();
    fireEvent.click(screen.getByText('common.refresh'));
    fireEvent.click(screen.getByText('edit.addBracket'));
    expect(base.onLoadBrackets).toHaveBeenCalledTimes(1);
    expect(base.onStartAddBracket).toHaveBeenCalledTimes(1);
  });

  it('renders bracket item actions and target ownership disable', () => {
    const onBracketTargetToggle = vi.fn();

    render(
      <BracketsEditor
        {...base}
        brackets={[
          { id: 'b1', name: 'B1', bracketType: 'SINGLE_ELIMINATION', totalRounds: 1, status: 'NOT_STARTED', targetIds: ['t1'] },
          { id: 'b2', name: 'B2', bracketType: 'SINGLE_ELIMINATION', totalRounds: 1, status: 'NOT_STARTED', targetIds: [] },
        ] as never}
        targets={[{ id: 't1', targetNumber: 1 }, { id: 't2', targetNumber: 2 }] as never}
        onBracketTargetToggle={onBracketTargetToggle}
      />
    );

    fireEvent.change(screen.getAllByDisplayValue('B1')[0]!, { target: { value: 'B1-updated' } });
    fireEvent.click(screen.getAllByText('common.save')[0]!);
    fireEvent.click(screen.getAllByText('edit.saveTargets')[0]!);
    fireEvent.click(screen.getAllByText('common.delete')[0]!);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes.some((checkbox) => (checkbox as HTMLInputElement).disabled)).toBe(true);
    expect(onBracketTargetToggle).not.toHaveBeenCalled();
  });

  it('disables bracket controls when bracket has started matches', () => {
    render(
      <BracketsEditor
        {...base}
        brackets={[
          {
            id: 'b1',
            name: 'Locked bracket',
            bracketType: 'SINGLE_ELIMINATION',
            totalRounds: 2,
            status: 'IN_PROGRESS',
            hasStartedMatches: true,
            targetIds: [],
          },
        ] as never}
      />
    );

    expect(screen.getByDisplayValue('Locked bracket')).toBeDisabled();
    expect(screen.getByText('common.save')).toBeDisabled();
    expect(screen.getByText('edit.saveTargets')).toBeDisabled();
    expect(screen.getByText('common.delete')).toBeDisabled();
  });
});
