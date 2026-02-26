import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useTournamentLogoUpload from '../../../../src/components/tournament-list/use-tournament-logo-upload';

const uploadTournamentLogo = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  uploadTournamentLogo: (...args: unknown[]) => uploadTournamentLogo(...args),
}));

describe('useTournamentLogoUpload', () => {
  beforeEach(() => {
    uploadTournamentLogo.mockReset();
  });

  it('returns early when tournament or file is missing', async () => {
    const setEditingTournament = vi.fn();
    const { result } = renderHook(() => useTournamentLogoUpload({
      t: (key: string) => key,
      editingTournament: undefined,
      logoFile: undefined,
      getSafeAccessToken: vi.fn(async () => 'token'),
      setEditError: vi.fn(),
      setIsUploadingLogo: vi.fn(),
      setEditingTournament,
      setLogoFile: vi.fn(),
      fetchTournaments: vi.fn(),
    }));

    await act(async () => {
      await result.current.uploadLogo();
    });

    expect(uploadTournamentLogo).not.toHaveBeenCalled();
    expect(setEditingTournament).not.toHaveBeenCalled();
  });

  it('uploads logo and updates tournament logoUrl', async () => {
    uploadTournamentLogo.mockResolvedValue({ logo_url: '/uploads/logo.png' });
    const setEditingTournament = vi.fn();
    const setLogoFile = vi.fn();
    const fetchTournaments = vi.fn();

    const { result } = renderHook(() => useTournamentLogoUpload({
      t: (key: string) => key,
      editingTournament: { id: 't1', name: 'Cup' } as never,
      logoFile: new File(['logo'], 'logo.png', { type: 'image/png' }),
      getSafeAccessToken: vi.fn(async () => 'token'),
      setEditError: vi.fn(),
      setIsUploadingLogo: vi.fn(),
      setEditingTournament,
      setLogoFile,
      fetchTournaments,
    }));

    await act(async () => {
      await result.current.uploadLogo();
    });

    expect(uploadTournamentLogo).toHaveBeenCalledWith('t1', expect.any(File), 'token');
    expect(setEditingTournament).toHaveBeenCalledTimes(1);
    const updater = setEditingTournament.mock.calls[0][0] as (current: { id: string; logoUrl?: string }) => {
      id: string;
      logoUrl?: string;
    };
    expect(updater({ id: 't1', logoUrl: undefined })).toEqual({ id: 't1', logoUrl: '/uploads/logo.png' });
    expect(setLogoFile).toHaveBeenCalledWith(undefined);
    expect(fetchTournaments).toHaveBeenCalledTimes(1);
  });

  it('sets translated error when upload throws non-error', async () => {
    uploadTournamentLogo.mockRejectedValue('boom');
    const setEditError = vi.fn();

    const { result } = renderHook(() => useTournamentLogoUpload({
      t: (key: string) => key,
      editingTournament: { id: 't1', name: 'Cup' } as never,
      logoFile: new File(['logo'], 'logo.png', { type: 'image/png' }),
      getSafeAccessToken: vi.fn(async () => 'token'),
      setEditError,
      setIsUploadingLogo: vi.fn(),
      setEditingTournament: vi.fn(),
      setLogoFile: vi.fn(),
      fetchTournaments: vi.fn(),
    }));

    await act(async () => {
      await result.current.uploadLogo();
    });

    expect(setEditError).toHaveBeenCalledWith('edit.error.failedUploadLogo');
  });
});
