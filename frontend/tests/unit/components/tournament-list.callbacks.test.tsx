import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TournamentList from '../../../src/components/tournament-list';

const mockLoadPoolStages = vi.fn();
const mockLoadBrackets = vi.fn();
const mockLoadTargets = vi.fn();
const mockFetchPlayers = vi.fn();
const mockRegisterPlayer = vi.fn();
const mockSavePlayerEdit = vi.fn();

let mockEditingPlayerId: string | undefined;

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => ({
    enabled: false,
    isAuthenticated: false,
    isLoading: false,
    getAccessTokenSilently: vi.fn(),
    user: undefined,
  }),
}));

vi.mock('../../../src/auth/use-admin-status', () => ({
  useAdminStatus: () => ({ isAdmin: true }),
}));

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../src/components/tournament-list/tournament-status-helpers', () => ({
  getStatusLabel: () => 'status',
  normalizeStageStatus: (status: string) => status,
  normalizeTournamentStatus: (status?: string) => status ?? '',
}));

vi.mock('../../../src/components/tournament-list/tournament-list-header', () => ({
  default: () => <div data-testid="header" />,
}));

vi.mock('../../../src/components/tournament-list/tournament-list-groups', () => ({
  default: () => <div data-testid="groups" />,
}));

vi.mock('../../../src/components/tournament-list/pool-stage-assignments-modal', () => ({
  default: () => <div data-testid="assignments-modal" />,
}));

vi.mock('../../../src/components/tournament-list/tournament-edit-panel', () => ({
  default: (properties: {
    onLoadPoolStages: () => void;
    onLoadBrackets: () => void;
    onFetchPlayers: () => void;
    onSubmitPlayer: () => void;
  }) => (
    <div>
      <button onClick={properties.onLoadPoolStages} type="button">load-pool-stages</button>
      <button onClick={properties.onLoadBrackets} type="button">load-brackets</button>
      <button onClick={properties.onFetchPlayers} type="button">fetch-players</button>
      <button onClick={properties.onSubmitPlayer} type="button">submit-player</button>
    </div>
  ),
}));

vi.mock('../../../src/components/tournament-list/use-tournament-list-data', () => ({
  default: () => ({
    tournaments: [],
    loading: false,
    error: undefined,
    fetchTournaments: vi.fn(),
    deleteTournament: vi.fn(),
  }),
}));

vi.mock('../../../src/components/tournament-list/use-tournament-edit-state', () => ({
  default: () => ({
    editingTournament: { id: 'edit-1', status: 'DRAFT' },
    editForm: { totalParticipants: 8 },
    editError: undefined,
    editLoading: false,
    editLoadError: undefined,
    isSaving: false,
    logoFile: undefined,
    isUploadingLogo: false,
    setEditingTournament: vi.fn(),
    setEditForm: vi.fn(),
    setEditError: vi.fn(),
    setEditLoading: vi.fn(),
    setEditLoadError: vi.fn(),
    setIsSaving: vi.fn(),
    setLogoFile: vi.fn(),
    setIsUploadingLogo: vi.fn(),
  }),
}));

vi.mock('../../../src/components/tournament-list/use-tournament-players', () => ({
  default: () => ({
    players: [],
    playersLoading: false,
    playersError: undefined,
    playerForm: { firstName: '', lastName: '' },
    editingPlayerId: mockEditingPlayerId,
    checkingInPlayerId: undefined,
    isRegisteringPlayer: false,
    isAutoFillingPlayers: false,
    isConfirmingAll: false,
    playerActionLabel: 'action',
    setPlayerForm: vi.fn(),
    clearPlayers: vi.fn(),
    clearPlayersError: vi.fn(),
    resetPlayersState: vi.fn(),
    fetchPlayers: mockFetchPlayers,
    startEditPlayer: vi.fn(),
    cancelEditPlayer: vi.fn(),
    registerPlayer: mockRegisterPlayer,
    savePlayerEdit: mockSavePlayerEdit,
    removePlayer: vi.fn(),
    togglePlayerCheckIn: vi.fn(),
    confirmAllPlayers: vi.fn(),
    autoFillPlayers: vi.fn(),
  }),
}));

