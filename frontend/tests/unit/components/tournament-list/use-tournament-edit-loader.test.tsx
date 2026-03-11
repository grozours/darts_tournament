import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useTournamentEditLoader from '../../../../src/components/tournament-list/use-tournament-edit-loader';

const getSafeAccessToken = vi.fn();

const baseProperties = () => ({
  isEditPage: true,
  editTournamentId: undefined,
  editingTournamentId: undefined,
  toLocalInput: vi.fn((value?: string) => `local:${value ?? ''}`),
  getSafeAccessToken,
  clearPlayers: vi.fn(),
  clearPlayersError: vi.fn(),
  fetchPlayers: vi.fn(async () => undefined),
  fetchTournamentDetails: vi.fn(async () => undefined),
  loadPoolStages: vi.fn(async () => undefined),
  loadBrackets: vi.fn(async () => undefined),
  loadTargets: vi.fn(async () => undefined),
  setEditingTournament: vi.fn(),
  setEditForm: vi.fn(),
  setEditError: vi.fn(),
  setEditLoading: vi.fn(),
  setEditLoadError: vi.fn(),
});

beforeEach(() => {
  getSafeAccessToken.mockReset();
  globalThis.fetch = vi.fn();
});

describe('use-tournament-edit-loader', () => {

  it('navigates to edit page when not already on edit page', () => {
    const assign = vi.fn();
    const location = { assign } as unknown as Location;
    Object.defineProperty(globalThis, 'location', {
      value: location,
      configurable: true,
    });

    const properties = baseProperties();
    properties.isEditPage = false;

    const { result } = renderHook(() => useTournamentEditLoader(properties));

    act(() => {
      result.current.openEdit({
        id: 't1',
        name: 'Tournament',
        format: 'SINGLE',
        totalParticipants: 16,
        status: 'OPEN',
      });
    });

    expect(assign).toHaveBeenCalledWith('/?view=edit-tournament&tournamentId=t1');
    expect(properties.setEditingTournament).not.toHaveBeenCalled();
  });

  it('loads players only for OPEN/SIGNATURE and clears players otherwise', () => {
    const properties = baseProperties();
    const { result } = renderHook(() => useTournamentEditLoader(properties));

    act(() => {
      result.current.openEdit({
        id: 'open-id',
        name: 'Open T',
        format: 'SINGLE',
        totalParticipants: 8,
        status: 'open',
      }, { skipNavigation: true });
    });

    expect(properties.fetchPlayers).toHaveBeenCalledWith('open-id');
    expect(properties.clearPlayers).not.toHaveBeenCalled();

    act(() => {
      result.current.openEdit({
        id: 'live-id',
        name: 'Live T',
        format: 'SINGLE',
        totalParticipants: 8,
        status: 'LIVE',
      }, { skipNavigation: true });
    });

    expect(properties.clearPlayers).toHaveBeenCalledTimes(1);
    expect(properties.fetchTournamentDetails).toHaveBeenCalledWith('live-id');
    expect(properties.loadPoolStages).toHaveBeenCalledWith('live-id');
    expect(properties.loadBrackets).toHaveBeenCalledWith('live-id');
    expect(properties.loadTargets).toHaveBeenCalledWith('live-id');
  });

});

describe('use-tournament-edit-loader - loading', () => {
  it('loads tournament data with bearer token and maps snake_case fields', async () => {
    const properties = baseProperties();
    properties.editTournamentId = 'abc';
    getSafeAccessToken.mockResolvedValue('token');

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'abc',
        name: 'Mapped',
        format: 'DOUBLE',
        total_participants: 24,
        status: 'SIGNATURE',
        duration_type: 'HALF_DAY',
        start_time: '2026-01-01T10:00:00.000Z',
        end_time: '2026-01-01T16:00:00.000Z',
        target_count: 12,
        target_start_number: 3,
        share_targets: false,
        double_stage_enabled: true,
      }),
    });

    renderHook(() => useTournamentEditLoader(properties));
    await act(async () => {
      await Promise.resolve();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tournaments/abc', {
      headers: { Authorization: 'Bearer token' },
    });
    expect(properties.setEditForm).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Mapped',
      format: 'DOUBLE',
      durationType: 'HALF_DAY',
      totalParticipants: '24',
      targetCount: '12',
      targetStartNumber: '3',
      shareTargets: false,
      doubleStageEnabled: true,
    }));
  });

  it('reports fallback errors for failed loads and toggles loading state', async () => {
    const properties = baseProperties();
    properties.editTournamentId = 'abc';
    getSafeAccessToken.mockResolvedValue(undefined);

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });

    renderHook(() => useTournamentEditLoader(properties));
    await act(async () => {
      await Promise.resolve();
    });

    expect(properties.setEditLoadError).toHaveBeenCalledWith('Failed to load tournament');
    expect(properties.setEditLoading).toHaveBeenCalledWith(true);
    expect(properties.setEditLoading).toHaveBeenCalledWith(false);
  });
});
