import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { LiveViewData } from '../../../src/components/live-tournament/types';
import LiveTournament from '../../../src/components/live-tournament';

const gateContentMock = vi.hoisted(() => ({ value: undefined as unknown }));
const poolAssignmentsMock = vi.hoisted(() => ({
  value: {
    editingPoolStage: undefined,
    poolStagePools: [],
    poolStagePlayers: [],
    poolStageAssignments: {},
    poolStageEditError: undefined,
    isSavingAssignments: false,
    openPoolStageAssignments: vi.fn(),
    closePoolStageAssignments: vi.fn(),
    updatePoolStageAssignment: vi.fn(),
    savePoolStageAssignments: vi.fn(),
  },
}));

const stateMock = vi.hoisted(() => ({
  value: {
    t: (key: string) => key,
    authEnabled: false,
    isAuthenticated: false,
    authLoading: false,
    isAdmin: false,
    viewMode: 'pool-stages',
    isAggregateView: true,
    getStatusLabel: () => 'label',
    liveViews: [] as LiveViewData[],
    loading: false,
    reloadLiveViews: vi.fn(),
    visibleLiveViews: [] as LiveViewData[],
    displayedLiveViews: [] as LiveViewData[],
    selectedLiveTournamentId: 'ALL',
    setSelectedLiveTournamentId: vi.fn(),
    selectedPoolStagesTournamentId: '',
    setSelectedPoolStagesTournamentId: vi.fn(),
    showGlobalQueue: false,
    globalQueue: [],
    availableTargetsByTournament: new Map(),
    matchTargetSelections: {},
    handleTargetSelectionChange: vi.fn(),
    getTargetIdForSelection: vi.fn(),
    formatTargetLabel: vi.fn(),
    getTargetLabel: vi.fn(),
    getMatchTargetLabel: vi.fn(),
    getMatchKey: vi.fn(),
    matchScores: {},
    handleMatchStatusUpdate: vi.fn(),
    handleScoreChange: vi.fn(),
    handleCompleteMatch: vi.fn(),
    handleEditMatch: vi.fn(),
    cancelMatchEdit: vi.fn(),
    handleUpdateCompletedMatch: vi.fn(),
    stageStatusDrafts: {},
    stagePoolCountDrafts: {},
    stagePlayersPerPoolDrafts: {},
    handleEditStage: vi.fn(),
    handleStageStatusChange: vi.fn(),
    handleStagePoolCountChange: vi.fn(),
    handleStagePlayersPerPoolChange: vi.fn(),
    handleUpdateStage: vi.fn(),
    handleDeleteStage: vi.fn(),
    handleCompleteStageWithScores: vi.fn(),
    cancelEditStage: vi.fn(),
    handleCompleteBracketRound: vi.fn(),
    handleSelectBracket: vi.fn(),
    activeBracketByTournament: {},
    isPoolStagesReadonly: true,
    isBracketsReadonly: true,
  },
}));

vi.mock('../../../src/components/live-tournament/use-live-tournament-state', () => ({
  default: () => stateMock.value,
}));

vi.mock('../../../src/components/live-tournament/live-tournament-gate', () => ({
  default: () => gateContentMock.value,
}));

vi.mock('../../../src/components/live-tournament/live-tournament-view', () => ({
  default: (properties: {
    view: { id: string };
    activeBracketId: string;
    onEditStage: (stageTournamentId: string, stage: { id: string; stageNumber: number; name: string }) => void;
  }) => (
    <div>
      <div>{`live-view-${properties.view.id}-${properties.activeBracketId || 'none'}`}</div>
      <button
        type="button"
        onClick={() => properties.onEditStage(properties.view.id, {
          id: 'stage-1',
          stageNumber: 1,
          name: 'Stage 1',
        })}
      >
        {`edit-stage-${properties.view.id}`}
      </button>
    </div>
  ),
}));

vi.mock('../../../src/components/live-tournament/match-queue-section', () => ({
  default: () => <div>queue</div>,
}));

vi.mock('../../../src/components/live-tournament/use-live-tournament-pool-stage-assignments', () => ({
  default: () => poolAssignmentsMock.value,
}));

vi.mock('../../../src/components/live-tournament/pool-stage-assignments-modal', () => ({
  default: (properties: { onSave: () => void }) => (
    <button type="button" onClick={properties.onSave}>modal-save</button>
  ),
}));

