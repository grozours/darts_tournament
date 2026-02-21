import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TournamentForm from '../../../src/components/tournaments/tournament-form';
import { TournamentFormat, DurationType } from '../../../../shared/src/types';

const mockCreateTournament = vi.fn();
const mockUploadLogo = vi.fn();

vi.mock('../../../src/services/tournament-service', () => ({
  createTournament: (...arguments_: unknown[]) => mockCreateTournament(...arguments_),
  uploadTournamentLogo: (...arguments_: unknown[]) => mockUploadLogo(...arguments_),
}));

const defaultProps = {
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
  isLoading: false,
};

const validFormData = {
  name: 'Test Tournament',
  format: TournamentFormat.SINGLE,
  durationType: DurationType.FULL_DAY,
  startTime: '2026-03-15T10:00',
  endTime: '2026-03-15T18:00',
  totalParticipants: '16',
  targetCount: '3',
};

const fillForm = async (user: ReturnType<typeof userEvent.setup>, data = validFormData) => {
  await user.type(screen.getByLabelText(/tournament name/i), data.name);
  await user.selectOptions(screen.getByLabelText(/format/i), data.format);
  await user.selectOptions(screen.getByLabelText(/duration type/i), data.durationType);
  await user.type(screen.getByLabelText(/start time/i), data.startTime);
  await user.type(screen.getByLabelText(/end time/i), data.endTime);
  await user.type(screen.getByLabelText(/total participants/i), data.totalParticipants);
  await user.type(screen.getByLabelText(/target count/i), data.targetCount);
};

beforeEach(() => {
  globalThis.window?.localStorage?.setItem('lang', 'en');
  vi.clearAllMocks();
});

describe('TournamentForm submission', () => {
  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn();

    mockCreateTournament.mockResolvedValueOnce({
      id: 'tournament-123',
      ...validFormData,
    });

    render(<TournamentForm {...defaultProps} onSubmit={mockOnSubmit} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /create tournament/i }));

    await waitFor(() => {
      const createCall = mockCreateTournament.mock.calls[0] ?? [];
      expect(createCall[0]).toEqual({
        name: validFormData.name,
        format: validFormData.format,
        durationType: validFormData.durationType,
        startTime: new Date(validFormData.startTime).toISOString(),
        endTime: new Date(validFormData.endTime).toISOString(),
        totalParticipants: 16,
        targetCount: 3,
        doubleStageEnabled: false,
      });
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });

  it('should handle form submission with logo upload', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn();

    mockCreateTournament.mockResolvedValueOnce({
      id: 'tournament-123',
      ...validFormData,
    });
    mockUploadLogo.mockResolvedValueOnce({
      logo_url: '/uploads/logo-123.png',
    });

    render(<TournamentForm {...defaultProps} onSubmit={mockOnSubmit} />);

    await fillForm(user);

    const logoInput = screen.getByLabelText(/tournament logo/i);
    const file = new File(['test'], 'logo.png', { type: 'image/png' });
    await user.upload(logoInput, file);

    await user.click(screen.getByRole('button', { name: /create tournament/i }));

    await waitFor(() => {
      expect(mockCreateTournament).toHaveBeenCalled();
      const uploadCall = mockUploadLogo.mock.calls[0] ?? [];
      expect(uploadCall[0]).toBe('tournament-123');
      expect(uploadCall[1]).toBe(file);
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });
});

describe('TournamentForm submission states', () => {
  it('should show loading state during submission', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    mockCreateTournament.mockImplementation(() =>
      new Promise((resolve) => {
        setTimeout(() => resolve({ id: '123' }), 1000);
      })
    );

    render(<TournamentForm {...defaultProps} />);

    await user.type(screen.getByLabelText(/tournament name/i), 'Test');
    await user.selectOptions(screen.getByLabelText(/format/i), TournamentFormat.SINGLE);
    await user.selectOptions(screen.getByLabelText(/duration type/i), DurationType.FULL_DAY);
    await user.type(screen.getByLabelText(/start time/i), '2026-03-15T10:00');
    await user.type(screen.getByLabelText(/end time/i), '2026-03-15T18:00');
    await user.type(screen.getByLabelText(/total participants/i), '8');
    await user.type(screen.getByLabelText(/target count/i), '2');

    await user.click(screen.getByRole('button', { name: /create tournament/i }));

    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument();

    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it('should handle submission errors', async () => {
    const user = userEvent.setup();

    mockCreateTournament.mockRejectedValueOnce(new Error('Tournament creation failed'));

    render(<TournamentForm {...defaultProps} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /create tournament/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Tournament creation failed|failed to create tournament/i)
      ).toBeInTheDocument();
    });
  });

  it('should reset form after successful submission', async () => {
    const user = userEvent.setup();

    mockCreateTournament.mockResolvedValueOnce({ id: 'tournament-123' });

    render(<TournamentForm {...defaultProps} />);

    const nameInput = screen.getByLabelText(/tournament name/i);
    await user.type(nameInput, 'Test Tournament');

    await user.click(screen.getByRole('button', { name: /create tournament/i }));

    await waitFor(() => {
      expect(nameInput).toHaveValue('');
    });
  });
});
