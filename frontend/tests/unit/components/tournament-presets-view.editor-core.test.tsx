import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TournamentPresetsView from '../../../src/components/tournament-presets-view';

const fetchTournamentPresets = vi.fn();
const createTournamentPreset = vi.fn();
const updateTournamentPreset = vi.fn();
const deleteTournamentPreset = vi.fn();
const mockTranslate = (key: string) => key;
const mockGetAccessTokenSilently = vi.fn<() => Promise<string | undefined>>(async () => undefined);
const mockGetDefaultPresetTemplateConfig = vi.fn(() => ({
  format: 'SINGLE',
  stages: [{ name: 'Stage 1', poolCount: 2, playersPerPool: 4, advanceCount: 2 }],
  brackets: [{ name: 'Bracket 1', totalRounds: 3 }],
  routingRules: [],
}));
const authState = { enabled: false, isAuthenticated: false };

vi.mock('../../../src/i18n', () => ({ useI18n: () => ({ t: mockTranslate }) }));
vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => ({
    enabled: authState.enabled,
    isAuthenticated: authState.isAuthenticated,
    getAccessTokenSilently: mockGetAccessTokenSilently,
  }),
}));
vi.mock('../../../src/services/tournament-service', () => ({
  fetchTournamentPresets: (...args: unknown[]) => fetchTournamentPresets(...args),
  createTournamentPreset: (...args: unknown[]) => createTournamentPreset(...args),
  updateTournamentPreset: (...args: unknown[]) => updateTournamentPreset(...args),
  deleteTournamentPreset: (...args: unknown[]) => deleteTournamentPreset(...args),
}));
vi.mock('../../../src/components/tournament-list/pool-stages-editor', () => ({
  default: (properties: {
    poolStages?: Array<{ id: string }>;
    onStartAddPoolStage?: () => void;
    onPoolStageMatchFormatChange?: (id: string, value: string | undefined) => void;
    onNewPoolStageNameChange?: (value: string) => void;
    onNewPoolStagePlayersPerPoolChange?: (value: number) => void;
    onNewPoolStageMatchFormatChange?: (value: string | undefined) => void;
    onNewPoolStageRankingDestinationChange?: (position: number, destination: { destinationType: 'ELIMINATED' }) => void;
    onRemovePoolStage?: (id: string) => void;
    onAddPoolStage?: () => Promise<boolean>;
  }) => (
    <div data-testid="pool-stages-editor">
      <button onClick={() => properties.onStartAddPoolStage?.()}>mock-start-stage</button>
      <button onClick={() => properties.onNewPoolStageNameChange?.('Stage X')}>mock-name-stage</button>
      <button onClick={() => properties.onNewPoolStageRankingDestinationChange?.(4, { destinationType: 'ELIMINATED' })}>mock-destination-4</button>
      <button onClick={() => properties.onNewPoolStagePlayersPerPoolChange?.(2)}>mock-players-per-pool-2</button>
      <button onClick={() => properties.onRemovePoolStage?.(properties.poolStages?.[0]?.id ?? '')}>mock-remove-stage</button>
      <button onClick={() => { properties.onAddPoolStage?.(); }}>mock-add-stage</button>
    </div>
  ),
}));
vi.mock('../../../src/components/tournament-list/brackets-editor', () => ({
  default: (properties: {
    brackets?: Array<{ id: string; name: string; totalRounds: number; status: string; bracketType: string; targetIds: string[]; tournamentId: string }>;
    onStartAddBracket?: () => void;
    onNewBracketNameChange?: (value: string) => void;
    onRemoveBracket?: (id: string) => void;
    onAddBracket?: () => void;
  }) => (
    <div data-testid="brackets-editor">
      <button onClick={() => properties.onStartAddBracket?.()}>mock-start-bracket</button>
      <button onClick={() => properties.onNewBracketNameChange?.('Bracket X')}>mock-name-bracket</button>
      <button onClick={() => properties.onRemoveBracket?.(properties.brackets?.[0]?.id ?? '')}>mock-bracket-mutate</button>
      <button onClick={() => properties.onAddBracket?.()}>mock-add-bracket</button>
    </div>
  ),
}));
vi.mock('../../../src/utils/tournament-presets', () => ({
  getDefaultPresetTemplateConfig: () => mockGetDefaultPresetTemplateConfig(),
}));

