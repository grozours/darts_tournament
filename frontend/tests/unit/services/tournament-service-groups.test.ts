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
  registerDoublette,
  registerEquipe,
  removeDoubletteMember,
  removeEquipeMember,
  searchGroupPlayers,
  updateDoublette,
  updateDoublettePassword,
  updateEquipe,
  updateEquipePassword,
} from '../../../src/services/tournament-service';

const mockFetch = vi.fn();

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

    await expect(createDoublette('t1', { name: 'D1', password: '1234' })).resolves.toEqual({ id: 'd1' });
    await expect(updateDoublette('t1', 'd1', { name: 'D2' })).resolves.toEqual({ id: 'd1', name: 'D2' });
    await expect(createEquipe('t1', { name: 'E1', password: '1234' })).resolves.toEqual({ id: 'e1' });
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

    await expect(joinDoublette('t1', 'd1', { password: '1234' })).resolves.toEqual({ id: 'd1' });
    await expect(joinEquipe('t1', 'e1', { password: '1234' })).resolves.toEqual({ id: 'e1' });
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

    await expect(updateDoublettePassword('t1', 'd1', { password: 'new' })).resolves.toBeUndefined();
    await expect(updateEquipePassword('t1', 'e1', { password: 'new' })).resolves.toBeUndefined();
    await expect(deleteDoublette('t1', 'd1')).resolves.toBeUndefined();
    await expect(deleteEquipe('t1', 'e1')).resolves.toBeUndefined();
  });

  it('searches players for groups', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ players: [{ id: 'p1' }] }) });

    await expect(searchGroupPlayers('t1', 'ana')).resolves.toEqual([{ id: 'p1' }]);
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('/group-players/search?query=ana');
  });

  it('surfaces API errors on group endpoints', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'group error' });
    await expect(fetchDoublettes('t1')).rejects.toThrow();

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'group error' });
    await expect(createDoublette('t1', { name: 'D1', password: '1234' })).rejects.toThrow();

    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'group error' });
    await expect(searchGroupPlayers('t1', 'a')).rejects.toThrow();
  });
});
