import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useLiveTournamentCoreState from '../../../../src/components/live-tournament/use-live-tournament-core-state';

const useI18nMock = vi.fn();
const useOptionalAuthMock = vi.fn();
const useAdminStatusMock = vi.fn();
const statusLabelsMock = vi.fn();
const parametersMock = vi.fn();
const tokenMock = vi.fn();
const dataMock = vi.fn();
const playerIdsMock = vi.fn();
const selectionMock = vi.fn();
const globalQueueMock = vi.fn();
const targetsMock = vi.fn();
const targetLabelsMock = vi.fn();
const matchKeyMock = vi.fn();
const readonlyMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('../../../../src/i18n', () => ({
  useI18n: () => useI18nMock(),
}));

vi.mock('../../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => useOptionalAuthMock(),
}));

vi.mock('../../../../src/auth/use-admin-status', () => ({
  useAdminStatus: () => useAdminStatusMock(),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-status-labels', () => ({
  default: (...arguments_: unknown[]) => statusLabelsMock(...arguments_),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-parameters', () => ({
  default: () => parametersMock(),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-token', () => ({
  default: (...arguments_: unknown[]) => tokenMock(...arguments_),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-data', () => ({
  default: (...arguments_: unknown[]) => dataMock(...arguments_),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-player-ids', () => ({
  default: (...arguments_: unknown[]) => playerIdsMock(...arguments_),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-selection', () => ({
  default: (...arguments_: unknown[]) => selectionMock(...arguments_),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-global-queue', () => ({
  default: (...arguments_: unknown[]) => globalQueueMock(...arguments_),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-targets', () => ({
  default: (...arguments_: unknown[]) => targetsMock(...arguments_),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-target-labels', () => ({
  default: (...arguments_: unknown[]) => targetLabelsMock(...arguments_),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-match-key', () => ({
  default: () => matchKeyMock(),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-readonly', () => ({
  default: (...arguments_: unknown[]) => readonlyMock(...arguments_),
}));

vi.mock('../../../../src/components/live-tournament/use-live-tournament-refresh', () => ({
  default: (...arguments_: unknown[]) => refreshMock(...arguments_),
}));

describe('useLiveTournamentCoreState', () => {
  beforeEach(() => {
    useI18nMock.mockReset();
    useOptionalAuthMock.mockReset();
    useAdminStatusMock.mockReset();
    statusLabelsMock.mockReset();
    parametersMock.mockReset();
    tokenMock.mockReset();
    dataMock.mockReset();
    playerIdsMock.mockReset();
    selectionMock.mockReset();
    globalQueueMock.mockReset();
    targetsMock.mockReset();
    targetLabelsMock.mockReset();
    matchKeyMock.mockReset();
    readonlyMock.mockReset();
    refreshMock.mockReset();

    useI18nMock.mockReturnValue({ t: (key: string) => key });
    useOptionalAuthMock.mockReturnValue({
      enabled: true,
      isAuthenticated: true,
      isLoading: false,
      getAccessTokenSilently: vi.fn(async () => 'token'),
      error: undefined,
      user: { email: 'user@example.com' },
    });
    useAdminStatusMock.mockReturnValue({ isAdmin: false, adminUser: undefined });
    statusLabelsMock.mockReturnValue({ getStatusLabel: () => 'status' });
    parametersMock.mockReturnValue({
      viewMode: 'all',
      viewStatus: 'LIVE',
      tournamentId: undefined,
      stageId: undefined,
      bracketId: undefined,
      isAggregateView: false,
      screenMode: false,
    });
    tokenMock.mockReturnValue({ getSafeAccessToken: vi.fn(async () => 'token') });
    dataMock.mockReturnValue({
      liveViews: [{ id: 't1' }],
      loading: false,
      error: undefined,
      setError: vi.fn(),
      reloadLiveViews: vi.fn(async () => undefined),
    });
    playerIdsMock.mockReturnValue({ playerIdByTournament: { t1: 'p1' } });
    selectionMock.mockReturnValue({
      visibleLiveViews: [{ id: 't1' }],
      displayedLiveViews: [{ id: 't1' }],
      selectedLiveTournamentId: 't1',
      setSelectedLiveTournamentId: vi.fn(),
      selectedPoolStagesTournamentId: 't1',
      setSelectedPoolStagesTournamentId: vi.fn(),
    });
    globalQueueMock.mockReturnValue({ showGlobalQueue: false, globalQueue: [] });
    targetsMock.mockReturnValue({
      availableTargetsByTournament: new Map(),
      schedulableTargetCountByTournament: {},
      matchTargetSelections: {},
      handleTargetSelectionChange: vi.fn(),
      getTargetIdForSelection: vi.fn(),
      clearMatchTargetSelection: vi.fn(),
    });
    targetLabelsMock.mockReturnValue({
      formatTargetLabel: vi.fn(),
      getTargetLabel: vi.fn(),
      getMatchTargetLabel: vi.fn(),
    });
    matchKeyMock.mockReturnValue({ getMatchKey: vi.fn() });
    readonlyMock.mockReturnValue({ isPoolStagesReadonly: true, isBracketsReadonly: true });
  });

  it('builds core state and passes user plus fallback email when admin user exists', () => {
    useAdminStatusMock.mockReturnValue({
      isAdmin: true,
      adminUser: { email: 'admin@example.com' },
    });

    renderHook(() => useLiveTournamentCoreState());

    expect(playerIdsMock).toHaveBeenCalledWith(expect.objectContaining({
      user: { email: 'user@example.com' },
      fallbackUserEmail: 'admin@example.com',
    }));
  });

  it('does not pass fallback email when admin email is unavailable and configures refresh guard', () => {
    useOptionalAuthMock.mockReturnValue({
      enabled: true,
      isAuthenticated: false,
      isLoading: true,
      getAccessTokenSilently: vi.fn(async () => undefined),
      error: undefined,
      user: undefined,
    });
    useAdminStatusMock.mockReturnValue({ isAdmin: false, adminUser: {} });

    renderHook(() => useLiveTournamentCoreState());

    expect(playerIdsMock).toHaveBeenCalledWith(expect.not.objectContaining({
      fallbackUserEmail: expect.any(String),
    }));
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({
      canRefresh: false,
    }));
  });
});
