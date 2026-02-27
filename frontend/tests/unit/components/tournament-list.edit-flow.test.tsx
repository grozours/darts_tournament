import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TournamentList from '../../../src/components/tournament-list';

const mockFetchTournaments = vi.fn(async () => undefined);
const mockDeleteTournament = vi.fn(async () => undefined);

const mockLoadPoolStages = vi.fn(async () => undefined);
const mockLoadBrackets = vi.fn(async () => undefined);
const mockLoadTargets = vi.fn(async () => undefined);
const mockAddPoolStage = vi.fn(async () => true);
const mockSavePoolStage = vi.fn(async () => undefined);
const mockRemovePoolStage = vi.fn(async () => undefined);
const mockSaveBracket = vi.fn(async () => undefined);
const mockSaveBracketTargets = vi.fn(async () => undefined);
const mockRemoveBracket = vi.fn(async () => undefined);

const mockFetchPlayers = vi.fn(async () => undefined);
const mockRegisterPlayer = vi.fn(async () => undefined);
const mockSavePlayerEdit = vi.fn(async () => undefined);
const mockAutoFillPlayers = vi.fn(async () => undefined);
const mockConfirmAllPlayers = vi.fn(async () => undefined);
const mockTogglePlayerCheckIn = vi.fn(async () => undefined);
const mockRemovePlayer = vi.fn(async () => undefined);

const mockCloseEdit = vi.fn();
const mockUploadLogo = vi.fn(async () => undefined);
const mockSaveEdit = vi.fn(async () => undefined);
const mockOpenRegistration = vi.fn(async () => undefined);
const mockMoveToSignature = vi.fn(async () => undefined);
const mockMoveToLive = vi.fn(async () => undefined);

const mockSetEditError = vi.fn();
const mockSetEditForm = vi.fn();
const mockSetEditingTournament = vi.fn();
const mockSetEditLoading = vi.fn();
const mockSetEditLoadError = vi.fn();
const mockSetIsSaving = vi.fn();
const mockSetLogoFile = vi.fn();
const mockSetIsUploadingLogo = vi.fn();

const mockOpenPoolStageAssignments = vi.fn(async () => undefined);
const mockClosePoolStageAssignments = vi.fn();
const mockUpdatePoolStageAssignment = vi.fn();
const mockSavePoolStageAssignments = vi.fn(async () => undefined);

const serviceMocks = vi.hoisted(() => ({
  fetchTournamentPresets: vi.fn(async () => []),
  deleteBracket: vi.fn(async () => undefined),
  deletePoolStage: vi.fn(async () => undefined),
  createPoolStage: vi.fn(async () => ({ id: 'created-stage-1' })),
  createBracket: vi.fn(async () => ({ id: 'created-bracket-1' })),
  updatePoolStage: vi.fn(async () => undefined),
}));
const mockGetAccessTokenSilently = vi.fn(async () => 'token-1');
const mockTranslate = (key: string) => key;

const testState = {
  isAdmin: false,
  authLoading: false,
  isAuthenticated: false,
  authEnabled: false,
  editingTournamentStatus: 'DRAFT',
  isAddingPoolStage: false,
  newPoolStageName: '',
  poolStages: [] as Array<{ id: string }> ,
  brackets: [] as Array<{ id: string }>,
};

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => ({
    enabled: testState.authEnabled,
    isAuthenticated: testState.isAuthenticated,
    isLoading: testState.authLoading,
    getAccessTokenSilently: mockGetAccessTokenSilently,
    user: undefined,
  }),
}));

vi.mock('../../../src/auth/use-admin-status', () => ({
  useAdminStatus: () => ({ isAdmin: testState.isAdmin }),
}));

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ t: mockTranslate }),
}));

vi.mock('../../../src/components/tournament-list/tournament-list-header', () => ({
  default: () => <div>header</div>,
}));

vi.mock('../../../src/components/tournament-list/tournament-list-groups', () => ({
  default: () => <div>groups</div>,
}));

vi.mock('../../../src/components/tournament-list/pool-stage-assignments-modal', () => ({
  default: () => <div>assignments-modal</div>,
}));

