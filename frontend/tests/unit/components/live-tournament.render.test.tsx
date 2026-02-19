import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LiveViewData } from '../../../src/components/live-tournament/types';
import LiveTournament from '../../../src/components/live-tournament';

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
  default: () => {},
}));

vi.mock('../../../src/components/live-tournament/live-tournament-view', () => ({
  default: () => <div>live-view</div>,
}));

vi.mock('../../../src/components/live-tournament/match-queue-section', () => ({
  default: () => <div>queue</div>,
}));

describe('LiveTournament rendering', () => {
  beforeEach(() => {
    stateMock.value.displayedLiveViews = [];
    stateMock.value.visibleLiveViews = [];
    stateMock.value.showGlobalQueue = false;
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
    expect(screen.getByText('live-view')).toBeInTheDocument();
  });
});
