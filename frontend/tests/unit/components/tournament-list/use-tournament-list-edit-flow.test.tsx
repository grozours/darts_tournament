import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useTournamentListEditFlow from '../../../../src/components/tournament-list/use-tournament-list-edit-flow';

const fetchTournamentDetails = vi.fn();
const openEdit = vi.fn();
const uploadLogo = vi.fn(async () => undefined);
const deleteLogo = vi.fn(async () => undefined);
const saveEdit = vi.fn(async () => undefined);
const openRegistration = vi.fn(async () => undefined);
const moveToSignature = vi.fn(async () => undefined);
const moveToLive = vi.fn(async () => undefined);

vi.mock('../../../../src/components/tournament-list/use-tournament-edit-details', () => ({
  default: () => ({ fetchTournamentDetails }),
}));

vi.mock('../../../../src/components/tournament-list/use-tournament-edit-loader', () => ({
  default: () => ({ openEdit }),
}));

vi.mock('../../../../src/components/tournament-list/use-tournament-logo-upload', () => ({
  default: () => ({ uploadLogo, deleteLogo }),
}));

vi.mock('../../../../src/components/tournament-list/use-tournament-edit-actions', () => ({
  default: () => ({ saveEdit, openRegistration, moveToSignature, moveToLive }),
}));

describe('useTournamentListEditFlow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const base = {
    t: (key: string) => key,
    isEditPage: false,
    editTournamentId: undefined,
    getSafeAccessToken: vi.fn(async () => 'token'),
    players: [],
    fetchPlayers: vi.fn(async () => undefined),
    clearPlayers: vi.fn(),
    clearPlayersError: vi.fn(),
    resetPlayersState: vi.fn(),
    resetStructureState: vi.fn(),
    loadPoolStages: vi.fn(async () => undefined),
    loadBrackets: vi.fn(async () => undefined),
    loadTargets: vi.fn(async () => undefined),
    fetchTournaments: vi.fn(),
    editingTournament: { id: 't1', name: 'Cup' },
    editForm: undefined,
    logoFiles: [],
    setEditingTournament: vi.fn(),
    setEditForm: vi.fn(),
    setEditError: vi.fn(),
    setEditLoading: vi.fn(),
    setEditLoadError: vi.fn(),
    setIsSaving: vi.fn(),
    setLogoFiles: vi.fn(),
    setIsUploadingLogo: vi.fn(),
  };

  it('delegates action hooks and clears state on close', async () => {
    const props = { ...base };
    const { result } = renderHook(() => useTournamentListEditFlow(props as never));

    act(() => {
      result.current.openEdit({ id: 't2' } as never);
      result.current.closeEdit();
    });

    await act(async () => {
      await result.current.uploadLogo();
      await result.current.deleteLogo('/uploads/logo.png');
      await result.current.saveEdit();
      await result.current.openRegistration();
      await result.current.moveToSignature();
      await result.current.moveToLive();
    });

    expect(openEdit).toHaveBeenCalledTimes(1);
    expect(props.setEditingTournament).toHaveBeenCalledWith(undefined);
    expect(props.setEditForm).toHaveBeenCalledWith(undefined);
    expect(props.resetPlayersState).toHaveBeenCalledTimes(1);
    expect(props.resetStructureState).toHaveBeenCalledTimes(1);
    expect(uploadLogo).toHaveBeenCalledTimes(1);
    expect(deleteLogo).toHaveBeenCalledWith('/uploads/logo.png');
    expect(saveEdit).toHaveBeenCalledTimes(1);
    expect(openRegistration).toHaveBeenCalledTimes(1);
    expect(moveToSignature).toHaveBeenCalledTimes(1);
    expect(moveToLive).toHaveBeenCalledTimes(1);
  });

  it('executes edit-page close branch and still resets local state', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const props = {
      ...base,
      isEditPage: true,
    };
    const { result } = renderHook(() => useTournamentListEditFlow(props as never));

    act(() => {
      result.current.closeEdit();
    });

    expect(props.setEditingTournament).toHaveBeenCalledWith(undefined);
    expect(props.setEditForm).toHaveBeenCalledWith(undefined);
    expect(props.setEditError).toHaveBeenCalledWith(undefined);
    expect(props.setLogoFiles).toHaveBeenCalledWith([]);
  });

});
