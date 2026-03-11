import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/app';

const mockFetch = vi.fn();

describe('Home page', () => {
  beforeEach(() => {
    vi.useRealTimers();
    globalThis.history.replaceState({}, '', '/');
    globalThis.localStorage.clear();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tournaments: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders the header and empty state', async () => {
    render(<App />);

    expect(await screen.findByText(/tournament manager/i)).toBeInTheDocument();

    expect(
      await screen.findByText(/no tournaments yet|aucun tournoi pour le moment/i, {}, { timeout: 5000 })
    ).toBeInTheDocument();

  });
});