vi.mock('../../../src/components/tournament-list/tournament-edit-panel', () => ({
  default: (properties: {
    onLoadPoolStages: () => void;
    onLoadBrackets: () => void;
    onSaveEdit: () => void;
    onOpenRegistration: () => void;
    onMoveToSignature: () => void;
    onMoveToLive: () => void;
    onFetchPlayers: () => void;
    onSubmitPlayer: () => void;
    onAutoFillPlayers: () => void;
    onConfirmAllPlayers: () => void;
    onApplyStructurePreset: (preset: { name: string; presetType: string; templateConfig: Record<string, unknown> }) => void;
    onSavePoolStage: (stage: { id: string }) => void;
    onRemovePoolStage: (id: string) => void;
    onSaveBracket: (bracket: { id: string }) => void;
    onSaveBracketTargets: (bracket: { id: string }) => void;
    onRemoveBracket: (id: string) => void;
  }) => (
    <div data-testid="edit-panel">
      <button onClick={properties.onLoadPoolStages}>load-pools</button>
      <button onClick={properties.onLoadBrackets}>load-brackets</button>
      <button onClick={properties.onSaveEdit}>save-edit</button>
      <button onClick={properties.onOpenRegistration}>open-registration</button>
      <button onClick={properties.onMoveToSignature}>move-signature</button>
      <button onClick={properties.onMoveToLive}>move-live</button>
      <button onClick={properties.onFetchPlayers}>fetch-players</button>
      <button onClick={properties.onSubmitPlayer}>submit-player</button>
      <button onClick={properties.onAutoFillPlayers}>auto-fill</button>
      <button onClick={properties.onConfirmAllPlayers}>confirm-all</button>
      <button onClick={() => properties.onSavePoolStage({ id: 'stage-1' })}>save-stage</button>
      <button onClick={() => properties.onRemovePoolStage('stage-1')}>remove-stage</button>
      <button onClick={() => properties.onSaveBracket({ id: 'bracket-1' })}>save-bracket</button>
      <button onClick={() => properties.onSaveBracketTargets({ id: 'bracket-1' })}>save-bracket-targets</button>
      <button onClick={() => properties.onRemoveBracket('bracket-1')}>remove-bracket</button>
      <button
        onClick={() => properties.onApplyStructurePreset({
          name: 'Preset X',
          presetType: 'custom',
          templateConfig: {},
        })}
      >
        apply-preset
      </button>
    </div>
  ),
}));

vi.mock('../../../src/components/tournament-list/use-tournament-list-data', () => ({
  default: () => ({
    tournaments: [],
    loading: false,
    error: undefined,
    fetchTournaments: mockFetchTournaments,
    deleteTournament: mockDeleteTournament,
  }),
}));

vi.mock('../../../src/components/tournament-list/use-tournament-edit-state', () => ({
  default: () => ({
    editingTournament: {
      id: 'tournament-1',
      name: 'Cup A',
      status: testState.editingTournamentStatus,
      totalParticipants: 8,
      format: 'SINGLE',
    },
    editForm: {
      name: 'Cup A',
      format: 'SINGLE',
      totalParticipants: 8,
      targetCount: 2,
    },
    editError: undefined,
    editLoading: false,
    editLoadError: undefined,
    isSaving: false,
    logoFile: undefined,
    isUploadingLogo: false,
    setEditingTournament: mockSetEditingTournament,
    setEditForm: mockSetEditForm,
    setEditError: mockSetEditError,
    setEditLoading: mockSetEditLoading,
    setEditLoadError: mockSetEditLoadError,
    setIsSaving: mockSetIsSaving,
    setLogoFile: mockSetLogoFile,
    setIsUploadingLogo: mockSetIsUploadingLogo,
  }),
}));

vi.mock('../../../src/components/tournament-list/use-tournament-structure', () => ({
  default: () => ({
    poolStages: testState.poolStages,
    poolStagesError: undefined,
    isAddingPoolStage: testState.isAddingPoolStage,
    newPoolStage: { name: testState.newPoolStageName },
    brackets: testState.brackets,
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
    addPoolStage: mockAddPoolStage,
    savePoolStage: mockSavePoolStage,
    removePoolStage: mockRemovePoolStage,
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
    saveBracket: mockSaveBracket,
    saveBracketTargets: mockSaveBracketTargets,
    removeBracket: mockRemoveBracket,
    startAddBracket: vi.fn(),
    cancelAddBracket: vi.fn(),
    handleNewBracketNameChange: vi.fn(),
    handleNewBracketTypeChange: vi.fn(),
    handleNewBracketRoundsChange: vi.fn(),
    handleNewBracketRoundMatchFormatChange: vi.fn(),
    resetStructureState: vi.fn(),
  }),
}));

