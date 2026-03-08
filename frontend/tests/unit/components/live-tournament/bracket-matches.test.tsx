import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LiveViewBracket } from '../../../../src/components/live-tournament/types';
import { getBracketMatchAnchorId } from '../../../../src/components/live-tournament/bracket-match-anchors';
import BracketMatches from '../../../../src/components/live-tournament/bracket-matches';

const t = (key: string) => key;

vi.mock('../../../../src/components/live-tournament/match-score-inputs', () => ({
  default: () => <div>ScoreInputs</div>,
}));

vi.mock('../../../../src/components/live-tournament/match-target-selector', () => ({
  default: ({
    selectedTargetNumber,
    availableTargets,
  }: {
    selectedTargetNumber: string;
    availableTargets: Array<{ id: string }>;
  }) => (
    <div>
      <div data-testid="target-selector">{selectedTargetNumber}</div>
      <div data-testid="available-targets">
        {availableTargets.map((target) => target.id).join(',')}
      </div>
    </div>
  ),
}));

const baseMatchProperties = {
  t,
  tournamentId: 't1',
  isBracketsReadonly: false,
  updatingMatchId: '',
  editingMatchId: '',
  matchScores: {},
  matchTargetSelections: { 't1:m1': '1' },
  availableTargetsByTournament: new Map([
    ['t1', [{ id: 'target-1', targetNumber: 1 }]],
  ]),
  reservedTargetIds: [],
  getStatusLabel: (_scope: 'pool' | 'match' | 'bracket' | 'stage', status?: string) => status ?? 'status',
  getMatchKey: (_matchTournamentId: string, matchId: string) => `t1:${matchId}`,
  getTargetIdForSelection: (_tournamentId: string, selection: string) => (selection ? 'target-1' : ''),
  getTargetLabel: (target: { targetNumber: number }) => `Target ${target.targetNumber}`,
  onTargetSelectionChange: vi.fn(),
  onStartMatch: vi.fn(),
  onCompleteMatch: vi.fn(),
  onEditMatch: vi.fn(),
  onSaveMatchScores: vi.fn(),
  onCancelMatch: vi.fn(),
  onCancelMatchEdit: vi.fn(),
  onScoreChange: vi.fn(),
};

const bracket: LiveViewBracket = {
  id: 'b1',
  name: 'Winners',
  bracketType: 'SINGLE',
  status: 'IN_PROGRESS',
  totalRounds: 2,
  entries: [
    { id: 'e1', seedNumber: 1, player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' } },
    { id: 'e2', seedNumber: 2, player: { id: 'p2', firstName: 'Bo', lastName: 'Bowen' } },
    { id: 'e3', seedNumber: 3, player: { id: 'p3', firstName: 'Cory', lastName: 'Cole' } },
    { id: 'e4', seedNumber: 4, player: { id: 'p4', firstName: 'Dara', lastName: 'Duke' } },
  ],
  matches: [
    {
      id: 'm1',
      matchNumber: 1,
      roundNumber: 1,
      status: 'SCHEDULED',
      playerMatches: [
        { playerPosition: 1, player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' } },
        { playerPosition: 2, player: { id: 'p2', firstName: 'Bo', lastName: 'Bowen' } },
      ],
    },
    {
      id: 'm2',
      matchNumber: 2,
      roundNumber: 1,
      status: 'COMPLETED',
      winner: { id: 'p1', firstName: 'Ava', lastName: 'Archer' },
      playerMatches: [
        { playerPosition: 1, player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' } },
        { playerPosition: 2, player: { id: 'p3', firstName: 'Cory', lastName: 'Cole' } },
      ],
    },
    {
      id: 'm3',
      matchNumber: 1,
      roundNumber: 2,
      status: 'IN_PROGRESS',
      playerMatches: [
        { playerPosition: 1, player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' } },
        { playerPosition: 2, player: { id: 'p3', firstName: 'Cory', lastName: 'Cole' } },
      ],
    },
  ],
};

const withoutAssignedTargets = <T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> => {
  const clone = { ...value };
  for (const key of keys) {
    delete clone[key];
  }
  return clone;
};

describe('BracketMatches', () => {
  it('renders target selector for scheduled matches with players', () => {
    render(<BracketMatches {...baseMatchProperties} bracket={bracket} />);

    expect(screen.getAllByTestId('target-selector')[0]).toBeInTheDocument();
  });

  it('renders edit actions for completed matches in edit mode', () => {
    render(
      <BracketMatches
        {...baseMatchProperties}
        bracket={bracket}
        editingMatchId="t1:m2"
      />
    );

    expect(screen.getAllByRole('button', { name: 'live.saveScores' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument();
  });

  it('hides actions when in readonly mode', () => {
    render(
      <BracketMatches
        {...baseMatchProperties}
        bracket={bracket}
        isBracketsReadonly
      />
    );

    expect(screen.queryByTestId('target-selector')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'live.completeMatch' })).not.toBeInTheDocument();
  });

  it('shows winner indicator for completed matches', () => {
    render(<BracketMatches {...baseMatchProperties} bracket={bracket} />);

    expect(screen.getByText('live.winnerShort')).toBeInTheDocument();
  });

  it('highlights matches that include the connected player', () => {
    const { container } = render(
      <BracketMatches
        {...baseMatchProperties}
        bracket={bracket}
        preferredPlayerId="p1"
      />
    );

    const highlightedCards = container.querySelectorAll('[class*="border-amber-400/70"]');
    expect(highlightedCards.length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[class*="bg-amber-500/10"]').length).toBeGreaterThan(0);
  });

  it('adds stable anchors to match cards', () => {
    render(<BracketMatches {...baseMatchProperties} bracket={bracket} />);

    expect(document.getElementById(getBracketMatchAnchorId('t1', 'b1', 'm1'))).toBeInTheDocument();
    expect(document.getElementById(getBracketMatchAnchorId('t1', 'b1', 'm2'))).toBeInTheDocument();
  });

  it('filters out targets reserved for other brackets when none are assigned', () => {
    const availableTargetsByTournament = new Map([
      ['t1', [{ id: 'target-1', targetNumber: 1 }, { id: 'target-2', targetNumber: 2 }]],
    ]);
    const bracketWithoutAssignedTargets = withoutAssignedTargets(bracket, 'targetIds', 'bracketTargets');

    render(
      <BracketMatches
        {...baseMatchProperties}
        bracket={bracketWithoutAssignedTargets}
        availableTargetsByTournament={availableTargetsByTournament}
        reservedTargetIds={['target-2']}
      />
    );

    expect(screen.getByTestId('available-targets')).toHaveTextContent('target-1');
    expect(screen.getByTestId('available-targets')).not.toHaveTextContent('target-2');
  });
});