describe('TournamentPresetsView editor core', () => {
  beforeEach(() => {
    globalThis.history.pushState({}, '', '/');
    fetchTournamentPresets.mockReset();
    createTournamentPreset.mockReset();
    updateTournamentPreset.mockReset();
    deleteTournamentPreset.mockReset();
    mockGetAccessTokenSilently.mockReset();
    mockGetAccessTokenSilently.mockResolvedValue(undefined);
    mockGetDefaultPresetTemplateConfig.mockReset();
    mockGetDefaultPresetTemplateConfig.mockReturnValue({
      format: 'SINGLE',
      stages: [{ name: 'Stage 1', poolCount: 2, playersPerPool: 4, advanceCount: 2 }],
      brackets: [{ name: 'Bracket 1', totalRounds: 3 }],
      routingRules: [],
    });
    authState.enabled = false;
    authState.isAuthenticated = false;
    fetchTournamentPresets.mockResolvedValue([]);
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows participants validation error when participants is below minimum', async () => {
    render(<TournamentPresetsView mode="editor" />);
    await screen.findByTestId('pool-stages-editor');

    fireEvent.change(screen.getByLabelText('presetManager.name'), { target: { value: 'Preset' } });
    fireEvent.change(screen.getByLabelText('presetManager.participants'), { target: { value: '3' } });
    fireEvent.click(screen.getByText('common.save'));

    expect(await screen.findByText('presetManager.errors.participantsMin')).toBeInTheDocument();
    expect(createTournamentPreset).not.toHaveBeenCalled();
  });

  it('shows targets validation error when target count is below minimum', async () => {
    render(<TournamentPresetsView mode="editor" />);
    await screen.findByTestId('pool-stages-editor');

    fireEvent.change(screen.getByLabelText('presetManager.name'), { target: { value: 'Preset' } });
    fireEvent.change(screen.getByLabelText('presetManager.targets'), { target: { value: '0' } });
    fireEvent.click(screen.getByText('common.save'));

    expect(await screen.findByText('presetManager.errors.targetsMin')).toBeInTheDocument();
    expect(createTournamentPreset).not.toHaveBeenCalled();
  });

  it('shows fallback save error when create fails with non-error value', async () => {
    createTournamentPreset.mockRejectedValueOnce('failed');

    render(<TournamentPresetsView mode="editor" />);
    await screen.findByTestId('pool-stages-editor');

    fireEvent.change(screen.getByLabelText('presetManager.name'), { target: { value: 'Preset Save Error' } });
    fireEvent.click(screen.getByText('common.save'));

    expect(await screen.findByText('presetManager.errors.saveFailed')).toBeInTheDocument();
  });
});

describe('TournamentPresetsView editor core interactions', () => {
  beforeEach(() => {
    globalThis.history.pushState({}, '', '/');
    fetchTournamentPresets.mockReset();
    createTournamentPreset.mockReset();
    updateTournamentPreset.mockReset();
    deleteTournamentPreset.mockReset();
    mockGetAccessTokenSilently.mockReset();
    mockGetAccessTokenSilently.mockResolvedValue(undefined);
    mockGetDefaultPresetTemplateConfig.mockReset();
    mockGetDefaultPresetTemplateConfig.mockReturnValue({
      format: 'SINGLE',
      stages: [{ name: 'Stage 1', poolCount: 2, playersPerPool: 4, advanceCount: 2 }],
      brackets: [{ name: 'Bracket 1', totalRounds: 3 }],
      routingRules: [],
    });
    authState.enabled = false;
    authState.isAuthenticated = false;
    fetchTournamentPresets.mockResolvedValue([]);
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects back to edit-tournament after creating from edit context', async () => {
    const locationAssign = vi.fn();
    globalThis.history.pushState({}, '', '/?from=edit-tournament&tournamentId=t-77');
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: { ...globalThis.window.location, assign: locationAssign },
    });

    render(<TournamentPresetsView mode="editor" />);
    await screen.findByTestId('pool-stages-editor');

    fireEvent.change(screen.getByLabelText('presetManager.name'), { target: { value: 'Preset Redirect' } });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => expect(createTournamentPreset).toHaveBeenCalledTimes(1));
    expect(locationAssign).toHaveBeenCalled();
  });

  it('adds stage and bracket through editor callbacks before save', async () => {
    render(<TournamentPresetsView mode="editor" />);
    await screen.findByTestId('pool-stages-editor');
    await screen.findByTestId('brackets-editor');

    fireEvent.click(screen.getByText('mock-start-stage'));
    fireEvent.click(screen.getByText('mock-name-stage'));
    fireEvent.click(screen.getByText('mock-add-stage'));
    fireEvent.click(screen.getByText('mock-start-bracket'));
    fireEvent.click(screen.getByText('mock-name-bracket'));
    fireEvent.click(screen.getByText('mock-add-bracket'));

    fireEvent.change(screen.getByLabelText('presetManager.name'), { target: { value: 'Preset Extended' } });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => expect(createTournamentPreset).toHaveBeenCalledTimes(1));
  });

  it('resizes new stage destinations when players per pool changes', async () => {
    render(<TournamentPresetsView mode="editor" />);
    await screen.findByTestId('pool-stages-editor');

    fireEvent.click(screen.getByText('mock-start-stage'));
    fireEvent.click(screen.getByText('mock-name-stage'));
    fireEvent.click(screen.getByText('mock-destination-4'));
    fireEvent.click(screen.getByText('mock-players-per-pool-2'));
    fireEvent.click(screen.getByText('mock-add-stage'));

    fireEvent.change(screen.getByLabelText('presetManager.name'), { target: { value: 'Preset Destinations Resize' } });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => expect(createTournamentPreset).toHaveBeenCalledTimes(1));
  });

  it('shows fallback load error when presets fetch rejects with non-error value', async () => {
    fetchTournamentPresets.mockRejectedValueOnce('failed');
    render(<TournamentPresetsView mode="editor" />);
    expect(await screen.findByText('presetManager.errors.loadFailed')).toBeInTheDocument();
  });

  it('resets edited form values when cancelling in editor mode', async () => {
    render(<TournamentPresetsView mode="editor" />);
    await screen.findByLabelText('presetManager.name');

    fireEvent.change(screen.getByLabelText('presetManager.name'), { target: { value: 'Temporary Preset' } });
    fireEvent.click(screen.getByText('common.cancel'));

    expect(screen.getByLabelText('presetManager.name')).toHaveValue('');
  });
});
