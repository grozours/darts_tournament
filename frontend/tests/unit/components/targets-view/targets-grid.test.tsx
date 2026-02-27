import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import TargetsGrid from '../../../../src/components/targets-view/targets-grid';

type TargetsGridProperties = ComponentProps<typeof TargetsGrid>;

vi.mock('../../../../src/components/targets-view/targets-grid-card', () => ({
  default: (properties: { target: { targetNumber: number; label: string } }) => (
    <div>{`card-${properties.target.targetNumber}-${properties.target.label}`}</div>
  ),
}));

const buildBaseProperties = (): TargetsGridProperties => ({
  t: (key: string) => key,
  isAdmin: true,
  sharedTargets: [
    {
      label: 'Target A',
      targetNumber: 1,
      isInUse: false,
      targetIdsByTournament: new Map([['t1', 'tt1']]),
    },
    {
      label: 'Target B',
      targetNumber: 2,
      isInUse: true,
      targetIdsByTournament: new Map([['t1', 'tt2']]),
    },
  ],
  matchDetailsById: new Map(),
  matchSelectionByTarget: {},
  matchScores: {},
  updatingMatchId: undefined,
  startingMatchId: undefined,
  cancellingMatchId: undefined,
  queueItems: [],
  onQueueSelectionChange: vi.fn(),
  onStartMatch: vi.fn(),
  onScoreChange: vi.fn(),
  onCompleteMatch: vi.fn(),
  onCancelMatch: vi.fn(),
});

describe('TargetsGrid', () => {
  it('renders one card per shared target', () => {
    const properties = buildBaseProperties();

    render(<TargetsGrid {...properties} />);

    expect(screen.getByText('card-1-Target A')).toBeInTheDocument();
    expect(screen.getByText('card-2-Target B')).toBeInTheDocument();
  });

  it('renders empty grid container when there is no target', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGrid
        {...({
          ...properties,
          sharedTargets: [],
        } as TargetsGridProperties)}
      />
    );

    expect(screen.queryByText(/card-/)).not.toBeInTheDocument();
  });
});
