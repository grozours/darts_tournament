import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TournamentPresetsView from '../../../src/components/tournament-presets-view';

const fetchTournamentPresets = vi.fn();
const createTournamentPreset = vi.fn();
const updateTournamentPreset = vi.fn();
const deleteTournamentPreset = vi.fn();
const mockTranslate = (key: string) => key;
const mockGetAccessTokenSilently = vi.fn(async () => undefined);

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ t: mockTranslate }),
}));

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => ({
    enabled: false,
    isAuthenticated: false,
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
  default: () => <div data-testid="pool-stages-editor" />, 
}));

vi.mock('../../../src/components/tournament-list/brackets-editor', () => ({
  default: () => <div data-testid="brackets-editor" />,
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
    mockGetAccessTokenSilently.mockClear();
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

  it('shows validation error when saving without a name', async () => {
    render(<TournamentPresetsView mode="editor" />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-stages-editor')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('common.save'));

    expect(await screen.findByText('presetManager.errors.nameRequired')).toBeInTheDocument();
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
});
