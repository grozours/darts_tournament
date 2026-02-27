import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TournamentPresetsView from '../../../src/components/tournament-presets-view';

const fetchTournamentPresets = vi.fn();
const createTournamentPreset = vi.fn();
const updateTournamentPreset = vi.fn();
const deleteTournamentPreset = vi.fn();
const mockTranslate = (key: string) => key;
const mockGetAccessTokenSilently = vi.fn(async () => undefined);
const authState = {
  enabled: false,
  isAuthenticated: false,
};

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ t: mockTranslate }),
}));

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
    onStartAddPoolStage?: () => void;
    onNewPoolStageNameChange?: (value: string) => void;
    onNewPoolStagePlayersPerPoolChange?: (value: number) => void;
    onNewPoolStageRankingDestinationChange?: (position: number, destination: { destinationType: 'ELIMINATED' }) => void;
    onAddPoolStage?: () => Promise<boolean>;
  }) => (
    <div data-testid="pool-stages-editor">
      <button onClick={() => properties.onStartAddPoolStage?.()}>mock-start-stage</button>
      <button onClick={() => properties.onNewPoolStageNameChange?.('Stage X')}>mock-name-stage</button>
      <button onClick={() => properties.onNewPoolStageRankingDestinationChange?.(4, { destinationType: 'ELIMINATED' })}>mock-destination-4</button>
      <button onClick={() => properties.onNewPoolStagePlayersPerPoolChange?.(2)}>mock-players-per-pool-2</button>
      <button onClick={() => {
        properties.onAddPoolStage?.();
      }}>
        mock-add-stage
      </button>
    </div>
  ),
}));

vi.mock('../../../src/components/tournament-list/brackets-editor', () => ({
  default: (properties: {
    onStartAddBracket?: () => void;
    onNewBracketNameChange?: (value: string) => void;
    onAddBracket?: () => void;
  }) => (
    <div data-testid="brackets-editor">
      <button onClick={() => properties.onStartAddBracket?.()}>mock-start-bracket</button>
      <button onClick={() => properties.onNewBracketNameChange?.('Bracket X')}>mock-name-bracket</button>
      <button onClick={() => properties.onAddBracket?.()}>mock-add-bracket</button>
    </div>
  ),
}));

vi.mock('../../../src/utils/tournament-presets', () => ({
  getDefaultPresetTemplateConfig: () => ({
    format: 'SINGLE',
    stages: [{ name: 'Stage 1', poolCount: 2, playersPerPool: 4, advanceCount: 2 }],
    brackets: [{ name: 'Bracket 1', totalRounds: 3 }],
    routingRules: [],
  }),
}));

