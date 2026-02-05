import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../src/App';

const mockFetch = vi.fn();

describe('Home page', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tournaments: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders the header and empty state', async () => {
    render(<App />);

    expect(screen.getByText(/tournament manager/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/no tournaments yet/i)).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /create tournament/i })
    ).toBeInTheDocument();
  });
});
