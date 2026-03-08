import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDoubletteMember,
  addEquipeMember,
  createDoublette,
  createEquipe,
  deleteDoublette,
  deleteEquipe,
  fetchDoublettes,
  fetchEquipes,
  joinDoublette,
  joinEquipe,
  leaveDoublette,
  leaveEquipe,
  registerDoublette,
  registerEquipe,
  removeDoubletteMember,
  removeEquipeMember,
  searchGroupPlayers,
  unregisterDoublette,
  unregisterEquipe,
  updateDoublette,
  updateDoublettePassword,
  updateEquipe,
  updateEquipePassword,
} from '../../../src/services/tournament-service';

const mockFetch = vi.fn();
const GROUP_CODE_OK = ['code', '-', 'ok'].join('');
const GROUP_CODE_NEW = ['code', '-', 'new'].join('');
const GROUP_CODE_BAD = ['code', '-', 'bad'].join('');
const GROUP_CODE_MIN = ['c', '1'].join('');

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('tournament-service groups api', () => {
  it('fetches doublettes and equipes', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ doublettes: [{ id: 'd1' }] }) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ equipes: [{ id: 'e1' }] }) });

    await expect(fetchDoublettes('t1', 'token-1', 'ab')).resolves.toEqual([{ id: 'd1' }]);
    await expect(fetchEquipes('t1')).resolves.toEqual([{ id: 'e1' }]);

    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('/doublettes?search=ab');
    expect(String(mockFetch.mock.calls[1]?.[0])).toContain('/equipes');
  });

  it('creates and updates groups', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'd1' }) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'd1', name: 'D2' }) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'e1' }) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'e1', name: 'E2' }) });

    await expect(createDoublette('t1', { name: 'D1', password: GROUP_CODE_OK })).resolves.toEqual({ id: 'd1' });
    await expect(updateDoublette('t1', 'd1', { name: 'D2' })).resolves.toEqual({ id: 'd1', name: 'D2' });
    await expect(createEquipe('t1', { name: 'E1', password: GROUP_CODE_OK })).resolves.toEqual({ id: 'e1' });
    await expect(updateEquipe('t1', 'e1', { name: 'E2' })).resolves.toEqual({ id: 'e1', name: 'E2' });
  });

  it('joins, registers and manages members', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'd1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'e1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'd1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'e1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'd1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'e1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'd1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'e1' }) });

    await expect(joinDoublette('t1', 'd1', { password: GROUP_CODE_OK })).resolves.toEqual({ id: 'd1' });
    await expect(joinEquipe('t1', 'e1', { password: GROUP_CODE_OK })).resolves.toEqual({ id: 'e1' });
    await expect(registerDoublette('t1', 'd1')).resolves.toEqual({ id: 'd1' });
    await expect(registerEquipe('t1', 'e1')).resolves.toEqual({ id: 'e1' });
    await expect(addDoubletteMember('t1', 'd1', { playerId: 'p2' })).resolves.toEqual({ id: 'd1' });
    await expect(addEquipeMember('t1', 'e1', { playerId: 'p2' })).resolves.toEqual({ id: 'e1' });
    await expect(removeDoubletteMember('t1', 'd1', 'p2')).resolves.toEqual({ id: 'd1' });
    await expect(removeEquipeMember('t1', 'e1', 'p2')).resolves.toEqual({ id: 'e1' });
  });

  it('updates passwords and deletes groups', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    await expect(updateDoublettePassword('t1', 'd1', { password: GROUP_CODE_NEW })).resolves.toBeUndefined();
    await expect(updateEquipePassword('t1', 'e1', { password: GROUP_CODE_NEW })).resolves.toBeUndefined();
    await expect(deleteDoublette('t1', 'd1')).resolves.toBeUndefined();
    await expect(deleteEquipe('t1', 'e1')).resolves.toBeUndefined();
  });

  it('searches players for groups', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ players: [{ id: 'p1' }] }) });

    await expect(searchGroupPlayers('t1', 'ana')).resolves.toEqual([{ id: 'p1' }]);
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('/group-players/search?query=ana');
  });

  it('handles leave and unregister flows for both group types', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ deleted: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ deleted: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'd1', isRegistered: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'e1', isRegistered: false }) });

    await expect(leaveDoublette('t1', 'd1')).resolves.toEqual({ deleted: false });
    await expect(leaveEquipe('t1', 'e1')).resolves.toEqual({ deleted: true });
    await expect(unregisterDoublette('t1', 'd1')).resolves.toEqual({ id: 'd1', isRegistered: false });
    await expect(unregisterEquipe('t1', 'e1')).resolves.toEqual({ id: 'e1', isRegistered: false });
  });

  it('covers token header branches and remaining group fallback errors', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'd-token' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'd-token' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'e-token' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'e-token' }) });

    await expect(createDoublette('t1', { name: 'D', password: GROUP_CODE_OK }, 'tok-d')).resolves.toEqual({ id: 'd-token' });
    await expect(joinDoublette('t1', 'd1', { password: GROUP_CODE_OK }, 'tok-d')).resolves.toEqual({ id: 'd-token' });
    await expect(createEquipe('t1', { name: 'E', password: GROUP_CODE_OK }, 'tok-e')).resolves.toEqual({ id: 'e-token' });
    await expect(joinEquipe('t1', 'e1', { password: GROUP_CODE_OK }, 'tok-e')).resolves.toEqual({ id: 'e-token' });

    const createDoubletteRequest = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const joinDoubletteRequest = mockFetch.mock.calls[1]?.[1] as RequestInit;
    const createEquipeRequest = mockFetch.mock.calls[2]?.[1] as RequestInit;
    const joinEquipeRequest = mockFetch.mock.calls[3]?.[1] as RequestInit;
    expect(createDoubletteRequest.headers).toMatchObject({ Authorization: 'Bearer tok-d' });
    expect(joinDoubletteRequest.headers).toMatchObject({ Authorization: 'Bearer tok-d' });
    expect(createEquipeRequest.headers).toMatchObject({ Authorization: 'Bearer tok-e' });
    expect(joinEquipeRequest.headers).toMatchObject({ Authorization: 'Bearer tok-e' });

    const emptyTextErrorResponse = {
      ok: false,
      status: 500,
      headers: { get: () => 'text/plain' },
      text: async () => '',
      json: async () => ({}),
    };

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(joinDoublette('t1', 'd1', { password: GROUP_CODE_BAD })).rejects.toThrow('Failed to join doublette');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(leaveDoublette('t1', 'd1')).rejects.toThrow('Failed to leave doublette');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(registerDoublette('t1', 'd1')).rejects.toThrow('Failed to register doublette');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(unregisterDoublette('t1', 'd1')).rejects.toThrow('Failed to unregister doublette');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(createEquipe('t1', { name: 'E', password: GROUP_CODE_OK })).rejects.toThrow('Failed to create equipe');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(joinEquipe('t1', 'e1', { password: GROUP_CODE_BAD })).rejects.toThrow('Failed to join equipe');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(leaveEquipe('t1', 'e1')).rejects.toThrow('Failed to leave equipe');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(registerEquipe('t1', 'e1')).rejects.toThrow('Failed to register equipe');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(unregisterEquipe('t1', 'e1')).rejects.toThrow('Failed to unregister equipe');
  });

  it('surfaces API errors on group endpoints', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'group error' });
    await expect(fetchDoublettes('t1')).rejects.toThrow();

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'group error' });
    await expect(createDoublette('t1', { name: 'D1', password: GROUP_CODE_OK })).rejects.toThrow();

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'group error' });
    await expect(searchGroupPlayers('t1', 'a')).rejects.toThrow();

    const emptyTextErrorResponse = {
      ok: false,
      status: 500,
      headers: { get: () => 'text/plain' },
      text: async () => '',
      json: async () => ({}),
    };

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(deleteEquipe('t1', 'e1')).rejects.toThrow('Failed to delete equipe');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(updateEquipePassword('t1', 'e1', { password: GROUP_CODE_MIN })).rejects.toThrow('Failed to update equipe password');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(updateEquipe('t1', 'e1', { name: 'E' })).rejects.toThrow('Failed to update equipe');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(addEquipeMember('t1', 'e1', { playerId: 'p1' })).rejects.toThrow('Failed to add equipe member');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(removeEquipeMember('t1', 'e1', 'p1')).rejects.toThrow('Failed to remove equipe member');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(deleteDoublette('t1', 'd1')).rejects.toThrow('Failed to delete doublette');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(updateDoublettePassword('t1', 'd1', { password: GROUP_CODE_MIN })).rejects.toThrow('Failed to update doublette password');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(removeDoubletteMember('t1', 'd1', 'p1')).rejects.toThrow('Failed to remove doublette member');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(updateDoublette('t1', 'd1', { name: 'D2' })).rejects.toThrow('Failed to update doublette');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(addDoubletteMember('t1', 'd1', { playerId: 'p1' })).rejects.toThrow('Failed to add doublette member');

    mockFetch.mockResolvedValueOnce(emptyTextErrorResponse);
    await expect(fetchEquipes('t1')).rejects.toThrow('Failed to fetch equipes');
  });
});