describe('TournamentPresetsView', () => {
  const existingPreset = {
    id: 'preset-1',
    name: 'Preset One',
    presetType: 'custom' as const,
    totalParticipants: 16,
    targetCount: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    templateConfig: {
      format: 'SINGLE' as const,
      stages: [
        { name: 'Stage 1', poolCount: 2, playersPerPool: 4, advanceCount: 2 },
      ],
      brackets: [{ name: 'Bracket 1', totalRounds: 3 }],
      routingRules: [],
    },
  };

  beforeEach(() => {
    if (!('scrollIntoView' in HTMLElement.prototype)) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
    }
    globalThis.history.pushState({}, '', '/');
    fetchTournamentPresets.mockReset();
    createTournamentPreset.mockReset();
    updateTournamentPreset.mockReset();
    deleteTournamentPreset.mockReset();
    mockGetAccessTokenSilently.mockReset();
    mockGetAccessTokenSilently.mockResolvedValue(undefined);
    authState.enabled = false;
    authState.isAuthenticated = false;
    fetchTournamentPresets.mockResolvedValue([]);
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty presets list when no preset is available', async () => {
    render(<TournamentPresetsView mode="list" />);

    expect(await screen.findByText('presetManager.empty')).toBeInTheDocument();
  });

  it('renders loading state while presets are being fetched', async () => {
    fetchTournamentPresets.mockImplementation(() => new Promise(() => {}));

    render(<TournamentPresetsView mode="list" />);

    expect(await screen.findByText('presetManager.loading')).toBeInTheDocument();
  });

  it('shows validation error when saving without a name', async () => {
    render(<TournamentPresetsView mode="editor" />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-stages-editor')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('common.save'));

    expect(await screen.findByText('presetManager.errors.nameRequired')).toBeInTheDocument();
  });

  it('includes team format in preset editor format options', async () => {
    render(<TournamentPresetsView mode="editor" />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-stages-editor')).toBeInTheDocument();
    });

    expect(screen.getByRole('option', { name: 'presetManager.formatTeam' })).toBeInTheDocument();
  });

  it('shows load error when presets fetch fails', async () => {
    fetchTournamentPresets.mockRejectedValue(new Error('load failed'));

    render(<TournamentPresetsView mode="editor" />);

    expect(await screen.findByText('load failed')).toBeInTheDocument();
  });

  it('does not delete preset when confirmation is cancelled', async () => {
    fetchTournamentPresets.mockResolvedValue([existingPreset]);
    vi.spyOn(globalThis, 'confirm').mockReturnValueOnce(false);

    render(<TournamentPresetsView mode="list" />);

    await screen.findByText('Preset One');
    fireEvent.click(screen.getByText('common.delete'));

    expect(deleteTournamentPreset).not.toHaveBeenCalled();
  });

  it('creates preset when editor form is valid', async () => {
    render(<TournamentPresetsView mode="editor" />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-stages-editor')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('presetManager.name'), {
      target: { value: '  New preset  ' },
    });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => {
      expect(createTournamentPreset).toHaveBeenCalledTimes(1);
    });

    expect(createTournamentPreset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New preset',
        totalParticipants: 16,
        targetCount: 4,
      }),
      undefined
    );
  });

  it('updates preset when editing an existing preset in editor mode', async () => {
    globalThis.history.pushState({}, '', '/?presetId=preset-1');
    fetchTournamentPresets.mockResolvedValue([existingPreset]);

    render(<TournamentPresetsView mode="editor" />);

    await screen.findByDisplayValue('Preset One');
    fireEvent.change(screen.getByLabelText('presetManager.name'), {
      target: { value: 'Preset One Updated' },
    });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => {
      expect(updateTournamentPreset).toHaveBeenCalledTimes(1);
    });
    expect(updateTournamentPreset).toHaveBeenCalledWith(
      'preset-1',
      expect.objectContaining({ name: 'Preset One Updated' }),
      undefined
    );
  });

  it('deletes preset when confirmation is accepted', async () => {
    fetchTournamentPresets.mockResolvedValue([existingPreset]);
    vi.spyOn(globalThis, 'confirm').mockReturnValueOnce(true);

    render(<TournamentPresetsView mode="list" />);

    await screen.findByText('Preset One');
    fireEvent.click(screen.getByText('common.delete'));

    await waitFor(() => {
      expect(deleteTournamentPreset).toHaveBeenCalledWith('preset-1', undefined);
    });
  });

  it('shows participants validation error when participants is below minimum', async () => {
    render(<TournamentPresetsView mode="editor" />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-stages-editor')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('presetManager.name'), {
      target: { value: 'Preset' },
    });
    fireEvent.change(screen.getByLabelText('presetManager.participants'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByText('common.save'));

    expect(await screen.findByText('presetManager.errors.participantsMin')).toBeInTheDocument();
    expect(createTournamentPreset).not.toHaveBeenCalled();
  });

  it('shows targets validation error when target count is below minimum', async () => {
    render(<TournamentPresetsView mode="editor" />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-stages-editor')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('presetManager.name'), {
      target: { value: 'Preset' },
    });
    fireEvent.change(screen.getByLabelText('presetManager.targets'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByText('common.save'));

    expect(await screen.findByText('presetManager.errors.targetsMin')).toBeInTheDocument();
    expect(createTournamentPreset).not.toHaveBeenCalled();
  });

  it('shows fallback save error when create fails with non-error value', async () => {
    createTournamentPreset.mockRejectedValueOnce('failed');

    render(<TournamentPresetsView mode="editor" />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-stages-editor')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('presetManager.name'), {
      target: { value: 'Preset Save Error' },
    });
    fireEvent.click(screen.getByText('common.save'));

    expect(await screen.findByText('presetManager.errors.saveFailed')).toBeInTheDocument();
  });

  it('keeps list visible when deletion fails', async () => {
    fetchTournamentPresets.mockResolvedValue([existingPreset]);
    deleteTournamentPreset.mockRejectedValueOnce('failed');
    vi.spyOn(globalThis, 'confirm').mockReturnValueOnce(true);

    render(<TournamentPresetsView mode="list" />);

    await screen.findByText('Preset One');
    fireEvent.click(screen.getByText('common.delete'));

    await waitFor(() => {
      expect(deleteTournamentPreset).toHaveBeenCalledWith('preset-1', undefined);
    });
    expect(screen.getByText('Preset One')).toBeInTheDocument();
  });

  it('redirects back to edit-tournament after creating from edit context', async () => {
    const locationAssign = vi.fn();
    globalThis.history.pushState({}, '', '/?from=edit-tournament&tournamentId=t-77');
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: { ...globalThis.window.location, assign: locationAssign },
    });

    render(<TournamentPresetsView mode="editor" />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-stages-editor')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('presetManager.name'), {
      target: { value: 'Preset Redirect' },
    });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => {
      expect(createTournamentPreset).toHaveBeenCalledTimes(1);
    });

    expect(locationAssign).toHaveBeenCalled();
  });

  it('navigates to editor when clicking edit from list mode', async () => {
    const locationAssign = vi.fn();
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: { ...globalThis.window.location, assign: locationAssign },
    });
    fetchTournamentPresets.mockResolvedValue([existingPreset]);

    render(<TournamentPresetsView mode="list" />);

    await screen.findByText('Preset One');
    fireEvent.click(screen.getByText('common.edit'));

    expect(locationAssign).toHaveBeenCalled();
  });

  it('adds stage and bracket through editor callbacks before save', async () => {
    render(<TournamentPresetsView mode="editor" />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-stages-editor')).toBeInTheDocument();
      expect(screen.getByTestId('brackets-editor')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('mock-start-stage'));
    fireEvent.click(screen.getByText('mock-name-stage'));
    fireEvent.click(screen.getByText('mock-add-stage'));

    fireEvent.click(screen.getByText('mock-start-bracket'));
    fireEvent.click(screen.getByText('mock-name-bracket'));
    fireEvent.click(screen.getByText('mock-add-bracket'));

    fireEvent.change(screen.getByLabelText('presetManager.name'), {
      target: { value: 'Preset Extended' },
    });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => {
      expect(createTournamentPreset).toHaveBeenCalledTimes(1);
    });

    const payload = createTournamentPreset.mock.calls[0]?.[0];
    expect(payload?.templateConfig?.stages?.length).toBeGreaterThanOrEqual(2);
    expect(payload?.templateConfig?.brackets?.length).toBeGreaterThanOrEqual(2);
  });

  it('resizes new stage destinations when players per pool changes', async () => {
    render(<TournamentPresetsView mode="editor" />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-stages-editor')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('mock-start-stage'));
    fireEvent.click(screen.getByText('mock-name-stage'));
    fireEvent.click(screen.getByText('mock-destination-4'));
    fireEvent.click(screen.getByText('mock-players-per-pool-2'));
    fireEvent.click(screen.getByText('mock-add-stage'));

    fireEvent.change(screen.getByLabelText('presetManager.name'), {
      target: { value: 'Preset Destinations Resize' },
    });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => {
      expect(createTournamentPreset).toHaveBeenCalledTimes(1);
    });

    const payload = createTournamentPreset.mock.calls[0]?.[0];
    const stageTwoRules = (payload?.templateConfig?.routingRules ?? [])
      .filter((rule: { stageNumber: number; position: number }) => rule.stageNumber === 2);
    expect(stageTwoRules).toHaveLength(2);
    expect(stageTwoRules.map((rule: { position: number }) => rule.position)).toEqual([1, 2]);
  });

  it('shows fallback load error when presets fetch rejects with non-error value', async () => {
    fetchTournamentPresets.mockRejectedValueOnce('failed');

    render(<TournamentPresetsView mode="editor" />);

    expect(await screen.findByText('presetManager.errors.loadFailed')).toBeInTheDocument();
  });

  it('resets edited form values when cancelling in editor mode', async () => {
    render(<TournamentPresetsView mode="editor" />);

    await waitFor(() => {
      expect(screen.getByLabelText('presetManager.name')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('presetManager.name'), {
      target: { value: 'Temporary Preset' },
    });
    fireEvent.click(screen.getByText('common.cancel'));

    expect(screen.getByLabelText('presetManager.name')).toHaveValue('');
  });

  it('renders preset metadata cards in list mode', async () => {
    fetchTournamentPresets.mockResolvedValue([existingPreset]);

    render(<TournamentPresetsView mode="list" />);

    await screen.findByText('Preset One');
    expect(screen.getByText('presetManager.participants')).toBeInTheDocument();
    expect(screen.getByText('presetManager.targets')).toBeInTheDocument();
    expect(screen.getByText('presetManager.stageCount')).toBeInTheDocument();
    expect(screen.getByText('presetManager.bracketCount')).toBeInTheDocument();
  });

  it('keeps list available when deletion fails with non-error value', async () => {
    fetchTournamentPresets.mockResolvedValue([existingPreset]);
    deleteTournamentPreset.mockRejectedValueOnce('failed');
    vi.spyOn(globalThis, 'confirm').mockReturnValueOnce(true);

    render(<TournamentPresetsView mode="list" />);

    await screen.findByText('Preset One');
    fireEvent.click(screen.getByText('common.delete'));

    await waitFor(() => {
      expect(deleteTournamentPreset).toHaveBeenCalledWith('preset-1', undefined);
    });
    expect(screen.getByText('Preset One')).toBeInTheDocument();
  });

  it('redirects to edit page after create when tournamentId is present in query', async () => {
    const locationAssign = vi.fn();
    globalThis.history.pushState({}, '', '/?from=dashboard&tournamentId=t-77');
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: { ...globalThis.window.location, assign: locationAssign },
    });

    render(<TournamentPresetsView mode="editor" />);

    await waitFor(() => {
      expect(screen.getByLabelText('presetManager.name')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('presetManager.name'), {
      target: { value: 'No Redirect Preset' },
    });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => {
      expect(createTournamentPreset).toHaveBeenCalledTimes(1);
    });

    expect(locationAssign).toHaveBeenCalledWith('/?tournamentId=t-77&view=edit-tournament');
  });

  it('does not request access token when auth is disabled', async () => {
    fetchTournamentPresets.mockResolvedValue([]);

    render(<TournamentPresetsView mode="list" />);

    await screen.findByText('presetManager.empty');
    expect(mockGetAccessTokenSilently).not.toHaveBeenCalled();
  });

  it('uses access token when auth is enabled', async () => {
    authState.enabled = true;
    authState.isAuthenticated = true;
    mockGetAccessTokenSilently.mockResolvedValue('token-123');

    render(<TournamentPresetsView mode="editor" />);

    await waitFor(() => {
      expect(screen.getByLabelText('presetManager.name')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('presetManager.name'), {
      target: { value: 'Preset Auth Token' },
    });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => {
      expect(createTournamentPreset).toHaveBeenCalledTimes(1);
    });

    expect(createTournamentPreset).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Preset Auth Token' }),
      'token-123'
    );
  });

  it('falls back to undefined token when token retrieval fails in auth mode', async () => {
    authState.enabled = true;
    authState.isAuthenticated = true;
    mockGetAccessTokenSilently.mockRejectedValueOnce(new Error('token failed'));

    render(<TournamentPresetsView mode="editor" />);

    await waitFor(() => {
      expect(screen.getByLabelText('presetManager.name')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('presetManager.name'), {
      target: { value: 'Preset Token Fallback' },
    });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => {
      expect(createTournamentPreset).toHaveBeenCalledTimes(1);
    });

    expect(createTournamentPreset).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Preset Token Fallback' }),
      undefined
    );
  });

  it('toggles stage parallel reference on and off', async () => {
    render(<TournamentPresetsView mode="editor" />);

    const stageParallelButton = await screen.findByRole('button', { name: 'Bracket · Bracket 1' });

    fireEvent.click(stageParallelButton);
    expect(stageParallelButton.className).toContain('border-cyan-400/80');

    fireEvent.click(stageParallelButton);
    expect(stageParallelButton.className).not.toContain('border-cyan-400/80');
  });

  it('toggles bracket parallel reference on and off', async () => {
    render(<TournamentPresetsView mode="editor" />);

    const bracketParallelButtons = await screen.findAllByRole('button', { name: 'Stage 1 · Stage 1' });
    const bracketParallelButton = bracketParallelButtons[0];

    fireEvent.click(bracketParallelButton);
    expect(bracketParallelButton.className).toContain('border-amber-400/80');

    fireEvent.click(bracketParallelButton);
    expect(bracketParallelButton.className).not.toContain('border-amber-400/80');
  });
});