describe('LiveTournament rendering', () => {
  beforeEach(() => {
    globalThis.window?.history.pushState({}, '', '/');
    gateContentMock.value = undefined;
    stateMock.value.viewMode = 'pool-stages';
    stateMock.value.tournamentId = undefined;
    stateMock.value.viewStatus = undefined;
    stateMock.value.displayedLiveViews = [];
    stateMock.value.visibleLiveViews = [];
    stateMock.value.showGlobalQueue = false;
    poolAssignmentsMock.value.openPoolStageAssignments.mockReset();
    poolAssignmentsMock.value.savePoolStageAssignments.mockReset();
  });

  it('renders empty aggregate state', () => {
    render(<LiveTournament />);
    expect(screen.getByText('live.nonePoolStages')).toBeInTheDocument();
  });

  it('renders queue and live views when available', () => {
    const liveView: LiveViewData = { id: 't1', name: 'Tournament', status: 'LIVE' };
    stateMock.value.displayedLiveViews = [liveView];
    stateMock.value.visibleLiveViews = stateMock.value.displayedLiveViews;
    stateMock.value.showGlobalQueue = true;

    render(<LiveTournament />);

    expect(screen.getByText('queue')).toBeInTheDocument();
    expect(screen.getByText('live-view-t1-none')).toBeInTheDocument();
  });

  it('renders live filter and updates selected tournament', () => {
    const liveView: LiveViewData = { id: 't1', name: 'Tournament One', status: 'LIVE' };
    const setSelectedLiveTournamentId = vi.fn();
    stateMock.value.viewMode = 'live';
    stateMock.value.visibleLiveViews = [liveView, { id: 't2', name: 'Tournament Two', status: 'LIVE' }];
    stateMock.value.displayedLiveViews = [liveView];
    stateMock.value.selectedLiveTournamentId = 'ALL';
    stateMock.value.setSelectedLiveTournamentId = setSelectedLiveTournamentId;

    render(<LiveTournament />);

    fireEvent.change(screen.getByLabelText('live.selectTournament'), { target: { value: 't1' } });
    expect(setSelectedLiveTournamentId).toHaveBeenCalledWith('t1');
  });

  it('shows debug panel when debug=1', () => {
    globalThis.window?.history.pushState({}, '', '/?debug=1');

    render(<LiveTournament />);

    expect(screen.getByText('Live view debug')).toBeInTheDocument();
  });

  it('renders gate content when gate returns a node', () => {
    gateContentMock.value = <div>gate-block</div>;

    render(<LiveTournament />);

    expect(screen.getByText('gate-block')).toBeInTheDocument();
    expect(screen.queryByText('live.nonePoolStages')).not.toBeInTheDocument();
  });

  it('renders live tournament selector in live mode when multiple tournaments are visible', () => {
    stateMock.value.viewMode = 'live';
    stateMock.value.visibleLiveViews = [
      { id: 't1', name: 'Tournament One', status: 'LIVE' },
      { id: 't2', name: 'Tournament Two', status: 'LIVE' },
    ];
    stateMock.value.displayedLiveViews = [stateMock.value.visibleLiveViews[0] as LiveViewData];

    render(<LiveTournament />);

    expect(screen.getByLabelText('live.selectTournament')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tournament One' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tournament Two' })).toBeInTheDocument();
  });

  it('renders pool-stages tournament selector when aggregate and multiple views', () => {
    stateMock.value.viewMode = 'pool-stages';
    stateMock.value.tournamentId = undefined;
    stateMock.value.visibleLiveViews = [
      { id: 't1', name: 'Tournament One', status: 'LIVE' },
      { id: 't2', name: 'Tournament Two', status: 'LIVE' },
    ];
    stateMock.value.displayedLiveViews = [stateMock.value.visibleLiveViews[0] as LiveViewData];

    render(<LiveTournament />);

    expect(screen.getByLabelText('live.selectTournament')).toBeInTheDocument();
  });

  it('updates pool-stage tournament selection through filter control', () => {
    const setSelectedPoolStagesTournamentId = vi.fn();
    stateMock.value.viewMode = 'pool-stages';
    stateMock.value.tournamentId = undefined;
    stateMock.value.visibleLiveViews = [
      { id: 't1', name: 'Tournament One', status: 'LIVE' },
      { id: 't2', name: 'Tournament Two', status: 'LIVE' },
    ];
    stateMock.value.displayedLiveViews = [stateMock.value.visibleLiveViews[0] as LiveViewData];
    stateMock.value.setSelectedPoolStagesTournamentId = setSelectedPoolStagesTournamentId;

    render(<LiveTournament />);

    fireEvent.change(screen.getByLabelText('live.selectTournament'), { target: { value: 't2' } });
    expect(setSelectedPoolStagesTournamentId).toHaveBeenCalledWith('t2');
  });

  it('updates status filter to LIVE and navigates with status parameter', () => {
    const assign = vi.fn();
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: { ...globalThis.window.location, assign },
    });

    stateMock.value.viewMode = 'pool-stages';
    stateMock.value.tournamentId = undefined;
    stateMock.value.visibleLiveViews = [
      { id: 't1', name: 'Tournament One', status: 'LIVE' },
    ];
    stateMock.value.displayedLiveViews = [stateMock.value.visibleLiveViews[0] as LiveViewData];

    render(<LiveTournament />);

    fireEvent.click(screen.getByRole('button', { name: 'nav.live' }));
    expect(assign).toHaveBeenCalled();
  });

  it('clears status query parameter when ALL status button is clicked', () => {
    const assign = vi.fn();
    globalThis.window?.history.pushState({}, '', '/?status=LIVE');
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: { ...globalThis.window.location, assign },
    });

    stateMock.value.viewMode = 'pool-stages';
    stateMock.value.visibleLiveViews = [{ id: 't1', name: 'Tournament One', status: 'LIVE' }];
    stateMock.value.displayedLiveViews = [stateMock.value.visibleLiveViews[0] as LiveViewData];

    render(<LiveTournament />);

    fireEvent.click(screen.getByRole('button', { name: 'common.all' }));
    expect(assign).toHaveBeenCalled();
  });

  it('does not render global queue when flag is disabled even with displayed views', () => {
    const liveView: LiveViewData = { id: 't1', name: 'Tournament', status: 'LIVE' };
    stateMock.value.displayedLiveViews = [liveView];
    stateMock.value.visibleLiveViews = [liveView];
    stateMock.value.showGlobalQueue = false;

    render(<LiveTournament />);

    expect(screen.queryByText('queue')).not.toBeInTheDocument();
  });

  it('renders one LiveTournamentView per displayed live view', () => {
    stateMock.value.displayedLiveViews = [
      { id: 't1', name: 'Tournament One', status: 'LIVE' } as LiveViewData,
      { id: 't2', name: 'Tournament Two', status: 'LIVE' } as LiveViewData,
    ];
    stateMock.value.visibleLiveViews = stateMock.value.displayedLiveViews;

    render(<LiveTournament />);

    expect(screen.getByText('live-view-t1-none')).toBeInTheDocument();
    expect(screen.getByText('live-view-t2-none')).toBeInTheDocument();
  });

  it('passes active bracket id mapping to each rendered live view', () => {
    stateMock.value.displayedLiveViews = [{ id: 't1', name: 'Tournament One', status: 'LIVE' } as LiveViewData];
    stateMock.value.visibleLiveViews = stateMock.value.displayedLiveViews;
    stateMock.value.activeBracketByTournament = { t1: 'b-77' };

    render(<LiveTournament />);

    expect(screen.getByText('live-view-t1-b-77')).toBeInTheDocument();
  });

  it('opens pool-stage assignments from live view stage edit action', () => {
    stateMock.value.displayedLiveViews = [{ id: 't1', name: 'Tournament One', status: 'LIVE' } as LiveViewData];
    stateMock.value.visibleLiveViews = stateMock.value.displayedLiveViews;

    render(<LiveTournament />);

    fireEvent.click(screen.getByRole('button', { name: 'edit-stage-t1' }));
    expect(poolAssignmentsMock.value.openPoolStageAssignments).toHaveBeenCalledWith('t1', {
      id: 'stage-1',
      stageNumber: 1,
      name: 'Stage 1',
    });
  });

  it('saves pool-stage assignments from modal save action', () => {
    stateMock.value.displayedLiveViews = [{ id: 't1', name: 'Tournament One', status: 'LIVE' } as LiveViewData];
    stateMock.value.visibleLiveViews = stateMock.value.displayedLiveViews;

    render(<LiveTournament />);

    fireEvent.click(screen.getByRole('button', { name: 'modal-save' }));
    expect(poolAssignmentsMock.value.savePoolStageAssignments).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when no displayed views and aggregate mode is disabled', () => {
    stateMock.value.isAggregateView = false;
    stateMock.value.displayedLiveViews = [];
    stateMock.value.visibleLiveViews = [];
    stateMock.value.loading = false;
    stateMock.value.error = undefined;

    render(<LiveTournament />);

    expect(document.body.textContent?.trim()).toBe('');
  });

  it('redirects to brackets in screen mode when pool-stages has no active pools but has brackets', () => {
    const replace = vi.fn();
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: { ...globalThis.window.location, replace },
    });

    stateMock.value.screenMode = true;
    stateMock.value.viewMode = 'pool-stages';
    stateMock.value.isAdmin = true;
    stateMock.value.liveViews = [{
      id: 't1',
      name: 'Tournament One',
      status: 'LIVE',
      poolStages: [],
      brackets: [{ id: 'b1', status: 'IN_PROGRESS', matches: [{ id: 'm1' }] }],
    } as never];
    stateMock.value.displayedLiveViews = [{ id: 't1', name: 'Tournament One', status: 'LIVE' } as LiveViewData];
    stateMock.value.visibleLiveViews = stateMock.value.displayedLiveViews;

    render(<LiveTournament />);

    expect(replace).toHaveBeenCalled();
  });

  it('does not redirect in screen mode when at least one active pool stage exists', () => {
    const replace = vi.fn();
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: { ...globalThis.window.location, replace },
    });

    stateMock.value.screenMode = true;
    stateMock.value.viewMode = 'pool-stages';
    stateMock.value.liveViews = [{
      id: 't1',
      name: 'Tournament One',
      status: 'LIVE',
      poolStages: [{ status: 'IN_PROGRESS', pools: [{ assignments: [{ id: 'a1' }] }] }],
      brackets: [{ id: 'b1', status: 'IN_PROGRESS', matches: [{ id: 'm1' }] }],
    } as never];
    stateMock.value.displayedLiveViews = [{ id: 't1', name: 'Tournament One', status: 'LIVE' } as LiveViewData];
    stateMock.value.visibleLiveViews = stateMock.value.displayedLiveViews;

    render(<LiveTournament />);

    expect(replace).not.toHaveBeenCalled();
  });

  it('shows signature status button in pool-stages filters', () => {
    stateMock.value.viewMode = 'pool-stages';
    stateMock.value.tournamentId = undefined;
    stateMock.value.visibleLiveViews = [{ id: 't1', name: 'Tournament One', status: 'LIVE' }];
    stateMock.value.displayedLiveViews = [stateMock.value.visibleLiveViews[0] as LiveViewData];

    render(<LiveTournament />);

    expect(screen.getByRole('button', { name: 'nav.signature' })).toBeInTheDocument();
  });

  it('hides pool-stages filter block when tournamentId is fixed in URL state', () => {
    stateMock.value.viewMode = 'pool-stages';
    stateMock.value.tournamentId = 't1';
    stateMock.value.visibleLiveViews = [
      { id: 't1', name: 'Tournament One', status: 'LIVE' },
      { id: 't2', name: 'Tournament Two', status: 'LIVE' },
    ];
    stateMock.value.displayedLiveViews = [stateMock.value.visibleLiveViews[0] as LiveViewData];

    render(<LiveTournament />);

    expect(screen.queryByLabelText('live.selectTournament')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.all' })).not.toBeInTheDocument();
  });

  it('does not render queue when no displayed views even if global queue is enabled', () => {
    stateMock.value.isAggregateView = false;
    stateMock.value.showGlobalQueue = true;
    stateMock.value.displayedLiveViews = [];
    stateMock.value.visibleLiveViews = [];

    render(<LiveTournament />);

    expect(screen.queryByText('queue')).not.toBeInTheDocument();
  });

  it('renders brackets empty-state copy in aggregate brackets mode', () => {
    stateMock.value.isAggregateView = true;
    stateMock.value.viewMode = 'brackets';
    stateMock.value.displayedLiveViews = [];
    stateMock.value.visibleLiveViews = [];
    stateMock.value.loading = false;
    stateMock.value.error = undefined;

    render(<LiveTournament />);

    expect(screen.getByText('live.noneBrackets')).toBeInTheDocument();
  });
});
