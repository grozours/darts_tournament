import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useTournamentListData from '../../../../src/components/tournament-list/use-tournament-list-data';

const createResponse = (options: { ok: boolean; status?: number; statusText?: string; json?: unknown; text?: string }) => ({
  ok: options.ok,
  status: options.status ?? 200,
  statusText: options.statusText ?? 'OK',
  json: async () => options.json ?? {},
  text: async () => options.text ?? '',
});

describe('useTournamentListData', () => {
  const getSafeAccessToken = vi.fn();

  beforeEach(() => {
    getSafeAccessToken.mockReset();
    globalThis.fetch = vi.fn();
    globalThis.confirm = vi.fn();
    globalThis.alert = vi.fn();
  });

  it('sets an error when the list fetch fails', async () => {
    getSafeAccessToken.mockResolvedValue('token');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      createResponse({ ok: false, status: 500, statusText: 'Server', text: 'fail' })
    );

    const { result } = renderHook(() => useTournamentListData({
      authEnabled: true,
      isAuthenticated: false,
      getSafeAccessToken,
    }));

    await act(async () => {
      await result.current.fetchTournaments();
    });

    expect(result.current.error).toContain('Failed to fetch tournaments');
  });

  it('skips deletion when confirmation is rejected', async () => {
    getSafeAccessToken.mockResolvedValue('token');
    (globalThis.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { result } = renderHook(() => useTournamentListData({
      authEnabled: true,
      isAuthenticated: false,
      getSafeAccessToken,
    }));

    await act(async () => {
      await result.current.deleteTournament('t1');
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('deletes a tournament and refreshes the list', async () => {
    getSafeAccessToken.mockResolvedValue('token');
    (globalThis.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);

    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(createResponse({ ok: true }))
      .mockResolvedValueOnce(createResponse({ ok: true, json: { tournaments: [] } }));

    const { result } = renderHook(() => useTournamentListData({
      authEnabled: true,
      isAuthenticated: false,
      getSafeAccessToken,
    }));

    await act(async () => {
      await result.current.deleteTournament('t1');
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tournaments/t1', expect.objectContaining({
      method: 'DELETE',
      headers: { Authorization: 'Bearer token' },
    }));
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tournaments', expect.objectContaining({
      headers: { Authorization: 'Bearer token' },
    }));
  });
});