vi.mock('../../../src/components/tournament-list/use-tournament-players', () => ({
  default: () => ({
    players: [],
    playersLoading: false,
    playersError: undefined,
    playerForm: { firstName: '', lastName: '' },
    editingPlayerId: undefined,
    checkingInPlayerId: undefined,
    isRegisteringPlayer: false,
    isAutoFillingPlayers: false,
    isConfirmingAll: false,
    playerActionLabel: 'add',
    setPlayerForm: vi.fn(),
    clearPlayers: vi.fn(),
    clearPlayersError: vi.fn(),
    resetPlayersState: vi.fn(),
    fetchPlayers: mockFetchPlayers,
    startEditPlayer: vi.fn(),
    cancelEditPlayer: vi.fn(),
    registerPlayer: mockRegisterPlayer,
    savePlayerEdit: mockSavePlayerEdit,
    removePlayer: mockRemovePlayer,
    togglePlayerCheckIn: mockTogglePlayerCheckIn,
    confirmAllPlayers: mockConfirmAllPlayers,
    autoFillPlayers: mockAutoFillPlayers,
  }),
}));

vi.mock('../../../src/components/tournament-list/use-tournament-list-edit-flow', () => ({
  default: () => ({
    openEdit: vi.fn(),
    closeEdit: mockCloseEdit,
    uploadLogo: mockUploadLogo,
    saveEdit: mockSaveEdit,
    openRegistration: mockOpenRegistration,
    moveToSignature: mockMoveToSignature,
    moveToLive: mockMoveToLive,
  }),
}));

vi.mock('../../../src/components/tournament-list/use-pool-stage-assignments', () => ({
  default: () => ({
    editingPoolStage: undefined,
    poolStagePools: [],
    poolStagePlayers: [],
    poolStageAssignments: [],
    poolStageEditError: undefined,
    isSavingAssignments: false,
    openPoolStageAssignments: mockOpenPoolStageAssignments,
    closePoolStageAssignments: mockClosePoolStageAssignments,
    updatePoolStageAssignment: mockUpdatePoolStageAssignment,
    savePoolStageAssignments: mockSavePoolStageAssignments,
  }),
}));

