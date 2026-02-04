import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TournamentForm from '../../../src/components/tournaments/TournamentForm';
import { TournamentFormat, DurationType } from '@shared/types';

// Mock the API calls
const mockCreateTournament = vi.fn();
const mockUploadLogo = vi.fn();

vi.mock('../../../src/services/tournamentService', () => ({
  createTournament: (...args: any[]) => mockCreateTournament(...args),
  uploadTournamentLogo: (...args: any[]) => mockUploadLogo(...args),
}));

describe('TournamentForm Component', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form rendering', () => {
    it('should render all required form fields', () => {
      render(<TournamentForm {...defaultProps} />);

      // Basic fields
      expect(screen.getByLabelText(/tournament name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/format/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/duration type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/end time/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/total participants/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/target count/i)).toBeInTheDocument();
      
      // Logo upload
      expect(screen.getByLabelText(/tournament logo/i)).toBeInTheDocument();
      
      // Actions
      expect(screen.getByRole('button', { name: /create tournament/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should render format options correctly', () => {
      render(<TournamentForm {...defaultProps} />);

      const formatSelect = screen.getByLabelText(/format/i);
      expect(formatSelect).toBeInTheDocument();

      // Check if options are rendered (they may be in a select dropdown)
      fireEvent.click(formatSelect);
      
      // Wait for options to appear and verify they contain expected values
      waitFor(() => {
        // These might be options or data attributes depending on implementation
        expect(document.body).toHaveTextContent(/single/i);
        expect(document.body).toHaveTextContent(/double/i);
        expect(document.body).toHaveTextContent(/knockout/i);
        expect(document.body).toHaveTextContent(/pool/i);
      });
    });

    it('should render duration type options correctly', () => {
      render(<TournamentForm {...defaultProps} />);

      const durationSelect = screen.getByLabelText(/duration type/i);
      fireEvent.click(durationSelect);

      waitFor(() => {
        expect(document.body).toHaveTextContent(/full day/i);
        expect(document.body).toHaveTextContent(/half day/i);
        expect(document.body).toHaveTextContent(/evening/i);
      });
    });
  });

  describe('Form validation', () => {
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

      const participantsInput = screen.getByLabelText(/total participants/i);
      
      // Test minimum
      await user.type(participantsInput, '1');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/minimum 2 participants/i)).toBeInTheDocument();
      });

      // Test maximum
      await user.clear(participantsInput);
      await user.type(participantsInput, '513');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/maximum 512 participants/i)).toBeInTheDocument();
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

  describe('Form submission', () => {
    const validFormData = {
      name: 'Test Tournament',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: '2026-03-15T10:00',
      endTime: '2026-03-15T18:00',
      totalParticipants: '16',
      targetCount: '3',
    };

    it('should submit form with valid data', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      
      mockCreateTournament.mockResolvedValueOnce({
        id: 'tournament-123',
        ...validFormData,
      });

      render(<TournamentForm {...defaultProps} onSubmit={mockOnSubmit} />);

      // Fill form
      await user.type(screen.getByLabelText(/tournament name/i), validFormData.name);
      await user.selectOptions(screen.getByLabelText(/format/i), validFormData.format);
      await user.selectOptions(screen.getByLabelText(/duration type/i), validFormData.durationType);
      await user.type(screen.getByLabelText(/start time/i), validFormData.startTime);
      await user.type(screen.getByLabelText(/end time/i), validFormData.endTime);
      await user.type(screen.getByLabelText(/total participants/i), validFormData.totalParticipants);
      await user.type(screen.getByLabelText(/target count/i), validFormData.targetCount);

      // Submit
      await user.click(screen.getByRole('button', { name: /create tournament/i }));

      await waitFor(() => {
          expect(mockCreateTournament).toHaveBeenCalledWith(
            {
              name: validFormData.name,
              format: validFormData.format,
              durationType: validFormData.durationType,
              startTime: '2026-03-15T10:00',
              endTime: '2026-03-15T18:00',
              totalParticipants: 16,
              targetCount: 3,
            },
            undefined
          );
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

      // Fill form
      await user.type(screen.getByLabelText(/tournament name/i), validFormData.name);
      await user.selectOptions(screen.getByLabelText(/format/i), validFormData.format);
      await user.selectOptions(screen.getByLabelText(/duration type/i), validFormData.durationType);
      await user.type(screen.getByLabelText(/start time/i), validFormData.startTime);
      await user.type(screen.getByLabelText(/end time/i), validFormData.endTime);
      await user.type(screen.getByLabelText(/total participants/i), validFormData.totalParticipants);
      await user.type(screen.getByLabelText(/target count/i), validFormData.targetCount);

      // Add logo file
      const logoInput = screen.getByLabelText(/tournament logo/i);
      const file = new File(['test'], 'logo.png', { type: 'image/png' });
      await user.upload(logoInput, file);

      // Submit
      await user.click(screen.getByRole('button', { name: /create tournament/i }));

      await waitFor(() => {
          expect(mockCreateTournament).toHaveBeenCalled();
          expect(mockUploadLogo).toHaveBeenCalledWith('tournament-123', file, undefined);
          expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      
      // Mock slow API call
      mockCreateTournament.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ id: '123' }), 1000))
      );

      render(<TournamentForm {...defaultProps} />);

      // Fill minimum required fields
      await user.type(screen.getByLabelText(/tournament name/i), 'Test');
      await user.selectOptions(screen.getByLabelText(/format/i), TournamentFormat.SINGLE);
      await user.selectOptions(screen.getByLabelText(/duration type/i), DurationType.FULL_DAY);
      await user.type(screen.getByLabelText(/start time/i), '2026-03-15T10:00');
      await user.type(screen.getByLabelText(/end time/i), '2026-03-15T18:00');
      await user.type(screen.getByLabelText(/total participants/i), '8');
      await user.type(screen.getByLabelText(/target count/i), '2');

      // Submit
      await user.click(screen.getByRole('button', { name: /create tournament/i }));

      // Check loading state
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument();
    });

    it('should handle submission errors', async () => {
      const user = userEvent.setup();
      
      mockCreateTournament.mockRejectedValueOnce(new Error('Tournament creation failed'));

      render(<TournamentForm {...defaultProps} />);

      // Fill form with valid data
      await user.type(screen.getByLabelText(/tournament name/i), validFormData.name);
      await user.selectOptions(screen.getByLabelText(/format/i), validFormData.format);
      await user.selectOptions(screen.getByLabelText(/duration type/i), validFormData.durationType);
      await user.type(screen.getByLabelText(/start time/i), validFormData.startTime);
      await user.type(screen.getByLabelText(/end time/i), validFormData.endTime);
      await user.type(screen.getByLabelText(/total participants/i), validFormData.totalParticipants);
      await user.type(screen.getByLabelText(/target count/i), validFormData.targetCount);

      // Submit
      await user.click(screen.getByRole('button', { name: /create tournament/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to create tournament/i)).toBeInTheDocument();
      });
    });
  });

  describe('File upload handling', () => {
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
      
      // Create large file (> 5MB)
      const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large-logo.png', { 
        type: 'image/png' 
      });
      
      await user.upload(logoInput, largeFile);

      await waitFor(() => {
        expect(screen.getByText(/file size cannot exceed 5mb/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<TournamentForm {...defaultProps} />);

      // Form should be labeled
      expect(screen.getByRole('form', { name: /create tournament/i })).toBeInTheDocument();
      
      // Required fields should be marked
      expect(screen.getByLabelText(/tournament name/i)).toHaveAttribute('required');
      expect(screen.getByLabelText(/format/i)).toHaveAttribute('required');
      
      // Error messages should be associated with fields
      // (This would be tested after triggering validation errors)
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<TournamentForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/tournament name/i);
      nameInput.focus();

      // Tab through form fields
      await user.tab();
      expect(screen.getByLabelText(/format/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/duration type/i)).toHaveFocus();
    });
  });

  describe('Form reset and cancel', () => {
    it('should call onCancel when cancel button clicked', async () => {
      const user = userEvent.setup();
      const mockOnCancel = vi.fn();
      
      render(<TournamentForm {...defaultProps} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should reset form after successful submission', async () => {
      const user = userEvent.setup();
      
      mockCreateTournament.mockResolvedValueOnce({ id: 'tournament-123' });

      render(<TournamentForm {...defaultProps} />);

      // Fill form
      const nameInput = screen.getByLabelText(/tournament name/i);
      await user.type(nameInput, 'Test Tournament');

      // Submit
      await user.click(screen.getByRole('button', { name: /create tournament/i }));

      // Form should reset after successful submission
      await waitFor(() => {
        expect(nameInput).toHaveValue('');
      });
    });
  });
});