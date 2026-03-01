import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import TargetsGridCard from '../../../../src/components/targets-view/targets-grid-card';

type TargetsGridCardProperties = ComponentProps<typeof TargetsGridCard>;

vi.mock('../../../../src/components/targets-view/active-match-score-panel', () => ({
  default: () => <div>score-panel</div>,
}));

const buildBaseProperties = (): TargetsGridCardProperties => ({
  t: (key: string) => key,
  isAdmin: true,
  target: {
    label: 'Target A',
    targetNumber: 1,
    isInUse: false,
    targetIdsByTournament: new Map([['t1', 'tt1']]),
  },
  matchDetailsById: new Map(),
  matchSelectionByTarget: {},
  matchScores: {},
  updatingMatchId: undefined,
  startingMatchId: undefined,
  cancellingMatchId: undefined,
  queueItems: [
    {
      matchId: 'm1',
      tournamentId: 't1',
      tournamentName: 'Cup',
      source: 'pool',
      poolId: 'pool-1',
      stageNumber: 1,
      stageName: 'Stage 1',
      poolNumber: 1,
      poolName: 'Pool 1',
      matchNumber: 1,
      roundNumber: 1,
      status: 'SCHEDULED',
      blocked: false,
      players: ['Ava Archer', 'Bea Bell'],
    },
  ],
  onQueueSelectionChange: vi.fn(),
  onStartMatch: vi.fn(),
  onScoreChange: vi.fn(),
  onCompleteMatch: vi.fn(),
  onCancelMatch: vi.fn(),
});

