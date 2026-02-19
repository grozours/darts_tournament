import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CreateTournamentPage from '../../../src/components/tournaments/create-tournament-page';

const mockLoginWithRedirect = vi.fn();
const mockGetAccessTokenSilently = vi.fn();
const mockCreateTournament = vi.fn();
const mockCreatePoolStage = vi.fn();
const mockCreateBracket = vi.fn();

let authEnabled = false;
let isAuthenticated = true;

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => ({
    enabled: authEnabled,
    isAuthenticated,
    loginWithRedirect: mockLoginWithRedirect,
    getAccessTokenSilently: mockGetAccessTokenSilently,
  }),
}));

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../src/services/tournament-service', () => ({
  createTournament: (...args: unknown[]) => mockCreateTournament(...args),
  createPoolStage: (...args: unknown[]) => mockCreatePoolStage(...args),
  createBracket: (...args: unknown[]) => mockCreateBracket(...args),
}));

vi.mock('../../../src/components/tournaments/tournament-form', () => ({
  default: ({ onSubmit, onCancel }: { onSubmit: () => void; onCancel: () => void }) => (
    <div>
      <button type="button" onClick={onSubmit}>Submit</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

describe('CreateTournamentPage', () => {
  const originalLocation = globalThis.window.location;

  beforeEach(() => {
    authEnabled = false;
    isAuthenticated = true;
    mockLoginWithRedirect.mockReset();
    mockGetAccessTokenSilently.mockReset();
    mockCreateTournament.mockReset();
    mockCreatePoolStage.mockReset();
    mockCreateBracket.mockReset();

    Object.defineProperty(globalThis.window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis.window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('shows validation errors for preset inputs', async () => {
    render(<CreateTournamentPage />);

    fireEvent.change(screen.getByLabelText(/Tournament name/i), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/Total participants/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/Target count/i), { target: { value: '0' } });

    fireEvent.click(screen.getByRole('button', { name: /Create single-stage preset/i }));

    expect(await screen.findByText(/Tournament name is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/Total participants must be at least 4/i)).toBeInTheDocument();
    expect(await screen.findByText(/Target count must be at least 1/i)).toBeInTheDocument();
  });

  it('requires auth before creating presets', async () => {
    authEnabled = true;
    isAuthenticated = false;

    render(<CreateTournamentPage />);

    fireEvent.change(screen.getByLabelText(/Tournament name/i), { target: { value: 'Weekend Cup' } });
    fireEvent.click(screen.getByRole('button', { name: /Create single-stage preset/i }));

    await waitFor(() => {
      expect(mockLoginWithRedirect).toHaveBeenCalled();
    });

    expect(screen.getByText(/Please sign in to create tournaments/i)).toBeInTheDocument();
  });

  it('creates presets and redirects on success', async () => {
    mockCreateTournament.mockResolvedValue({ id: 't-1' });
    mockCreatePoolStage.mockResolvedValue({ id: 'stage-1' });
    mockCreateBracket.mockResolvedValue({ id: 'bracket-1' });

    render(<CreateTournamentPage />);

    fireEvent.change(screen.getByLabelText(/Tournament name/i), { target: { value: 'Weekend Cup' } });

    fireEvent.click(screen.getByRole('button', { name: /Create single-stage preset/i }));

    await waitFor(() => {
      expect(mockCreateTournament).toHaveBeenCalled();
    });

    expect(mockCreatePoolStage).toHaveBeenCalled();
    expect(mockCreateBracket).toHaveBeenCalled();
    expect(globalThis.window.location.href).toBe('/?status=DRAFT');
  });
});
