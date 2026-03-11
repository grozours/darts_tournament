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
    onPoolStageMatchFormatChange?: (id: string, value: string | undefined) => void;
    onNewPoolStageMatchFormatChange?: (value: string | undefined) => void;
    onRemovePoolStage?: (id: string) => void;
  }) => (
    <div data-testid="pool-stages-editor">
      <button onClick={() => {
        const firstId = properties.poolStages?.[0]?.id;
        if (firstId) {
          properties.onPoolStageMatchFormatChange?.(firstId, undefined);
        }
      }}>
        mock-stage-format-undefined
      </button>
      <button onClick={() => properties.onNewPoolStageMatchFormatChange?.(undefined)}>mock-new-stage-format-undefined</button>
      <button onClick={() => properties.onRemovePoolStage?.(properties.poolStages?.[0]?.id ?? '')}>mock-remove-stage</button>
    </div>
  ),
}));
vi.mock('../../../src/components/tournament-list/brackets-editor', () => ({
  default: (properties: {
    brackets?: Array<{
      id: string;
      name: string;
      totalRounds: number;
      roundMatchFormats?: Record<string, string>;
      status: string;
      bracketType: string;
      targetIds: string[];
      tournamentId: string;
    }>;
    onNewBracketTypeChange?: (value: string) => void;
    onNewBracketRoundsChange?: (value: number) => void;
    onNewBracketRoundMatchFormatChange?: (roundNumber: number, value: string | undefined) => void;
    onSaveBracket?: (bracket: {
      id: string;
      name: string;
      totalRounds: number;
      roundMatchFormats?: Record<string, string>;
      status: string;
      bracketType: string;
      targetIds: string[];
      tournamentId: string;
    }) => void;
    onBracketNameChange?: (id: string, value: string) => void;
    onBracketRoundsChange?: (id: string, value: number) => void;
    onBracketStatusChange?: (id: string, value: string) => void;
    onBracketRoundMatchFormatChange?: (id: string, roundNumber: number, value: string | undefined) => void;
    onRemoveBracket?: (id: string) => void;
    onAddBracket?: () => void;
    onCancelAddBracket?: () => void;
  }) => (
    <div data-testid="brackets-editor">
      <button onClick={() => properties.onNewBracketTypeChange?.('SINGLE_ELIMINATION')}>mock-new-bracket-type</button>
      <button onClick={() => properties.onNewBracketRoundsChange?.(4)}>mock-new-bracket-rounds</button>
      <button onClick={() => properties.onNewBracketRoundMatchFormatChange?.(2, undefined)}>mock-new-bracket-round-format-clear</button>
      <button onClick={() => {
        const firstBracket = properties.brackets?.[0];
        if (firstBracket) {
          properties.onSaveBracket?.({ ...firstBracket, name: `${firstBracket.name}-saved` });
        }
      }}>
        mock-save-bracket
      </button>
      <button onClick={() => {
        const firstId = properties.brackets?.[0]?.id;
        if (firstId) {
          properties.onBracketNameChange?.(firstId, 'Bracket renamed');
          properties.onBracketRoundsChange?.(firstId, 5);
          properties.onBracketStatusChange?.(firstId, 'NOT_STARTED');
          properties.onBracketRoundMatchFormatChange?.(firstId, 2, undefined);
          properties.onBracketRoundMatchFormatChange?.(firstId, 2, 'BO7');
          properties.onRemoveBracket?.(firstId);
        }
      }}>
        mock-bracket-mutate
      </button>
      <button onClick={() => properties.onAddBracket?.()}>mock-add-bracket</button>
      <button onClick={() => properties.onCancelAddBracket?.()}>mock-cancel-bracket</button>
    </div>
  ),
}));
vi.mock('../../../src/utils/tournament-presets', () => ({
  getDefaultPresetTemplateConfig: () => mockGetDefaultPresetTemplateConfig(),
}));

