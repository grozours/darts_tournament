import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { LiveViewData } from '../../../src/components/live-tournament/types';
import LiveTournamentView from '../../../src/components/live-tournament/live-tournament-view';

vi.mock('../../../src/components/live-tournament/match-queue-section', () => ({
  default: () => <div>queue</div>,
}));

vi.mock('../../../src/components/live-tournament/pool-stages-section', () => ({
  default: (properties: { stages?: unknown[] }) => <div>pools-{properties.stages?.length ?? 0}</div>,
}));

vi.mock('../../../src/components/live-tournament/brackets-section', () => ({
  default: (properties: { brackets?: unknown[] }) => <div>brackets-{properties.brackets?.length ?? 0}</div>,
}));

const baseProperties = {
  t: (key: string) => key,
  isAdmin: false,
  viewMode: 'live' as const,
  isAggregateView: false,
  visibleLiveViewsCount: 1,
  showGlobalQueue: false,
  isPoolStagesReadonly: true,
  isBracketsReadonly: true,
  availableTargetsByTournament: new Map(),
  schedulableTargetCountByTournament: new Map(),
  matchTargetSelections: {},
  updatingMatchId: '',
  resettingPoolId: '',
  editingMatchId: '',
  updatingRoundKey: '',
  resettingBracketId: '',
  matchScores: {},
  getMatchKey: () => 'key',
  getTargetIdForSelection: () => '',
  getStatusLabel: () => 'label',
  formatTargetLabel: () => 'target',
  getTargetLabel: () => 'target',
  getMatchTargetLabel: () => 'target',
  onTargetSelectionChange: vi.fn(),
  onStartMatch: vi.fn(),
  onCompleteMatch: vi.fn(),
  onCancelMatch: vi.fn(),
  onEditMatch: vi.fn(),
  onSaveMatchScores: vi.fn(),
  onCancelMatchEdit: vi.fn(),
  onScoreChange: vi.fn(),
  onResetPoolMatches: vi.fn(),
  onEditStage: vi.fn(),
  onCancelEditStage: vi.fn(),
  onUpdateStage: vi.fn(),
  onCompleteStageWithScores: vi.fn(),
  onDeleteStage: vi.fn(),
  onRecomputeDoubleStage: vi.fn(),
  onStagePoolCountChange: vi.fn(),
  onStagePlayersPerPoolChange: vi.fn(),
  onStageStatusChange: vi.fn(),
  onLaunchStage: vi.fn(),
  onResetStage: vi.fn(),
  canDeleteStage: false,
  editingStageId: '',
  updatingStageId: '',
  stageStatusDrafts: {},
  stagePoolCountDrafts: {},
  stagePlayersPerPoolDrafts: {},
  playerIdByTournament: {},
  onCompleteBracketRound: vi.fn(),
  onResetBracketMatches: vi.fn(),
  onSelectBracket: vi.fn(),
  activeBracketId: '',
  screenMode: false,
  onRefresh: vi.fn(),
};

const makeView = (overrides?: Partial<LiveViewData>): LiveViewData => ({
  id: 't1',
  name: 'Tournament',
  status: 'LIVE',
  poolStages: [
    {
      id: 's1',
      stageNumber: 1,
      name: 'Stage 1',
      status: 'IN_PROGRESS',
      pools: [{ id: 'p1', poolNumber: 1, name: 'Pool 1', status: 'IN_PROGRESS', assignments: [{ id: 'a1' }] }],
    },
  ],
  brackets: [
    {
      id: 'b1',
      name: 'Bracket',
      bracketType: 'MAIN',
      status: 'IN_PROGRESS',
      entries: [{ id: 'e1' }],
      matches: [{ id: 'm1', matchNumber: 1, roundNumber: 1, status: 'IN_PROGRESS' }],
    },
  ],
  ...overrides,
});

