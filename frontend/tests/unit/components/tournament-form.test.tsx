import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TournamentForm from '../../../src/components/tournaments/tournament-form';

// Mock the API calls
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

beforeEach(() => {
  globalThis.window?.localStorage?.setItem('lang', 'en');
  vi.clearAllMocks();
});

describe('TournamentForm rendering', () => {
  it('should render all required form fields', () => {
    render(<TournamentForm {...defaultProps} />);

    // Basic fields
    expect(screen.getByLabelText(/tournament name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/format/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/duration type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/total slots/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target count/i)).toBeInTheDocument();

    // Logo upload
    expect(screen.getByLabelText(/tournament logo/i)).toBeInTheDocument();

    // Actions
    expect(screen.getByRole('button', { name: /create tournament/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should render format options correctly', async () => {
    render(<TournamentForm {...defaultProps} />);

    const formatSelect = screen.getByLabelText(/format/i);
    expect(formatSelect).toBeInTheDocument();

    // Check if options are rendered (they may be in a select dropdown)
    fireEvent.click(formatSelect);

    // Wait for options to appear and verify they contain expected values
    await waitFor(() => {
      // These might be options or data attributes depending on implementation
      expect(document.body).toHaveTextContent(/single/i);
      expect(document.body).toHaveTextContent(/double/i);
      expect(document.body).toHaveTextContent(/team/i);
    });
  });

  it('should render duration type options correctly', async () => {
    render(<TournamentForm {...defaultProps} />);

    const durationSelect = screen.getByLabelText(/duration type/i);
    fireEvent.click(durationSelect);

    await waitFor(() => {
      expect(document.body).toHaveTextContent(/full day/i);
      expect(document.body).toHaveTextContent(/half day/i);
      expect(document.body).toHaveTextContent(/evening/i);
    });
  });
});

describe('TournamentForm validation fields', () => {
  it('should show validation errors for empty required fields', async () => {
    const user = userEvent.setup();
    render(<TournamentForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /create tournament/i });
    await user.click(submitButton);

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/tournament name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/format is required/i)).toBeInTheDocument();
      expect(screen.getByText(/start time is required/i)).toBeInTheDocument();
      expect(screen.getByText(/end time is required/i)).toBeInTheDocument();
    });
  });

  it('should validate tournament name length', async () => {
    const user = userEvent.setup();
    render(<TournamentForm {...defaultProps} />);

    const nameInput = screen.getByLabelText(/tournament name/i);

    // Test minimum length
    await user.type(nameInput, 'AB');
    await user.tab(); // Trigger blur

    await waitFor(() => {
      expect(screen.getByText(/name must be at least 3 characters/i)).toBeInTheDocument();
    });

    // Test maximum length
    await user.clear(nameInput);
    await user.type(nameInput, 'A'.repeat(101));
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/name cannot exceed 100 characters/i)).toBeInTheDocument();
    });
  });

  it('should validate participant count', async () => {
    const user = userEvent.setup();
    render(<TournamentForm {...defaultProps} />);

    const participantsInput = screen.getByLabelText(/total slots/i);

    // Test minimum
    await user.type(participantsInput, '1');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/minimum 2 slots/i)).toBeInTheDocument();
    });

    // Test maximum
    await user.clear(participantsInput);
    await user.type(participantsInput, '513');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/maximum 512 slots/i)).toBeInTheDocument();
    });
  });

  it('should validate target count', async () => {
    const user = userEvent.setup();
    render(<TournamentForm {...defaultProps} />);

    const targetInput = screen.getByLabelText(/target count/i);

    // Test minimum
    await user.type(targetInput, '0');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/minimum 1 target/i)).toBeInTheDocument();
    });

    // Test maximum
    await user.clear(targetInput);
    await user.type(targetInput, '21');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/maximum 20 targets/i)).toBeInTheDocument();
    });
  });

});

describe('TournamentForm validation dates', () => {
  it('should validate date/time relationships', async () => {
    const user = userEvent.setup();
    render(<TournamentForm {...defaultProps} />);

    const startTimeInput = screen.getByLabelText(/start time/i);
    const endTimeInput = screen.getByLabelText(/end time/i);

    // Set end time before start time
    await user.type(startTimeInput, '2026-03-15T14:00');
    await user.type(endTimeInput, '2026-03-15T10:00');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/end time must be after start time/i)).toBeInTheDocument();
    });
  });

  it('should validate past dates', async () => {
    const user = userEvent.setup();
    render(<TournamentForm {...defaultProps} />);

    const startTimeInput = screen.getByLabelText(/start time/i);

    // Set past date
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const pastDateString = pastDate.toISOString().slice(0, 16);

    await user.type(startTimeInput, pastDateString);
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/start time cannot be in the past/i)).toBeInTheDocument();
    });
  });
});