import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TargetsView from '../../../src/components/targets-view';
import { TournamentFormat } from '@shared/types';

const fetchDoublettesMock = vi.fn();
const fetchEquipesMock = vi.fn();
const useTargetsViewDataMock = vi.fn();
const useTargetsViewDerivedMock = vi.fn();
const useTargetsViewActionsMock = vi.fn();
const translate = (key: string) => key;

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ t: translate }),
}));

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => ({ enabled: false, getAccessTokenSilently: vi.fn() }),
}));

vi.mock('../../../src/auth/use-admin-status', () => ({
  useAdminStatus: () => ({ isAdmin: true }),
}));

vi.mock('../../../src/services/tournament-service', () => ({
  fetchDoublettes: (...args: unknown[]) => fetchDoublettesMock(...args),
  fetchEquipes: (...args: unknown[]) => fetchEquipesMock(...args),
}));

vi.mock('../../../src/components/targets-view/use-targets-view-data', () => ({
  default: (...args: unknown[]) => useTargetsViewDataMock(...args),
}));

vi.mock('../../../src/components/targets-view/use-targets-view-derived', () => ({
  default: (...args: unknown[]) => useTargetsViewDerivedMock(...args),
}));

vi.mock('../../../src/components/targets-view/use-targets-view-actions', () => ({
  default: (...args: unknown[]) => useTargetsViewActionsMock(...args),
}));

vi.mock('../../../src/components/targets-view/targets-view-state', () => ({
  default: () => <div>TARGETS_STATE</div>,
}));

vi.mock('../../../src/components/targets-view/targets-view-content', () => ({
  default: () => <div>TARGETS_CONTENT</div>,
}));

const buildDataState = (overrides: Record<string, unknown> = {}) => ({
  liveViews: [],
  loading: false,
  error: undefined,
  setError: vi.fn(),
  setLiveViews: vi.fn(),
  loadTargets: vi.fn(async () => undefined),
  getSafeAccessToken: vi.fn(async () => undefined),
  ...overrides,
});

const buildDerivedState = (overrides: Record<string, unknown> = {}) => ({
  scopedViews: [],
  matchDetailsById: new Map(),
  matchTournamentById: new Map(),
  sharedTargets: [],
  queueItems: [],
  queuePreview: [],
  ...overrides,
});

const buildActionsState = () => ({
  matchSelectionByTarget: {},
  startingMatchId: undefined,
  updatingMatchId: undefined,
  cancellingMatchId: undefined,
  matchScores: {},
  handleQueueSelectionChange: vi.fn(),
  handleStartMatch: vi.fn(async () => undefined),
  handleScoreChange: vi.fn(),
  handleCompleteMatch: vi.fn(async () => undefined),
  handleCancelMatch: vi.fn(async () => undefined),
});

describe('TargetsView branches', () => {
  beforeEach(() => {
    fetchDoublettesMock.mockReset();
    fetchEquipesMock.mockReset();
    fetchDoublettesMock.mockResolvedValue([]);
    fetchEquipesMock.mockResolvedValue([]);
    useTargetsViewActionsMock.mockReturnValue(buildActionsState());
  });

  it('renders state view for loading/error/empty derived branches', () => {
    useTargetsViewDataMock.mockReturnValue(buildDataState({ loading: true }));
    useTargetsViewDerivedMock.mockReturnValue(buildDerivedState());

    const { rerender } = render(<TargetsView />);
    expect(screen.getByText('TARGETS_STATE')).toBeInTheDocument();

    useTargetsViewDataMock.mockReturnValue(buildDataState({ error: 'boom' }));
    rerender(<TargetsView />);
    expect(screen.getByText('TARGETS_STATE')).toBeInTheDocument();

    useTargetsViewDataMock.mockReturnValue(buildDataState());
    useTargetsViewDerivedMock.mockReturnValue(buildDerivedState({ scopedViews: [] }));
    rerender(<TargetsView />);
    expect(screen.getByText('TARGETS_STATE')).toBeInTheDocument();
  });

  it('renders content and loads DOUBLE group labels', async () => {
    globalThis.history.pushState({}, '', '/?tournamentId=t1');
    const getSafeAccessToken = vi.fn(async () => 'token');
    fetchDoublettesMock.mockResolvedValueOnce([
      {
        id: 'd1',
        name: 'Duo One',
        members: [{ playerId: 'p1' }, { playerId: 'p2' }],
      },
    ]);
    useTargetsViewDataMock.mockReturnValue(buildDataState({
      getSafeAccessToken,
      liveViews: [{ id: 't1', status: 'LIVE', format: TournamentFormat.DOUBLE }],
    }));
    useTargetsViewDerivedMock.mockReturnValue(buildDerivedState({
      scopedViews: [{ id: 't1' }],
      sharedTargets: [],
    }));

    render(<TargetsView />);

    expect(screen.getByText('TARGETS_CONTENT')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchDoublettesMock).toHaveBeenCalledWith('t1', 'token');
    });
    expect(fetchEquipesMock).not.toHaveBeenCalled();
  });

  it('loads TEAM group labels and handles service failures', async () => {
    globalThis.history.pushState({}, '', '/?tournamentId=t2');
    const getSafeAccessToken = vi.fn(async () => 'token');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    fetchEquipesMock.mockRejectedValueOnce(new Error('groups failed'));

    useTargetsViewDataMock.mockReturnValue(buildDataState({
      getSafeAccessToken,
      liveViews: [{ id: 't2', status: 'LIVE', format: TournamentFormat.TEAM_4_PLAYER }],
    }));
    useTargetsViewDerivedMock.mockReturnValue(buildDerivedState({
      scopedViews: [{ id: 't2' }],
      sharedTargets: [],
    }));

    render(<TargetsView />);

    await waitFor(() => {
      expect(fetchEquipesMock).toHaveBeenCalledWith('t2', 'token');
    });
    expect(consoleSpy).toHaveBeenCalled();
  });
});
