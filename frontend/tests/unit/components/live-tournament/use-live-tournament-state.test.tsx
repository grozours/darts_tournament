import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useLiveTournamentState from '../../../../src/components/live-tournament/use-live-tournament-state';

const handleSelectBracket = vi.fn();

vi.mock('../../../../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => ({
    enabled: true,
    isAuthenticated: true,
    isLoading: false,
    getAccessTokenSilently: vi.fn(async () => 'token'),
    user: { email: 'player@example.com' },
  }),
}));

vi.mock('../../../../src/auth/use-admin-status', () => ({
  useAdminStatus: () => ({ isAdmin: true }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-status-labels', () => ({
  default: () => ({ getStatusLabel: () => 'label' }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-parameters', () => ({
  default: () => ({
    viewMode: 'live',
    viewStatus: 'OPEN',
    tournamentId: 't1',
    stageId: 's1',
    bracketId: 'b1',
    isAggregateView: false,
    screenMode: false,
  }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-token', () => ({
  default: () => ({ getSafeAccessToken: vi.fn(async () => 'token') }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-data', () => ({
  default: () => ({
    liveViews: [{ id: 't1', name: 'Cup', status: 'OPEN', poolStages: [], brackets: [] }],
    loading: false,
    error: undefined,
    setError: vi.fn(),
    reloadLiveViews: vi.fn(async () => undefined),
  }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-player-ids', () => ({
  default: () => ({ playerIdByTournament: { t1: 'p1' } }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-selection', () => ({
  default: () => ({
    visibleLiveViews: [{ id: 't1', name: 'Cup', status: 'OPEN' }],
    displayedLiveViews: [{ id: 't1', name: 'Cup', status: 'OPEN', poolStages: [] }],
    selectedLiveTournamentId: 'ALL',
    setSelectedLiveTournamentId: vi.fn(),
    selectedPoolStagesTournamentId: 't1',
    setSelectedPoolStagesTournamentId: vi.fn(),
  }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-global-queue', () => ({
  default: () => ({ showGlobalQueue: true, globalQueue: [] }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-targets', () => ({
  default: () => ({
    availableTargetsByTournament: new Map(),
    schedulableTargetCountByTournament: new Map(),
    matchTargetSelections: {},
    handleTargetSelectionChange: vi.fn(),
    getTargetIdForSelection: vi.fn(),
    clearMatchTargetSelection: vi.fn(),
  }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-target-labels', () => ({
  default: () => ({
    formatTargetLabel: vi.fn(),
    getTargetLabel: vi.fn(),
    getMatchTargetLabel: vi.fn(),
  }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-match-key', () => ({
  default: () => ({ getMatchKey: (tournamentId: string, matchId: string) => `${tournamentId}:${matchId}` }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-match-actions', () => ({
  default: () => ({
    updatingMatchId: undefined,
    resettingPoolId: undefined,
    matchScores: {},
    editingMatchId: undefined,
    handleMatchStatusUpdate: vi.fn(async () => undefined),
    handleResetPoolMatches: vi.fn(async () => undefined),
    handleScoreChange: vi.fn(),
    handleCompleteMatch: vi.fn(async () => undefined),
    handleEditMatch: vi.fn(),
    cancelMatchEdit: vi.fn(),
    handleSaveMatchScores: vi.fn(async () => undefined),
  }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-stage-actions', () => ({
  default: () => ({
    editingStageId: undefined,
    stageStatusDrafts: {},
    stagePoolCountDrafts: {},
    stagePlayersPerPoolDrafts: {},
    updatingStageId: undefined,
    handleLaunchStage: vi.fn(async () => undefined),
    handleResetStage: vi.fn(async () => undefined),
    handleEditStage: vi.fn(),
    handleStageStatusChange: vi.fn(),
    handleStagePoolCountChange: vi.fn(),
    handleStagePlayersPerPoolChange: vi.fn(),
    handleUpdateStage: vi.fn(async () => undefined),
    handleDeleteStage: vi.fn(async () => undefined),
    handleCompleteStageWithScores: vi.fn(async () => undefined),
    handleRecomputeDoubleStage: vi.fn(async () => undefined),
    cancelEditStage: vi.fn(),
  }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-bracket-actions', () => ({
  default: () => ({
    updatingRoundKey: undefined,
    resettingBracketId: undefined,
    populatingBracketId: undefined,
    handleCompleteBracketRound: vi.fn(async () => undefined),
    handleResetBracketMatches: vi.fn(async () => undefined),
    handlePopulateBracketFromPools: vi.fn(async () => undefined),
    handleSelectBracket,
    activeBracketByTournament: {},
  }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-readonly', () => ({
  default: () => ({ isPoolStagesReadonly: true, isBracketsReadonly: false }),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-refresh', () => ({
  default: vi.fn(),
}));

describe('useLiveTournamentState', () => {
  it('composes state and preselects bracket from URL parameters', async () => {
    const { result } = renderHook(() => useLiveTournamentState());

    await waitFor(() => {
      expect(handleSelectBracket).toHaveBeenCalledWith('t1', 'b1');
    });

    expect(result.current.viewMode).toBe('live');
    expect(result.current.selectedLiveTournamentId).toBe('ALL');
    expect(result.current.isPoolStagesReadonly).toBe(true);
    expect(result.current.isBracketsReadonly).toBe(false);
  });
});
