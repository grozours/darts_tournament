import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MatchFormatsView from '../../../src/components/match-formats-view';

const fetchMatchFormatPresets = vi.fn();
const createMatchFormatPreset = vi.fn();
const updateMatchFormatPreset = vi.fn();
const deleteMatchFormatPreset = vi.fn();
const setMatchFormatPresets = vi.fn();

const authState = {
  enabled: false,
  isAuthenticated: false,
  getAccessTokenSilently: vi.fn(async () => undefined),
};

const adminState = { isAdmin: true };

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => authState,
}));

vi.mock('../../../src/auth/use-admin-status', () => ({
  useAdminStatus: () => adminState,
}));

vi.mock('../../../src/services/tournament-service', () => ({
  fetchMatchFormatPresets: (...args: unknown[]) => fetchMatchFormatPresets(...args),
  createMatchFormatPreset: (...args: unknown[]) => createMatchFormatPreset(...args),
  updateMatchFormatPreset: (...args: unknown[]) => updateMatchFormatPreset(...args),
  deleteMatchFormatPreset: (...args: unknown[]) => deleteMatchFormatPreset(...args),
}));

vi.mock('../../../src/utils/match-format-presets', () => ({
  getSegmentGameLabel: () => '501 DO',
  setMatchFormatPresets: (...args: unknown[]) => setMatchFormatPresets(...args),
}));

describe('MatchFormatsView', () => {
  beforeEach(() => {
    fetchMatchFormatPresets.mockReset();
    createMatchFormatPreset.mockReset();
    updateMatchFormatPreset.mockReset();
    deleteMatchFormatPreset.mockReset();
    setMatchFormatPresets.mockReset();
    fetchMatchFormatPresets.mockResolvedValue([]);
    createMatchFormatPreset.mockResolvedValue(undefined);
  });

  it('shows readonly message when user is not admin', async () => {
    adminState.isAdmin = false;

    render(<MatchFormatsView />);

    expect(await screen.findByText('Lecture seule (admin requis pour modifier).')).toBeInTheDocument();
  });

  it('creates a new format for admins', async () => {
    adminState.isAdmin = true;
    fetchMatchFormatPresets.mockResolvedValue([]);

    render(<MatchFormatsView />);

    await screen.findByText('Create new format');

    fireEvent.change(screen.getByLabelText('Key'), { target: { value: 'BO3' } });
    fireEvent.click(screen.getByText('Create format'));

    await waitFor(() => {
      expect(createMatchFormatPreset).toHaveBeenCalledTimes(1);
    });

    expect(setMatchFormatPresets).toHaveBeenCalled();
  });

  it('shows loading then load error fallback', async () => {
    fetchMatchFormatPresets.mockRejectedValueOnce('boom');

    render(<MatchFormatsView />);

    expect(await screen.findByText('Failed to load match formats')).toBeInTheDocument();
  });

  it('edits, saves and deletes an existing format', async () => {
    adminState.isAdmin = true;
    fetchMatchFormatPresets.mockResolvedValue([
      {
        id: 'fmt-1',
        key: 'BO3',
        durationMinutes: 20,
        segments: [{ game: '501_DO', targetCount: 1 }],
        isSystem: false,
      },
    ]);
    updateMatchFormatPreset.mockResolvedValue(undefined);
    deleteMatchFormatPreset.mockResolvedValue(undefined);

    render(<MatchFormatsView />);

    await screen.findByDisplayValue('BO3');
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    fireEvent.change(screen.getByDisplayValue('BO3'), { target: { value: 'BO3_EDIT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateMatchFormatPreset).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(deleteMatchFormatPreset).toHaveBeenCalledTimes(1);
    });
  });

  it('shows validation error when creating with invalid segment format', async () => {
    adminState.isAdmin = true;
    fetchMatchFormatPresets.mockResolvedValue([]);

    render(<MatchFormatsView />);

    await screen.findByText('Create new format');
    fireEvent.change(screen.getByLabelText('Description du segment 1'), { target: { value: 'invalid-segment' } });
    fireEvent.click(screen.getByText('Create format'));

    expect(await screen.findByText(/Segment 1: format invalide/i)).toBeInTheDocument();
  });
});
