import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TournamentPresetsView from '../../../src/components/tournament-presets-view';

const fetchTournamentPresets = vi.fn();
const createTournamentPreset = vi.fn();
const updateTournamentPreset = vi.fn();
const deleteTournamentPreset = vi.fn();
const mockTranslate = (key: string) => key;
const mockGetAccessTokenSilently = vi.fn(async () => undefined);
const mockGetDefaultPresetTemplateConfig = vi.fn(() => ({
  format: 'SINGLE',
  stages: [{ name: 'Stage 1', poolCount: 2, playersPerPool: 4, advanceCount: 2 }],
  brackets: [{ name: 'Bracket 1', totalRounds: 3 }],
  routingRules: [],
}));
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
      <button onClick={() => {
        const firstId = properties.poolStages?.[0]?.id;
        if (firstId) {
          properties.onPoolStageMatchFormatChange?.(firstId, undefined);
        }
      }}>
        mock-stage-format-undefined
      </button>
      <button onClick={() => properties.onNewPoolStageNameChange?.('Stage X')}>mock-name-stage</button>
      <button onClick={() => properties.onNewPoolStageRankingDestinationChange?.(4, { destinationType: 'ELIMINATED' })}>mock-destination-4</button>
      <button onClick={() => properties.onNewPoolStagePlayersPerPoolChange?.(2)}>mock-players-per-pool-2</button>
      <button onClick={() => properties.onNewPoolStageMatchFormatChange?.(undefined)}>mock-new-stage-format-undefined</button>
      <button onClick={() => {
        const firstId = properties.poolStages?.[0]?.id;
        if (firstId) {
          properties.onRemovePoolStage?.(firstId);
        }
      }}>
        mock-remove-stage
      </button>
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
    brackets?: Array<{
      id: string;
      name: string;
      totalRounds: number;
      roundMatchFormats?: Record<string, string>;
      status: string;
      bracketType: string;
      targetIds: string[];
      tournamentId: string;
      hasStartedMatches?: boolean;
    }>;
    onStartAddBracket?: () => void;
    onNewBracketNameChange?: (value: string) => void;
    onNewBracketTypeChange?: (value: string) => void;
    onNewBracketRoundsChange?: (value: number) => void;
    onNewBracketRoundMatchFormatChange?: (roundNumber: number, value: string | undefined) => void;
    onBracketNameChange?: (id: string, value: string) => void;
    onBracketRoundsChange?: (id: string, value: number) => void;
    onBracketStatusChange?: (id: string, value: string) => void;
    onBracketRoundMatchFormatChange?: (id: string, roundNumber: number, value: string | undefined) => void;
    onSaveBracket?: (bracket: {
      id: string;
      name: string;
      totalRounds: number;
      roundMatchFormats?: Record<string, string>;
      status: string;
      bracketType: string;
      targetIds: string[];
      tournamentId: string;
      hasStartedMatches?: boolean;
    }) => void;
    onRemoveBracket?: (id: string) => void;
    onCancelAddBracket?: () => void;
    onAddBracket?: () => void;
  }) => (
    <div data-testid="brackets-editor">
      <button onClick={() => properties.onStartAddBracket?.()}>mock-start-bracket</button>
      <button onClick={() => properties.onNewBracketNameChange?.('Bracket X')}>mock-name-bracket</button>
      <button onClick={() => properties.onNewBracketTypeChange?.('SINGLE_ELIMINATION')}>mock-new-bracket-type</button>
      <button onClick={() => properties.onNewBracketRoundsChange?.(4)}>mock-new-bracket-rounds</button>
      <button onClick={() => properties.onNewBracketRoundMatchFormatChange?.(2, undefined)}>mock-new-bracket-round-format-clear</button>
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
      <button onClick={() => {
        const firstBracket = properties.brackets?.[0];
        if (firstBracket) {
          properties.onSaveBracket?.({ ...firstBracket, name: `${firstBracket.name}-saved` });
        }
      }}>
        mock-save-bracket
      </button>
      <button onClick={() => properties.onCancelAddBracket?.()}>mock-cancel-bracket</button>
      <button onClick={() => properties.onAddBracket?.()}>mock-add-bracket</button>
    </div>
  ),
}));

vi.mock('../../../src/utils/tournament-presets', () => ({
  getDefaultPresetTemplateConfig: (...args: unknown[]) => mockGetDefaultPresetTemplateConfig(...args),
}));

describe('TournamentPresetsView', () => {
  const setup = () => {
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
  };

  beforeEach(setup);

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

});

describe('TournamentPresetsView list and editor actions', () => {
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
});
