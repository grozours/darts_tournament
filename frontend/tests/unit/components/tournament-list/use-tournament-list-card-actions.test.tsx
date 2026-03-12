import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useTournamentListCardActions from '../../../../src/components/tournament-list/use-tournament-list-card-actions';

const fetchTournamentPlayers = vi.fn();
const updateTournamentStatus = vi.fn();
const autoFillTournamentPlayers = vi.fn();
const confirmAllTournamentPlayers = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  fetchTournamentPlayers: (...arguments_: unknown[]) => fetchTournamentPlayers(...arguments_),
  updateTournamentStatus: (...arguments_: unknown[]) => updateTournamentStatus(...arguments_),
}));

vi.mock('../../../../src/components/tournament-list/tournament-players-actions', () => ({
  autoFillTournamentPlayers: (...arguments_: unknown[]) => autoFillTournamentPlayers(...arguments_),
  confirmAllTournamentPlayers: (...arguments_: unknown[]) => confirmAllTournamentPlayers(...arguments_),
}));

describe('useTournamentListCardActions', () => {
  beforeEach(() => {
    fetchTournamentPlayers.mockReset();
    updateTournamentStatus.mockReset();
    autoFillTournamentPlayers.mockReset();
    confirmAllTournamentPlayers.mockReset();
    vi.stubGlobal('alert', vi.fn());
  });

  const buildHook = (override: Record<string, unknown> = {}) => {
    const fetchTournaments = vi.fn(async () => undefined);
    const getSafeAccessToken = vi.fn(async () => 'token');
    const visibleTournaments = [{
      id: 't1',
      name: 'Cup',
      status: 'OPEN',
      totalParticipants: 16,
      currentParticipants: 0,
    }];
    const t = (key: string) => key;
    const { result } = renderHook(() => useTournamentListCardActions({
      t,
      visibleTournaments,
      getSafeAccessToken,
      fetchTournaments,
      ...override,
    } as never));

    return { result, fetchTournaments, getSafeAccessToken };
  };

  it('opens draft, registration and signature from card', async () => {
    updateTournamentStatus.mockResolvedValue(undefined);
    const { result, fetchTournaments } = buildHook();

    await act(async () => {
      await result.current.openDraftFromCard('t1');
      await result.current.openRegistrationFromCard('t1');
      await result.current.openSignatureFromCard('t1');
    });

    expect(updateTournamentStatus).toHaveBeenNthCalledWith(1, 't1', 'DRAFT', 'token');
    expect(updateTournamentStatus).toHaveBeenNthCalledWith(2, 't1', 'OPEN', 'token');
    expect(updateTournamentStatus).toHaveBeenNthCalledWith(3, 't1', 'SIGNATURE', 'token');
    expect(fetchTournaments).toHaveBeenCalledTimes(3);
    expect(result.current.openingDraftId).toBeUndefined();
    expect(result.current.openingRegistrationId).toBeUndefined();
    expect(result.current.openingSignatureId).toBeUndefined();
  });

  it('shows translated fallback alerts for non-Error failures', async () => {
    updateTournamentStatus
      .mockRejectedValueOnce('boom')
      .mockRejectedValueOnce('boom')
      .mockRejectedValueOnce('boom');
    const { result } = buildHook();

    await act(async () => {
      await result.current.openDraftFromCard('t1');
      await result.current.openRegistrationFromCard('t1');
      await result.current.openSignatureFromCard('t1');
    });

    expect(globalThis.alert).toHaveBeenNthCalledWith(1, 'edit.error.failedMoveToDraft');
    expect(globalThis.alert).toHaveBeenNthCalledWith(2, 'edit.error.failedOpenRegistration');
    expect(globalThis.alert).toHaveBeenNthCalledWith(3, 'edit.error.failedMoveToSignature');
  });

  it('returns early when tournament is not visible', async () => {
    const { result } = buildHook({ visibleTournaments: [] });

    await act(async () => {
      await result.current.autoFillTournamentFromCard('missing');
      await result.current.confirmAllFromCard('missing');
    });

    expect(fetchTournamentPlayers).not.toHaveBeenCalled();
    expect(autoFillTournamentPlayers).not.toHaveBeenCalled();
    expect(confirmAllTournamentPlayers).not.toHaveBeenCalled();
  });

  it('returns early for autofill when tournament is not OPEN or already full', async () => {
    const { result: closedResult } = buildHook({
      visibleTournaments: [{
        id: 't1',
        name: 'Cup',
        status: 'DRAFT',
        totalParticipants: 16,
        currentParticipants: 0,
      }],
    });

    await act(async () => {
      await closedResult.current.autoFillTournamentFromCard('t1');
    });

    const { result: fullResult } = buildHook({
      visibleTournaments: [{
        id: 't1',
        name: 'Cup',
        status: 'OPEN',
        totalParticipants: 16,
        currentParticipants: 16,
      }],
    });

    await act(async () => {
      await fullResult.current.autoFillTournamentFromCard('t1');
    });

    expect(fetchTournamentPlayers).not.toHaveBeenCalled();
    expect(autoFillTournamentPlayers).not.toHaveBeenCalled();
  });

  it('handles autofill and confirm-all progress, then clears it', async () => {
    fetchTournamentPlayers.mockResolvedValue([{ playerId: 'p1' }]);
    autoFillTournamentPlayers.mockImplementation(async ({ onProgress }: { onProgress: (value: { current: number; total: number }) => void }) => {
      onProgress({ current: 1, total: 2 });
    });
    confirmAllTournamentPlayers.mockImplementation(async ({ onProgress }: { onProgress: (value: { current: number; total: number }) => void }) => {
      onProgress({ current: 2, total: 2 });
    });

    const { result, fetchTournaments } = buildHook();

    await act(async () => {
      await result.current.autoFillTournamentFromCard('t1');
      await result.current.confirmAllFromCard('t1');
    });

    expect(fetchTournamentPlayers).toHaveBeenCalledWith('t1', 'token');
    expect(autoFillTournamentPlayers).toHaveBeenCalledTimes(1);
    expect(confirmAllTournamentPlayers).toHaveBeenCalledTimes(1);
    expect(fetchTournaments).toHaveBeenCalledTimes(2);
    expect(result.current.autoFillProgressByTournament.t1).toBeUndefined();
    expect(result.current.confirmAllProgressByTournament.t1).toBeUndefined();
  });
});
