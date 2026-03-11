import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/app';

vi.mock('../../src/components/app-header', () => ({ default: () => <div>Tournament Manager</div> }));
vi.mock('../../src/components/tournament-list', () => ({ default: () => <div>TOURNAMENT_LIST</div> }));

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

  it('renders the header and home view', async () => {
    render(<App />);

    expect(await screen.findByText(/tournament manager/i)).toBeInTheDocument();
    expect(await screen.findByText('TOURNAMENT_LIST')).toBeInTheDocument();

  });
});
