import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import useScreenRotation from '../../../src/hooks/use-screen-rotation';

const socket = {
  on: vi.fn(),
  emit: vi.fn(),
  removeAllListeners: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => socket),
}));

vi.mock('../../../src/services/tournament-service', () => ({
  fetchLiveTournamentSummary: vi.fn(async () => []),
}));

const HookHarness = (properties: Parameters<typeof useScreenRotation>[0]) => {
  useScreenRotation(properties);
  return null;
};

describe('useScreenRotation', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/tournaments/t1/live')) {
        return {
          ok: true,
          json: async () => ({
            id: 't1',
            poolStages: [{ id: 's1', status: 'IN_PROGRESS', poolCount: 1 }],
            brackets: [{ id: 'b1', status: 'IN_PROGRESS' }],
          }),
        } as Response;
      }
      return {
        ok: false,
        json: async () => ({}),
      } as Response;
    });
    socket.on.mockClear();
    socket.emit.mockClear();
    socket.removeAllListeners.mockClear();
    socket.disconnect.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps default state in non-screen mode', () => {
    render(
      <HookHarness
        screenMode={false}
        tournamentId={undefined}
        stageId={undefined}
        bracketId={undefined}
        view={undefined}
        status={undefined}
        authEnabled={false}
        isAuthenticated={false}
        getAccessTokenSilently={vi.fn(async () => '')}
      />
    );

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('navigates to next tournament screen item after timeout', async () => {
    globalThis.history.pushState({}, '', '/?view=pool-stages&screen=1&tournamentId=t1&stageId=s1');
    const setTimeoutSpy = vi.spyOn(globalThis.window, 'setTimeout');

    render(
      <HookHarness
        screenMode
        tournamentId="t1"
        stageId="s1"
        bracketId={undefined}
        view="pool-stages"
        status="LIVE"
        authEnabled={false}
        isAuthenticated={false}
        getAccessTokenSilently={vi.fn(async () => '')}
      />
    );

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 20_000);
    });
  });
});
