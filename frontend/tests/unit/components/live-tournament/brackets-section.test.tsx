import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BracketsSection from '../../../../src/components/live-tournament/brackets-section';

const t = (key: string) => key;
const bracketMatchesCalls: Array<Record<string, unknown>> = [];

vi.mock('../../../../src/components/live-tournament/bracket-matches', () => ({
  default: (properties: Record<string, unknown>) => {
    bracketMatchesCalls.push(properties);
    return <div>BracketMatches</div>;
  },
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
    tournamentStartTime: new Date('2026-04-10T10:00:00.000Z').toISOString(),
    poolStages: [],
    brackets: [],
    screenMode: false,
    isAdmin: true,
    isBracketsReadonly: false,
    schedulableTargetCount: 1,
    matchScores: {},
    matchTargetSelections: {},
    updatingMatchId: '',
    editingMatchId: '',
    updatingRoundKey: '',
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
    onSaveMatchScores: vi.fn(),
    onCancelMatch: vi.fn(),
    onCancelMatchEdit: vi.fn(),
    onScoreChange: vi.fn(),
    onCompleteBracketRound: vi.fn(),
    onResetBracketMatches: vi.fn(),
    onSelectBracket: vi.fn(),
    activeBracketId: 'b1',
  };

  it('renders an empty state when no brackets exist', () => {
    bracketMatchesCalls.length = 0;
    render(<BracketsSection {...baseProperties} />);

    expect(screen.getByText('live.bracketStages live.noBrackets')).toBeInTheDocument();
  });

  it('allows selecting brackets when editable', () => {
    bracketMatchesCalls.length = 0;
    const brackets = [
      { id: 'b1', name: 'Winners', bracketType: 'SINGLE', status: 'IN_PROGRESS', entries: [] },
      { id: 'b2', name: 'Losers', bracketType: 'SINGLE', status: 'IN_PROGRESS', entries: [] },
    ];

    render(<BracketsSection {...baseProperties} brackets={brackets} />);

    fireEvent.click(screen.getByRole('button', { name: 'Winners' }));
    expect(baseProperties.onSelectBracket).toHaveBeenCalledWith('t1', 'b1');
  });

  it('hides completion actions when readonly', () => {
    bracketMatchesCalls.length = 0;
    const brackets = [
      { id: 'b1', name: 'Winners', bracketType: 'SINGLE', status: 'IN_PROGRESS', entries: [] },
    ];

    render(<BracketsSection {...baseProperties} brackets={brackets} isBracketsReadonly />);

    expect(screen.queryByText('live.completeRound')).not.toBeInTheDocument();
  });

  it('shows completing label when round update is active', () => {
    bracketMatchesCalls.length = 0;
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

  it('handles reset confirmation for bracket actions', () => {
    bracketMatchesCalls.length = 0;
    const brackets = [
      { id: 'b1', name: 'Winners', bracketType: 'SINGLE', status: 'IN_PROGRESS', entries: [] },
    ];

    vi.spyOn(globalThis, 'confirm').mockReturnValueOnce(false);
    render(<BracketsSection {...baseProperties} brackets={brackets} />);
    fireEvent.click(screen.getByRole('button', { name: 'live.resetBracket' }));
    expect(baseProperties.onResetBracketMatches).not.toHaveBeenCalled();

    vi.spyOn(globalThis, 'confirm').mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: 'live.resetBracket' }));
    expect(baseProperties.onResetBracketMatches).toHaveBeenCalledWith('t1', 'b1');
  });

  it('renders screen mode and falls back to winner bracket when active id is missing', () => {
    bracketMatchesCalls.length = 0;
    const brackets = [
      {
        id: 'b1',
        name: 'Losers',
        bracketType: 'SINGLE',
        status: 'IN_PROGRESS',
        entries: [],
        targetIds: ['target-l'],
        matches: [],
      },
      {
        id: 'b2',
        name: 'Winner Bracket',
        bracketType: 'SINGLE',
        status: 'IN_PROGRESS',
        entries: [],
        matches: [],
      },
    ];

    render(
      <BracketsSection
        {...baseProperties}
        brackets={brackets}
        screenMode
        activeBracketId="missing"
      />
    );

    expect(screen.getByText('Winner Bracket')).toBeInTheDocument();
    expect(screen.getByText(/live\.estimatedStartTime/)).toBeInTheDocument();
    expect(bracketMatchesCalls).toHaveLength(1);
    expect(bracketMatchesCalls[0]?.screenMode).toBe(true);
  });

  it('passes reserved target ids only when active bracket has no dedicated targets', () => {
    bracketMatchesCalls.length = 0;
    const brackets = [
      {
        id: 'active',
        name: 'Winners',
        bracketType: 'SINGLE',
        status: 'IN_PROGRESS',
        entries: [],
        matches: [],
      },
      {
        id: 'other',
        name: 'Losers',
        bracketType: 'SINGLE',
        status: 'IN_PROGRESS',
        entries: [],
        targetIds: ['target-2'],
        matches: [],
      },
    ];

    render(<BracketsSection {...baseProperties} brackets={brackets} activeBracketId="active" />);
    expect(bracketMatchesCalls[0]?.reservedTargetIds).toEqual(['target-2']);
  });
});