describe('TargetsGridCard', () => {
  it('starts selected queue match for a free target', () => {
    const properties = buildBaseProperties();
    const { rerender } = render(<TargetsGridCard {...properties} />);

    expect(screen.getByText('targets.noMatch')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'm1' } });
    expect(properties.onQueueSelectionChange).toHaveBeenCalledWith('1', 'm1');

    rerender(<TargetsGridCard {...({ ...properties, matchSelectionByTarget: { '1': 'm1' } } as unknown as TargetsGridCardProperties)} />);
    fireEvent.click(screen.getByRole('button', { name: 'live.startMatch' }));
    expect(properties.onStartMatch).toHaveBeenCalledWith('m1', 1);
  });

  it('shows running match details and allows cancel when confirmed', () => {
    const properties = buildBaseProperties();
    const onCancelMatch = vi.fn();
    const confirmSpy = vi.spyOn(globalThis.window, 'confirm').mockReturnValue(true);

    const activeMatch = {
      id: 'm2',
      status: 'IN_PROGRESS',
      matchFormatKey: 'BO3',
      playerMatches: [
        { player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' } },
        { player: { id: 'p2', firstName: 'Bea', lastName: 'Bell' } },
      ],
    };

    render(
      <TargetsGridCard
        {...({
          ...properties,
          onCancelMatch,
          target: {
            ...properties.target,
            isInUse: true,
            activeMatchInfo: {
              matchId: 'm2',
              label: 'Match 2',
              players: ['Ava Archer', 'Bea Bell'],
              tournamentName: 'Cup',
            },
          },
          matchDetailsById: new Map([['m2', activeMatch]]),
        } as unknown as TargetsGridCardProperties)}
      />
    );

    expect(screen.getByText('targets.matchRunning')).toBeInTheDocument();
    expect(screen.getByText('score-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'targets.cancelMatch' }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onCancelMatch).toHaveBeenCalledWith(activeMatch);
  });

  it('hides admin controls for non-admin users on free target', () => {
    const properties = buildBaseProperties();

    render(<TargetsGridCard {...({ ...properties, isAdmin: false } as unknown as TargetsGridCardProperties)} />);

    expect(screen.getByText('targets.noMatch')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'live.startMatch' })).not.toBeInTheDocument();
  });

  it('shows unknown players fallback when target is in use without match details', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          target: {
            ...properties.target,
            isInUse: true,
          },
        } as unknown as TargetsGridCardProperties)}
      />
    );

    expect(screen.getByText('targets.unknownPlayers')).toBeInTheDocument();
  });

  it('does not cancel active match when confirmation is rejected', () => {
    const properties = buildBaseProperties();
    const onCancelMatch = vi.fn();
    const confirmSpy = vi.spyOn(globalThis.window, 'confirm').mockReturnValue(false);
    const activeMatch = {
      id: 'm2',
      status: 'IN_PROGRESS',
      playerMatches: [],
    };

    render(
      <TargetsGridCard
        {...({
          ...properties,
          onCancelMatch,
          target: {
            ...properties.target,
            isInUse: true,
            activeMatchInfo: {
              matchId: 'm2',
              label: 'Match 2',
              players: ['A', 'B'],
              tournamentName: 'Cup',
            },
          },
          matchDetailsById: new Map([['m2', activeMatch]]),
        } as unknown as TargetsGridCardProperties)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'targets.cancelMatch' }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onCancelMatch).not.toHaveBeenCalled();
  });

  it('shows loading label and disabled start button when selected match is starting', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          matchSelectionByTarget: { '1': 'm1' },
          startingMatchId: 'm1',
        } as unknown as TargetsGridCardProperties)}
      />
    );

    const button = screen.getByRole('button', { name: 'live.startingMatch' });
    expect(button).toBeDisabled();
  });

  it('filters queue to dedicated bracket items when target has dedicated bracket mapping', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          queueItems: [
            {
              matchId: 'b-dedicated',
              tournamentId: 't1',
              tournamentName: 'Cup',
              source: 'bracket',
              bracketId: 'bracket-1',
              bracketName: 'Main',
              bracketTargetIds: ['tt1'],
              players: ['A One', 'B Two'],
            },
            {
              matchId: 'b-other',
              tournamentId: 't1',
              tournamentName: 'Cup',
              source: 'bracket',
              bracketId: 'bracket-2',
              bracketName: 'Secondary',
              bracketTargetIds: ['tt2'],
              players: ['C Three', 'D Four'],
            },
            {
              matchId: 'pool-1',
              tournamentId: 't1',
              tournamentName: 'Cup',
              source: 'pool',
              stageNumber: 1,
              poolNumber: 1,
              players: ['E Five', 'F Six'],
            },
          ],
        } as unknown as TargetsGridCardProperties)}
      />
    );

    const options = screen.getAllByRole('option').map((option) => option.textContent ?? '');
    expect(options.some((text) => text.includes('Main'))).toBe(true);
    expect(options.some((text) => text.includes('Secondary'))).toBe(false);
    expect(options.some((text) => text.includes('stageLabel'))).toBe(false);
  });

  it('shows full grouped participant labels in select options', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          queueItems: [
            {
              matchId: 'g1',
              tournamentId: 't1',
              tournamentName: 'Cup',
              source: 'pool',
              poolId: 'pool-1',
              stageNumber: 1,
              stageName: 'Stage 1',
              poolNumber: 1,
              poolName: 'Pool 1',
              matchNumber: 1,
              roundNumber: 1,
              status: 'SCHEDULED',
              blocked: false,
              players: ['Doublette Alpha', 'Doublette Beta'],
            },
          ],
        } as unknown as TargetsGridCardProperties)}
      />
    );

    const options = screen.getAllByRole('option').map((option) => option.textContent ?? '');
    expect(options.some((text) => text.includes('Doublette Alpha · Doublette Beta'))).toBe(true);
  });

  it('disables start button when no queue item is selected', () => {
    const properties = buildBaseProperties();

    render(<TargetsGridCard {...properties} />);

    expect(screen.getByRole('button', { name: 'live.startMatch' })).toBeDisabled();
  });

  it('hides active score panel when active match is not in progress', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          target: {
            ...properties.target,
            isInUse: true,
            activeMatchInfo: {
              matchId: 'm2',
              label: 'Match 2',
              players: ['A', 'B'],
              tournamentName: 'Cup',
            },
          },
          matchDetailsById: new Map([['m2', { id: 'm2', status: 'COMPLETED', playerMatches: [] }]]),
        } as unknown as TargetsGridCardProperties)}
      />
    );

    expect(screen.queryByText('score-panel')).not.toBeInTheDocument();
  });

  it('hides cancel button for completed active match', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          target: {
            ...properties.target,
            isInUse: true,
            activeMatchInfo: {
              matchId: 'm2',
              label: 'Match 2',
              players: ['A', 'B'],
              tournamentName: 'Cup',
            },
          },
          matchDetailsById: new Map([['m2', { id: 'm2', status: 'COMPLETED', playerMatches: [] }]]),
        } as unknown as TargetsGridCardProperties)}
      />
    );

    expect(screen.queryByRole('button', { name: 'targets.cancelMatch' })).not.toBeInTheDocument();
  });

  it('hides cancel button for cancelled active match', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          target: {
            ...properties.target,
            isInUse: true,
            activeMatchInfo: {
              matchId: 'm2',
              label: 'Match 2',
              players: ['A', 'B'],
              tournamentName: 'Cup',
            },
          },
          matchDetailsById: new Map([['m2', { id: 'm2', status: 'CANCELLED', playerMatches: [] }]]),
        } as unknown as TargetsGridCardProperties)}
      />
    );

    expect(screen.queryByRole('button', { name: 'targets.cancelMatch' })).not.toBeInTheDocument();
  });

  it('hides cancel button for non-admin users even when match is in progress', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          isAdmin: false,
          target: {
            ...properties.target,
            isInUse: true,
            activeMatchInfo: {
              matchId: 'm2',
              label: 'Match 2',
              players: ['A', 'B'],
              tournamentName: 'Cup',
            },
          },
          matchDetailsById: new Map([['m2', { id: 'm2', status: 'IN_PROGRESS', playerMatches: [] }]]),
        } as unknown as TargetsGridCardProperties)}
      />
    );

    expect(screen.queryByRole('button', { name: 'targets.cancelMatch' })).not.toBeInTheDocument();
    expect(screen.queryByText('score-panel')).not.toBeInTheDocument();
  });

  it('shows loading label and disabled cancel button when cancellation is in progress', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          cancellingMatchId: 'm2',
          target: {
            ...properties.target,
            isInUse: true,
            activeMatchInfo: {
              matchId: 'm2',
              label: 'Match 2',
              players: ['A', 'B'],
              tournamentName: 'Cup',
            },
          },
          matchDetailsById: new Map([['m2', { id: 'm2', status: 'IN_PROGRESS', playerMatches: [] }]]),
        } as unknown as TargetsGridCardProperties)}
      />
    );

    const button = screen.getByRole('button', { name: 'common.loading' });
    expect(button).toBeDisabled();
  });

  it('filters out queue items from tournaments not mapped to target ids', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          queueItems: [
            {
              matchId: 'm-allowed',
              tournamentId: 't1',
              tournamentName: 'Cup',
              source: 'pool',
              stageNumber: 1,
              poolNumber: 1,
              players: ['A One', 'B Two'],
            },
            {
              matchId: 'm-denied',
              tournamentId: 't2',
              tournamentName: 'Other',
              source: 'pool',
              stageNumber: 1,
              poolNumber: 2,
              players: ['C Three', 'D Four'],
            },
          ],
        } as unknown as TargetsGridCardProperties)}
      />
    );

    const options = screen.getAllByRole('option').map((option) => option.textContent ?? '');
    expect(options.some((text) => text.includes('Cup'))).toBe(true);
    expect(options.some((text) => text.includes('Other'))).toBe(false);
  });

  it('keeps bracket final item without dedicated mapping when no dedicated bracket exists', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          queueItems: [
            {
              matchId: 'final-1',
              tournamentId: 't1',
              tournamentName: 'Cup',
              source: 'bracket',
              bracketId: 'bracket-final',
              bracketName: 'Final',
              isBracketFinal: true,
              players: ['A One', 'B Two'],
            },
          ],
        } as unknown as TargetsGridCardProperties)}
      />
    );

    const options = screen.getAllByRole('option').map((option) => option.textContent ?? '');
    expect(options.some((text) => text.includes('Final'))).toBe(true);
  });

  it('filters queue by explicit targetNumber when provided on item', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          queueItems: [
            {
              matchId: 'target-1',
              tournamentId: 't1',
              tournamentName: 'Cup',
              source: 'pool',
              targetNumber: 1,
              stageNumber: 1,
              poolNumber: 1,
              players: ['A One', 'B Two'],
            },
            {
              matchId: 'target-2',
              tournamentId: 't1',
              tournamentName: 'Cup',
              source: 'pool',
              targetNumber: 2,
              stageNumber: 1,
              poolNumber: 2,
              players: ['C Three', 'D Four'],
            },
          ],
        } as unknown as TargetsGridCardProperties)}
      />
    );

    const options = screen.getAllByRole('option').map((option) => option.textContent ?? '');
    expect(options.some((text) => text.includes('A One') || text.includes('Archer') || text.includes('One'))).toBe(true);
    expect(options.some((text) => text.includes('C Three') || text.includes('Three'))).toBe(false);
  });

  it('shows active match format key when details include matchFormatKey', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          target: {
            ...properties.target,
            isInUse: true,
            activeMatchInfo: {
              matchId: 'm2',
              label: 'Match 2',
              players: ['A', 'B'],
              tournamentName: 'Cup',
            },
          },
          matchDetailsById: new Map([['m2', { id: 'm2', status: 'IN_PROGRESS', matchFormatKey: 'BO5', playerMatches: [] }]]),
        } as unknown as TargetsGridCardProperties)}
      />
    );

    expect(screen.getByText('BO5')).toBeInTheDocument();
  });

  it('does not call start when clicking disabled start button', () => {
    const properties = buildBaseProperties();

    render(<TargetsGridCard {...properties} />);

    fireEvent.click(screen.getByRole('button', { name: 'live.startMatch' }));
    expect(properties.onStartMatch).not.toHaveBeenCalled();
  });

  it('shows selected queue option and keeps start enabled when another match is starting', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          matchSelectionByTarget: { '1': 'm1' },
          startingMatchId: 'other-match',
        } as unknown as TargetsGridCardProperties)}
      />
    );

    expect(screen.getByRole('combobox')).toHaveValue('m1');
    expect(screen.getByRole('button', { name: 'live.startMatch' })).toBeEnabled();
  });

  it('disables start when selected match is no longer available in queue', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          matchSelectionByTarget: { '1': 'missing-match' },
        } as unknown as TargetsGridCardProperties)}
      />
    );

    expect(screen.getByRole('button', { name: 'live.startMatch' })).toBeDisabled();
  });

  it('does not show running-match label when target is free', () => {
    const properties = buildBaseProperties();

    render(<TargetsGridCard {...properties} />);

    expect(screen.queryByText('targets.matchRunning')).not.toBeInTheDocument();
  });

  it('keeps non-final bracket item without dedicated mapping when global dedicated set does not include it', () => {
    const properties = buildBaseProperties();

    render(
      <TargetsGridCard
        {...({
          ...properties,
          queueItems: [
            {
              matchId: 'global-dedicated',
              tournamentId: 't1',
              tournamentName: 'Cup',
              source: 'bracket',
              bracketId: 'bracket-global',
              bracketName: 'Global Dedicated',
              bracketTargetIds: ['tt2'],
              players: ['A One', 'B Two'],
            },
            {
              matchId: 'non-final-open',
              tournamentId: 't1',
              tournamentName: 'Cup',
              source: 'bracket',
              bracketId: 'bracket-open',
              bracketName: 'Open Bracket',
              players: ['C Three', 'D Four'],
            },
          ],
        } as unknown as TargetsGridCardProperties)}
      />
    );

    const options = screen.getAllByRole('option').map((option) => option.textContent ?? '');
    expect(options.some((text) => text.includes('Open Bracket'))).toBe(true);
    expect(options.some((text) => text.includes('Global Dedicated'))).toBe(false);
  });
});