vi.mock('../../../src/components/tournament-list/use-tournament-structure', () => ({
  default: () => ({
    poolStages: [],
    poolStagesError: undefined,
    isAddingPoolStage: false,
    newPoolStage: { name: '' },
    brackets: [],
    bracketsError: undefined,
    targets: [],
    targetsError: undefined,
    isAddingBracket: false,
    newBracket: { name: '' },
    loadPoolStages: mockLoadPoolStages,
    loadBrackets: mockLoadBrackets,
    loadTargets: mockLoadTargets,
    handlePoolStageNumberChange: vi.fn(),
    handlePoolStageNameChange: vi.fn(),
    handlePoolStagePoolCountChange: vi.fn(),
    handlePoolStagePlayersPerPoolChange: vi.fn(),
    handlePoolStageAdvanceCountChange: vi.fn(),
    handlePoolStageMatchFormatChange: vi.fn(),
    handlePoolStageLosersAdvanceChange: vi.fn(),
    handlePoolStageRankingDestinationChange: vi.fn(),
    handlePoolStageStatusChange: vi.fn(),
    addPoolStage: vi.fn(),
    savePoolStage: vi.fn(),
    removePoolStage: vi.fn(),
    startAddPoolStage: vi.fn(),
    cancelAddPoolStage: vi.fn(),
    handleNewPoolStageStageNumberChange: vi.fn(),
    handleNewPoolStageNameChange: vi.fn(),
    handleNewPoolStagePoolCountChange: vi.fn(),
    handleNewPoolStagePlayersPerPoolChange: vi.fn(),
    handleNewPoolStageAdvanceCountChange: vi.fn(),
    handleNewPoolStageMatchFormatChange: vi.fn(),
    handleNewPoolStageLosersAdvanceChange: vi.fn(),
    handleNewPoolStageRankingDestinationChange: vi.fn(),
    handleBracketNameChange: vi.fn(),
    handleBracketTypeChange: vi.fn(),
    handleBracketRoundsChange: vi.fn(),
    handleBracketRoundMatchFormatChange: vi.fn(),
    handleBracketStatusChange: vi.fn(),
    handleBracketTargetToggle: vi.fn(),
    addBracket: vi.fn(),
    saveBracket: vi.fn(),
    saveBracketTargets: vi.fn(),
    removeBracket: vi.fn(),
    startAddBracket: vi.fn(),
    cancelAddBracket: vi.fn(),
    handleNewBracketNameChange: vi.fn(),
    handleNewBracketTypeChange: vi.fn(),
    handleNewBracketRoundsChange: vi.fn(),
    handleNewBracketRoundMatchFormatChange: vi.fn(),
    resetStructureState: vi.fn(),
  }),
}));

vi.mock('../../../src/components/tournament-list/use-tournament-list-edit-flow', () => ({
  default: () => ({
    openEdit: vi.fn(),
    closeEdit: vi.fn(),
    uploadLogo: vi.fn(),
    saveEdit: vi.fn(),
    openRegistration: vi.fn(),
    moveToSignature: vi.fn(),
    moveToLive: vi.fn(),
  }),
}));

vi.mock('../../../src/components/tournament-list/use-pool-stage-assignments', () => ({
  default: () => ({
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
  }),
}));

vi.mock('../../../src/components/tournament-list/use-tournament-list-registrations', () => ({
  default: () => ({
    userRegistrations: [],
    registeringTournamentId: undefined,
    handleRegisterSelf: vi.fn(),
    handleUnregisterSelf: vi.fn(),
  }),
}));

vi.mock('../../../src/components/tournament-list/use-tournament-options', () => ({
  default: () => ({
    formatOptions: [],
    durationOptions: [],
    skillLevelOptions: [],
  }),
}));

vi.mock('../../../src/components/tournament-list/use-tournament-list-grouping', () => ({
  default: () => ({ groupedTournaments: [] }),
}));

describe('TournamentList callback wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditingPlayerId = undefined;
    globalThis.window?.history.pushState({}, '', '/?view=edit-tournament&tournamentId=edit-1');
  });

  it('calls edit callbacks with current tournament id and registers a new player', () => {
    render(<TournamentList />);

    fireEvent.click(screen.getByRole('button', { name: 'load-pool-stages' }));
    fireEvent.click(screen.getByRole('button', { name: 'load-brackets' }));
    fireEvent.click(screen.getByRole('button', { name: 'fetch-players' }));
    fireEvent.click(screen.getByRole('button', { name: 'submit-player' }));

    expect(mockLoadPoolStages).toHaveBeenCalledWith('edit-1');
    expect(mockLoadBrackets).toHaveBeenCalledWith('edit-1');
    expect(mockLoadTargets).toHaveBeenCalledWith('edit-1');
    expect(mockFetchPlayers).toHaveBeenCalledWith('edit-1');
    expect(mockRegisterPlayer).toHaveBeenCalled();
    expect(mockSavePlayerEdit).not.toHaveBeenCalled();
  });

  it('submits player edit when an editing player id exists', () => {
    mockEditingPlayerId = 'player-1';

    render(<TournamentList />);

    fireEvent.click(screen.getByRole('button', { name: 'submit-player' }));

    expect(mockSavePlayerEdit).toHaveBeenCalled();
    expect(mockRegisterPlayer).not.toHaveBeenCalled();
  });
});