describe('LiveTournamentView', () => {
  it('shows pools and hides brackets in pool-stages view', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="pool-stages"
        view={makeView()}
      />
    );

    expect(screen.getByText('pools-1')).toBeInTheDocument();
    expect(screen.queryByText('brackets-1')).not.toBeInTheDocument();
  });

  it('shows brackets in brackets view even when pools are running', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="brackets"
        view={makeView()}
      />
    );

    expect(screen.getByText('brackets-1')).toBeInTheDocument();
  });

  it('hides brackets in live view when pools are running for non-admin', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="live"
        view={makeView()}
      />
    );

    expect(screen.queryByText('brackets-1')).not.toBeInTheDocument();
  });

  it('shows brackets in live view for admins', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        isAdmin={true}
        viewMode="live"
        view={makeView()}
      />
    );

    expect(screen.getByText('brackets-1')).toBeInTheDocument();
  });

  it('shows queue section in live view when pools are shown and global queue is disabled', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="live"
        showGlobalQueue={false}
        view={makeView({
          poolStages: [{
            id: 's1',
            stageNumber: 1,
            name: 'Stage 1',
            status: 'IN_PROGRESS',
            pools: [{ id: 'p1', poolNumber: 1, name: 'Pool 1', status: 'IN_PROGRESS' }],
          }],
        })}
      />
    );

    expect(screen.getByText('queue')).toBeInTheDocument();
  });

  it('shows pools navigation link when viewing brackets and pools exist', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="brackets"
        view={makeView()}
      />
    );

    const poolsLink = screen.getByRole('link', { name: 'nav.poolStagesRunning' });
    expect(poolsLink).toHaveAttribute('href', '/?view=pool-stages&tournamentId=t1');
  });

  it('toggles pool summary cards from header action', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="live"
        view={makeView()}
      />
    );

    expect(screen.queryByText('live.totalPools')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'live.showSummary' }));
    expect(screen.getByText('live.totalPools')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'live.hideSummary' }));
    expect(screen.queryByText('live.totalPools')).not.toBeInTheDocument();
  });

  it('shows brackets navigation link in pool-stages view when stage completed and brackets active', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="pool-stages"
        view={makeView({
          poolStages: [{
            id: 's1',
            stageNumber: 1,
            name: 'Stage 1',
            status: 'COMPLETED',
            pools: [{
              id: 'p1',
              poolNumber: 1,
              name: 'Pool 1',
              status: 'COMPLETED',
              assignments: [{ playerId: 'p1' }],
            }],
          }],
          brackets: [{
            id: 'b1',
            name: 'Bracket',
            bracketType: 'MAIN',
            status: 'IN_PROGRESS',
            matches: [{ id: 'm1', matchNumber: 1, roundNumber: 1, status: 'IN_PROGRESS' }],
          }],
        })}
      />
    );

    const bracketsLink = screen.getByRole('link', { name: 'nav.bracketsRunning' });
    expect(bracketsLink).toHaveAttribute('href', '/?view=brackets&tournamentId=t1');
  });

  it('hides header in screen mode when viewing brackets', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        screenMode={true}
        viewMode="brackets"
        view={makeView()}
      />
    );

    expect(screen.queryByRole('button', { name: 'common.refresh' })).not.toBeInTheDocument();
  });

  it('shows admin edit link in header when not in screen mode', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        isAdmin={true}
        screenMode={false}
        viewMode="live"
        view={makeView()}
      />
    );

    const editLink = screen.getByRole('link', { name: 'common.edit' });
    expect(editLink).toHaveAttribute('href', '/?view=edit-tournament&tournamentId=t1');
  });

  it('hides admin edit link in screen mode', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        isAdmin={true}
        screenMode={true}
        viewMode="live"
        view={makeView()}
      />
    );

    expect(screen.queryByRole('link', { name: 'common.edit' })).not.toBeInTheDocument();
  });

  it('hides queue section when global queue is enabled', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="live"
        showGlobalQueue={true}
        view={makeView()}
      />
    );

    expect(screen.queryByText('queue')).not.toBeInTheDocument();
  });

  it('hides queue section in pool-stages mode', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="pool-stages"
        showGlobalQueue={false}
        view={makeView()}
      />
    );

    expect(screen.queryByText('queue')).not.toBeInTheDocument();
  });

  it('shows brackets in live mode for non-admin when no pool stage is still running', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        isAdmin={false}
        viewMode="live"
        view={makeView({
          poolStages: [{
            id: 's1',
            stageNumber: 1,
            name: 'Stage 1',
            status: 'COMPLETED',
            pools: [{ id: 'p1', poolNumber: 1, name: 'Pool 1', status: 'COMPLETED' }],
          }],
        })}
      />
    );

    expect(screen.getByText('brackets-1')).toBeInTheDocument();
  });

  it('hides pools navigation link in brackets view when no pool stage is displayed', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="brackets"
        view={makeView({ poolStages: [] })}
      />
    );

    expect(screen.queryByRole('link', { name: 'nav.poolStagesRunning' })).not.toBeInTheDocument();
  });

  it('hides brackets navigation link when no completed pool stage is available', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="pool-stages"
        view={makeView({
          poolStages: [{
            id: 's1',
            stageNumber: 1,
            name: 'Stage 1',
            status: 'IN_PROGRESS',
            pools: [{ id: 'p1', poolNumber: 1, name: 'Pool 1', status: 'IN_PROGRESS', assignments: [{ id: 'a1' }] }],
          }],
        })}
      />
    );

    expect(screen.queryByRole('link', { name: 'nav.bracketsRunning' })).not.toBeInTheDocument();
  });

  it('filters pool stages by stageId in screen mode', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        screenMode={true}
        viewMode="pool-stages"
        stageId="s2"
        view={makeView({
          poolStages: [
            {
              id: 's1',
              stageNumber: 1,
              name: 'Stage 1',
              status: 'IN_PROGRESS',
              pools: [{ id: 'p1', poolNumber: 1, name: 'Pool 1', status: 'IN_PROGRESS', assignments: [{ id: 'a1' }] }],
            },
            {
              id: 's2',
              stageNumber: 2,
              name: 'Stage 2',
              status: 'IN_PROGRESS',
              pools: [{ id: 'p2', poolNumber: 1, name: 'Pool 2', status: 'IN_PROGRESS', assignments: [{ id: 'a2' }] }],
            },
          ],
        })}
      />
    );

    expect(screen.getByText('pools-1')).toBeInTheDocument();
  });

  it('shows tournament id for admin users in header', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        isAdmin={true}
        viewMode="live"
        view={makeView()}
      />
    );

    expect(screen.getByText('ID: t1')).toBeInTheDocument();
  });

  it('hides tournament id for non-admin users in header', () => {
    render(
      <LiveTournamentView
        {...baseProperties}
        isAdmin={false}
        viewMode="live"
        view={makeView()}
      />
    );

    expect(screen.queryByText('ID: t1')).not.toBeInTheDocument();
  });

  it('calls refresh callback when refresh button is clicked', () => {
    const onRefresh = vi.fn();
    render(
      <LiveTournamentView
        {...baseProperties}
        onRefresh={onRefresh}
        viewMode="live"
        view={makeView()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'common.refresh' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('logs ETA debug details when etaDebug flag is enabled', () => {
    const groupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => undefined);
    const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined);
    globalThis.window?.history.pushState({}, '', '/?etaDebug=1');

    render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="live"
        view={makeView({
          startTime: '2026-04-10T10:00:00.000Z',
          brackets: [{
            id: 'b1',
            name: 'Bracket',
            bracketType: 'MAIN',
            status: 'IN_PROGRESS',
            totalRounds: 1,
            roundMatchFormats: { '1': 'BO3' },
            matches: [{ id: 'm1', matchNumber: 1, roundNumber: 1, status: 'IN_PROGRESS' }],
          }],
        })}
      />
    );

    expect(groupSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
    expect(tableSpy).toHaveBeenCalled();
    expect(groupEndSpy).toHaveBeenCalled();

    groupSpy.mockRestore();
    logSpy.mockRestore();
    tableSpy.mockRestore();
    groupEndSpy.mockRestore();
    globalThis.window?.history.pushState({}, '', '/');
  });

  it('cleans up ETA timers on unmount when estimation is active', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T10:00:00.000Z'));
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = render(
      <LiveTournamentView
        {...baseProperties}
        viewMode="live"
        view={makeView({
          startTime: '2026-04-10T10:00:00.000Z',
          brackets: [{
            id: 'b1',
            name: 'Bracket',
            bracketType: 'MAIN',
            status: 'IN_PROGRESS',
            totalRounds: 1,
            roundMatchFormats: { '1': 'BO3' },
            matches: [{ id: 'm1', matchNumber: 1, roundNumber: 1, status: 'IN_PROGRESS' }],
          }],
        })}
      />
    );

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    act(() => {
      unmount();
    });

    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();

    setTimeoutSpy.mockRestore();
    setIntervalSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    vi.useRealTimers();
  });
});
