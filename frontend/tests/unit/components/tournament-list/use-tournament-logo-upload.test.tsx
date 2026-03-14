import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useTournamentLogoUpload from '../../../../src/components/tournament-list/use-tournament-logo-upload';

const uploadTournamentLogo = vi.fn();
const fetchTournamentLogos = vi.fn();
const deleteTournamentLogo = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  uploadTournamentLogo: (...args: unknown[]) => uploadTournamentLogo(...args),
  fetchTournamentLogos: (...args: unknown[]) => fetchTournamentLogos(...args),
  deleteTournamentLogo: (...args: unknown[]) => deleteTournamentLogo(...args),
}));

const resetServiceMocks = () => {
  beforeEach(() => {
    uploadTournamentLogo.mockReset();
    fetchTournamentLogos.mockReset();
    deleteTournamentLogo.mockReset();
  });
};

describe('useTournamentLogoUpload uploadLogo', () => {
  resetServiceMocks();

  it('returns early when tournament or file is missing', async () => {
    const setEditingTournament = vi.fn();
    const { result } = renderHook(() => useTournamentLogoUpload({
      t: (key: string) => key,
      editingTournament: undefined,
      logoFiles: [],
      getSafeAccessToken: vi.fn(async () => 'token'),
      setEditError: vi.fn(),
      setIsUploadingLogo: vi.fn(),
      setEditingTournament,
      setLogoFiles: vi.fn(),
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
    fetchTournamentLogos.mockResolvedValue({
      logoUrl: '/uploads/logo.png',
      logoUrls: ['/uploads/logo.png'],
    });
    const setEditingTournament = vi.fn();
    const setLogoFiles = vi.fn();
    const fetchTournaments = vi.fn();

    const { result } = renderHook(() => useTournamentLogoUpload({
      t: (key: string) => key,
      editingTournament: { id: 't1', name: 'Cup' } as never,
      logoFiles: [new File(['logo'], 'logo.png', { type: 'image/png' })],
      getSafeAccessToken: vi.fn(async () => 'token'),
      setEditError: vi.fn(),
      setIsUploadingLogo: vi.fn(),
      setEditingTournament,
      setLogoFiles,
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
      logoUrls?: string[];
    };
    expect(updater({ id: 't1', logoUrl: undefined })).toEqual({
      id: 't1',
      logoUrl: '/uploads/logo.png',
      logoUrls: ['/uploads/logo.png'],
    });
    expect(updater(undefined as never)).toBeUndefined();
    expect(setLogoFiles).toHaveBeenCalledWith([]);
    expect(fetchTournaments).toHaveBeenCalledTimes(1);
  });

  it('sets translated error when upload throws non-error', async () => {
    uploadTournamentLogo.mockRejectedValue('boom');
    const setEditError = vi.fn();

    const { result } = renderHook(() => useTournamentLogoUpload({
      t: (key: string) => key,
      editingTournament: { id: 't1', name: 'Cup' } as never,
      logoFiles: [new File(['logo'], 'logo.png', { type: 'image/png' })],
      getSafeAccessToken: vi.fn(async () => 'token'),
      setEditError,
      setIsUploadingLogo: vi.fn(),
      setEditingTournament: vi.fn(),
      setLogoFiles: vi.fn(),
      fetchTournaments: vi.fn(),
    }));

    await act(async () => {
      await result.current.uploadLogo();
    });

    expect(setEditError).toHaveBeenCalledWith('edit.error.failedUploadLogo');
  });
});

describe('useTournamentLogoUpload deleteLogo', () => {
  resetServiceMocks();

  it('deletes a logo and updates logo list', async () => {
    deleteTournamentLogo.mockResolvedValue({
      logoUrl: '/uploads/next.png',
      logoUrls: ['/uploads/next.png', '/uploads/other.png'],
    });
    const setEditingTournament = vi.fn();
    const fetchTournaments = vi.fn();

    const { result } = renderHook(() => useTournamentLogoUpload({
      t: (key: string) => key,
      editingTournament: { id: 't1', name: 'Cup', logoUrl: '/uploads/logo.png' } as never,
      logoFiles: [],
      getSafeAccessToken: vi.fn(async () => 'token'),
      setEditError: vi.fn(),
      setIsUploadingLogo: vi.fn(),
      setEditingTournament,
      setLogoFiles: vi.fn(),
      fetchTournaments,
    }));

    await act(async () => {
      await result.current.deleteLogo('/uploads/logo.png');
    });

    expect(deleteTournamentLogo).toHaveBeenCalledWith('t1', '/uploads/logo.png', 'token');
    const updater = setEditingTournament.mock.calls[0][0] as (current: { id: string; logoUrl?: string }) => {
      id: string;
      logoUrl?: string;
      logoUrls?: string[];
    };
    expect(updater({ id: 't1' })).toEqual({
      id: 't1',
      logoUrl: '/uploads/next.png',
      logoUrls: ['/uploads/next.png', '/uploads/other.png'],
    });
    expect(fetchTournaments).toHaveBeenCalledTimes(1);

    deleteTournamentLogo.mockResolvedValueOnce({ logoUrls: [] });
    await act(async () => {
      await result.current.deleteLogo('/uploads/next.png');
    });
    const updaterWithoutPrimary = setEditingTournament.mock.calls[1][0] as (current: { id: string; logoUrl?: string }) => {
      id: string;
      logoUrl?: string;
      logoUrls?: string[];
    };
    expect(updaterWithoutPrimary({ id: 't1', logoUrl: '/uploads/next.png' })).toEqual({
      id: 't1',
      logoUrls: [],
    });
    expect(updaterWithoutPrimary(undefined as never)).toBeUndefined();
  });

  it('sets translated error when delete throws non-error', async () => {
    deleteTournamentLogo.mockRejectedValue('boom');
    const setEditError = vi.fn();

    const { result } = renderHook(() => useTournamentLogoUpload({
      t: (key: string) => key,
      editingTournament: { id: 't1', name: 'Cup' } as never,
      logoFiles: [],
      getSafeAccessToken: vi.fn(async () => 'token'),
      setEditError,
      setIsUploadingLogo: vi.fn(),
      setEditingTournament: vi.fn(),
      setLogoFiles: vi.fn(),
      fetchTournaments: vi.fn(),
    }));

    await act(async () => {
      await result.current.deleteLogo('/uploads/logo.png');
    });

    expect(setEditError).toHaveBeenCalledWith('edit.error.failedUploadLogo');
  });

  it('returns early when logo url is empty', async () => {
    const { result } = renderHook(() => useTournamentLogoUpload({
      t: (key: string) => key,
      editingTournament: { id: 't1', name: 'Cup' } as never,
      logoFiles: [],
      getSafeAccessToken: vi.fn(async () => 'token'),
      setEditError: vi.fn(),
      setIsUploadingLogo: vi.fn(),
      setEditingTournament: vi.fn(),
      setLogoFiles: vi.fn(),
      fetchTournaments: vi.fn(),
    }));

    await act(async () => {
      await result.current.deleteLogo('');
    });

    expect(deleteTournamentLogo).not.toHaveBeenCalled();
  });
});
