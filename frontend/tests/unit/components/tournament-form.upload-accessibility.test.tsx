import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TournamentForm from '../../../src/components/tournaments/tournament-form';

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

describe('TournamentForm file uploads', () => {
  it('should preview uploaded logo', async () => {
    const user = userEvent.setup();
    render(<TournamentForm {...defaultProps} />);

    const logoInput = screen.getByLabelText(/tournament logo/i);
    const file = new File(['test'], 'logo.png', { type: 'image/png' });

    await user.upload(logoInput, file);

    await waitFor(() => {
      const preview = screen.getByRole('img', { name: /logo preview/i });
      expect(preview).toBeInTheDocument();
      expect(preview).toHaveAttribute('alt', 'Logo preview');
    });
  });

  it('should validate file type', async () => {
    const user = userEvent.setup();
    render(<TournamentForm {...defaultProps} />);

    const logoInput = screen.getByLabelText(/tournament logo/i);
    const invalidFile = new File(['test'], 'document.pdf', { type: 'application/pdf' });

    await user.upload(logoInput, invalidFile);

    await waitFor(() => {
      expect(screen.getByText(/only jpeg and png files are allowed/i)).toBeInTheDocument();
    });
  });

  it('should validate file size', async () => {
    const user = userEvent.setup();
    render(<TournamentForm {...defaultProps} />);

    const logoInput = screen.getByLabelText(/tournament logo/i);

    const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large-logo.png', {
      type: 'image/png',
    });

    await user.upload(logoInput, largeFile);

    await waitFor(() => {
      expect(screen.getByText(/file size cannot exceed 5mb/i)).toBeInTheDocument();
    });
  });
});

describe('TournamentForm accessibility', () => {
  it('should have proper ARIA labels and roles', () => {
    render(<TournamentForm {...defaultProps} />);

    expect(screen.getByRole('form', { name: /create tournament/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/tournament name/i)).toHaveAttribute('required');
    expect(screen.getByLabelText(/format/i)).toHaveAttribute('required');
  });

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<TournamentForm {...defaultProps} />);

    const nameInput = screen.getByLabelText(/tournament name/i);
    nameInput.focus();

    await user.tab();
    expect(screen.getByLabelText(/format/i)).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText(/duration type/i)).toHaveFocus();
  });
});

describe('TournamentForm cancel', () => {
  it('should call onCancel when cancel button clicked', async () => {
    const user = userEvent.setup();
    const mockOnCancel = vi.fn();

    render(<TournamentForm {...defaultProps} onCancel={mockOnCancel} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockOnCancel).toHaveBeenCalled();
  });
});
