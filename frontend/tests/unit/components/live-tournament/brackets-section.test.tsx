import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BracketsSection from '../../../../src/components/live-tournament/brackets-section';

const t = (key: string) => key;

vi.mock('../../../../src/components/live-tournament/bracket-matches', () => ({
  default: () => <div>BracketMatches</div>,
}));

vi.mock('../../../../src/components/live-tournament/section-empty-state', () => ({
  default: ({ title, message }: { title: string; message: string }) => (
    <div>{title} {message}</div>
  ),
}));

describe('BracketsSection', () => {
  const baseProperties = {
    t,
    tournamentId: 't1',
    brackets: [],
    hasLoserBracket: false,
    isAdmin: true,
    isBracketsReadonly: false,
    matchScores: {},
    matchTargetSelections: {},
    updatingMatchId: '',
    resettingBracketId: '',
    availableTargetsByTournament: new Map(),
    getStatusLabel: () => 'status',
    getMatchKey: () => 'key',
    getTargetIdForSelection: () => '',
    getTargetLabel: () => 'target',
    onTargetSelectionChange: vi.fn(),
    onStartMatch: vi.fn(),
    onCompleteMatch: vi.fn(),
    onEditMatch: vi.fn(),
    onUpdateCompletedMatch: vi.fn(),
    onCancelMatchEdit: vi.fn(),
    onScoreChange: vi.fn(),
    onCompleteBracketRound: vi.fn(),
    onResetBracketMatches: vi.fn(),
    onSelectBracket: vi.fn(),
    activeBracketId: 'b1',
  };

  it('renders an empty state when no brackets exist', () => {
    render(<BracketsSection {...baseProperties} />);

    expect(screen.getByText('live.bracketStages live.noBrackets')).toBeInTheDocument();
  });

  it('allows selecting brackets when editable', () => {
    const brackets = [
      { id: 'b1', name: 'Winners', bracketType: 'SINGLE', status: 'IN_PROGRESS', entries: [] },
      { id: 'b2', name: 'Losers', bracketType: 'SINGLE', status: 'IN_PROGRESS', entries: [] },
    ];

    render(<BracketsSection {...baseProperties} brackets={brackets} />);

    fireEvent.click(screen.getByRole('button', { name: 'Winners' }));
    expect(baseProperties.onSelectBracket).toHaveBeenCalledWith('t1', 'b1');
  });

  it('hides completion actions when readonly', () => {
    const brackets = [
      { id: 'b1', name: 'Winners', bracketType: 'SINGLE', status: 'IN_PROGRESS', entries: [] },
    ];

    render(<BracketsSection {...baseProperties} brackets={brackets} isBracketsReadonly />);

    expect(screen.queryByText('live.completeRound')).not.toBeInTheDocument();
  });

  it('shows completing label when round update is active', () => {
    const brackets = [
      { id: 'b1', name: 'Winners', bracketType: 'SINGLE', status: 'IN_PROGRESS', entries: [] },
    ];

    render(
      <BracketsSection
        {...baseProperties}
        brackets={brackets}
        updatingRoundKey="t1:b1:round"
      />
    );

    expect(screen.getByText('live.completingRound')).toBeInTheDocument();
  });
});