vi.mock('../../../src/components/tournament-list/use-tournament-list-registrations', () => ({
  default: () => ({
    userRegistrations: {},
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

vi.mock('../../../src/services/tournament-service', () => ({
  fetchTournamentPresets: serviceMocks.fetchTournamentPresets,
  deleteBracket: serviceMocks.deleteBracket,
  deletePoolStage: serviceMocks.deletePoolStage,
  createPoolStage: serviceMocks.createPoolStage,
  createBracket: serviceMocks.createBracket,
  updatePoolStage: serviceMocks.updatePoolStage,
}));

vi.mock('../../../src/utils/tournament-presets', () => ({
  buildTournamentPresetTemplate: () => ({
    format: 'SINGLE',
    stages: [{ name: 'Stage A', poolCount: 2, playersPerPool: 4, advanceCount: 2 }],
    brackets: [{ name: 'Bracket A', totalRounds: 2 }],
  }),
  buildPresetRoutingUpdates: () => [],
}));

describe('TournamentList edit flow callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.window?.history.pushState({}, '', '/?view=edit-tournament&tournamentId=tournament-1');
    vi.stubGlobal('confirm', vi.fn(() => true));

    testState.isAdmin = false;
    testState.authLoading = false;
    testState.authEnabled = false;
    testState.isAuthenticated = false;
    testState.editingTournamentStatus = 'DRAFT';
    testState.isAddingPoolStage = false;
    testState.newPoolStageName = '';
    testState.poolStages = [];
    testState.brackets = [];
  });

  it('renders the edit panel in edit-tournament mode', async () => {
    render(<TournamentList />);

    await waitFor(() => {
      expect(screen.getByTestId('edit-panel')).toBeInTheDocument();
    });
  });

  it('wires edit-panel callbacks to list handlers', async () => {
    render(<TournamentList />);
    await screen.findByTestId('edit-panel');

    fireEvent.click(screen.getByText('load-pools'));
    fireEvent.click(screen.getByText('load-brackets'));
    fireEvent.click(screen.getByText('save-edit'));
    fireEvent.click(screen.getByText('open-registration'));
    fireEvent.click(screen.getByText('move-signature'));
    fireEvent.click(screen.getByText('move-live'));
    fireEvent.click(screen.getByText('fetch-players'));
    fireEvent.click(screen.getByText('submit-player'));
    fireEvent.click(screen.getByText('auto-fill'));
    fireEvent.click(screen.getByText('confirm-all'));
    fireEvent.click(screen.getByText('save-stage'));
    fireEvent.click(screen.getByText('remove-stage'));
    fireEvent.click(screen.getByText('save-bracket'));
    fireEvent.click(screen.getByText('save-bracket-targets'));
    fireEvent.click(screen.getByText('remove-bracket'));

    await waitFor(() => {
      expect(mockLoadPoolStages).toHaveBeenCalledWith('tournament-1');
      expect(mockLoadBrackets).toHaveBeenCalledWith('tournament-1');
      expect(mockLoadTargets).toHaveBeenCalledWith('tournament-1');
      expect(mockSaveEdit).toHaveBeenCalled();
      expect(mockOpenRegistration).toHaveBeenCalled();
      expect(mockMoveToSignature).toHaveBeenCalled();
      expect(mockMoveToLive).toHaveBeenCalled();
      expect(mockFetchPlayers).toHaveBeenCalledWith('tournament-1');
      expect(mockRegisterPlayer).toHaveBeenCalled();
      expect(mockAutoFillPlayers).toHaveBeenCalled();
      expect(mockConfirmAllPlayers).toHaveBeenCalled();
      expect(mockSavePoolStage).toHaveBeenCalledWith({ id: 'stage-1' });
      expect(mockRemovePoolStage).toHaveBeenCalledWith('stage-1');
      expect(mockSaveBracket).toHaveBeenCalledWith({ id: 'bracket-1' });
      expect(mockSaveBracketTargets).toHaveBeenCalledWith({ id: 'bracket-1' });
      expect(mockRemoveBracket).toHaveBeenCalledWith('bracket-1');
    });
  });

  it('adds a pending pool stage before saving edit when add-mode is active', async () => {
    testState.isAddingPoolStage = true;
    testState.newPoolStageName = 'Stage To Add';

    render(<TournamentList />);
    await screen.findByTestId('edit-panel');
    fireEvent.click(screen.getByText('save-edit'));

    await waitFor(() => {
      expect(mockAddPoolStage).toHaveBeenCalled();
      expect(mockSaveEdit).toHaveBeenCalled();
    });
  });

  it('blocks structure preset apply on live tournament and sets edit error', async () => {
    testState.editingTournamentStatus = 'LIVE';

    render(<TournamentList />);
    await screen.findByTestId('edit-panel');
    fireEvent.click(screen.getByText('apply-preset'));

    await waitFor(() => {
      expect(mockSetEditError).toHaveBeenCalledWith('edit.quickStructureDisabledLive');
    });

    expect(serviceMocks.deleteBracket).not.toHaveBeenCalled();
    expect(serviceMocks.deletePoolStage).not.toHaveBeenCalled();
    expect(serviceMocks.createPoolStage).not.toHaveBeenCalled();
    expect(serviceMocks.createBracket).not.toHaveBeenCalled();
  });

  it('applies structure preset and refreshes structure in non-live edit mode', async () => {
    testState.editingTournamentStatus = 'DRAFT';
    testState.poolStages = [{ id: 'existing-stage-1' }];
    testState.brackets = [{ id: 'existing-bracket-1' }];

    render(<TournamentList />);
    await screen.findByTestId('edit-panel');
    fireEvent.click(screen.getByText('apply-preset'));

    await waitFor(() => {
      expect(serviceMocks.deleteBracket).toHaveBeenCalledWith('tournament-1', 'existing-bracket-1', undefined);
      expect(serviceMocks.deletePoolStage).toHaveBeenCalledWith('tournament-1', 'existing-stage-1', undefined);
      expect(serviceMocks.createPoolStage).toHaveBeenCalled();
      expect(serviceMocks.createBracket).toHaveBeenCalled();
      expect(mockLoadPoolStages).toHaveBeenCalledWith('tournament-1');
      expect(mockLoadBrackets).toHaveBeenCalledWith('tournament-1');
    });
  });

  it('renders auth loading state when auth is still loading', () => {
    testState.authLoading = true;

    render(<TournamentList />);

    expect(screen.getByText('auth.checkingSession')).toBeInTheDocument();
  });
});