describe('TournamentPresetsView editor advanced', () => {
  beforeEach(() => {
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

  it('does not request access token when auth is disabled', async () => {
    render(<TournamentPresetsView mode="list" />);
    await screen.findByText('presetManager.empty');
    expect(mockGetAccessTokenSilently).not.toHaveBeenCalled();
  });

  it('uses access token when auth is enabled', async () => {
    authState.enabled = true;
    authState.isAuthenticated = true;
    mockGetAccessTokenSilently.mockResolvedValue('token-123');

    render(<TournamentPresetsView mode="editor" />);
    await screen.findByLabelText('presetManager.name');

    fireEvent.change(screen.getByLabelText('presetManager.name'), { target: { value: 'Preset Auth Token' } });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => expect(createTournamentPreset).toHaveBeenCalledTimes(1));
    expect(createTournamentPreset).toHaveBeenCalledWith(expect.objectContaining({ name: 'Preset Auth Token' }), 'token-123');
  });

  it('falls back to undefined token when token retrieval fails in auth mode', async () => {
    authState.enabled = true;
    authState.isAuthenticated = true;
    mockGetAccessTokenSilently.mockRejectedValueOnce(new Error('token failed'));

    render(<TournamentPresetsView mode="editor" />);
    await screen.findByLabelText('presetManager.name');

    fireEvent.change(screen.getByLabelText('presetManager.name'), { target: { value: 'Preset Token Fallback' } });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => expect(createTournamentPreset).toHaveBeenCalledTimes(1));
    expect(createTournamentPreset).toHaveBeenCalledWith(expect.objectContaining({ name: 'Preset Token Fallback' }), undefined);
  });

  it('toggles stage parallel reference on and off', async () => {
    render(<TournamentPresetsView mode="editor" />);
    const button = await screen.findByRole('button', { name: 'Bracket · Bracket 1' });

    fireEvent.click(button);
    expect(button.className).toContain('border-cyan-400/80');

    fireEvent.click(button);
    expect(button.className).not.toContain('border-cyan-400/80');
  });

  it('toggles bracket parallel reference on and off', async () => {
    render(<TournamentPresetsView mode="editor" />);
    const buttons = await screen.findAllByRole('button', { name: 'Stage 1 · Stage 1' });
    expect(buttons.length).toBeGreaterThan(0);
    const button = buttons[0]!;

    fireEvent.click(button);
    expect(button.className).toContain('border-amber-400/80');

    fireEvent.click(button);
    expect(button.className).not.toContain('border-amber-400/80');
  });

  it('shows validation error when all stages are removed', async () => {
    render(<TournamentPresetsView mode="editor" />);
    await screen.findByLabelText('presetManager.name');

    fireEvent.click(screen.getByText('mock-remove-stage'));
    fireEvent.change(screen.getByLabelText('presetManager.name'), { target: { value: 'Preset without stage' } });
    fireEvent.click(screen.getByText('common.save'));
    expect(await screen.findByText('presetManager.errors.stagesRequired')).toBeInTheDocument();
  });

  it('shows validation error when all brackets are removed', async () => {
    render(<TournamentPresetsView mode="editor" />);
    await screen.findByLabelText('presetManager.name');

    fireEvent.click(screen.getByText('mock-bracket-mutate'));
    fireEvent.change(screen.getByLabelText('presetManager.name'), { target: { value: 'Preset without bracket' } });
    fireEvent.click(screen.getByText('common.save'));
    expect(await screen.findByText('presetManager.errors.bracketsRequired')).toBeInTheDocument();
  });

  it('exercises extra editor callback branches before save', async () => {
    render(<TournamentPresetsView mode="editor" />);
    await screen.findByLabelText('presetManager.name');

    fireEvent.click(screen.getByText('mock-stage-format-undefined'));
    fireEvent.click(screen.getByText('mock-new-stage-format-undefined'));
    fireEvent.click(screen.getByText('mock-new-bracket-type'));
    fireEvent.click(screen.getByText('mock-new-bracket-rounds'));
    fireEvent.click(screen.getByText('mock-new-bracket-round-format-clear'));
    fireEvent.click(screen.getByText('mock-save-bracket'));
    fireEvent.click(screen.getByText('mock-bracket-mutate'));
    fireEvent.click(screen.getByText('mock-add-bracket'));
    fireEvent.click(screen.getByText('mock-cancel-bracket'));

    fireEvent.change(screen.getByLabelText('presetManager.name'), { target: { value: 'Preset Branches' } });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => expect(createTournamentPreset).toHaveBeenCalledTimes(1));
  });
});
