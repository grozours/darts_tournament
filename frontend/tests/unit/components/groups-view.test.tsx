import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import GroupsView from '../../../src/components/groups-view';
import DoublettesView from '../../../src/components/doublettes-view';
import EquipesView from '../../../src/components/equipes-view';

const authState = {
  enabled: true,
  isAuthenticated: true,
  user: { email: 'me@example.com' },
  getAccessTokenSilently: vi.fn(async () => 'token-1'),
};

const adminState = { isAdmin: false };

const fetchDoublettes = vi.fn();
const fetchEquipes = vi.fn();
const createDoublette = vi.fn();
const createEquipe = vi.fn();
const joinDoublette = vi.fn();
const joinEquipe = vi.fn();
const leaveDoublette = vi.fn();
const leaveEquipe = vi.fn();
const registerDoublette = vi.fn();
const registerEquipe = vi.fn();
const unregisterDoublette = vi.fn();
const unregisterEquipe = vi.fn();
const updateDoublette = vi.fn();
const updateEquipe = vi.fn();
const updateDoublettePassword = vi.fn();
const updateEquipePassword = vi.fn();
const addDoubletteMember = vi.fn();
const addEquipeMember = vi.fn();
const registerTournamentPlayer = vi.fn();
const removeDoubletteMember = vi.fn();
const removeEquipeMember = vi.fn();
const deleteDoublette = vi.fn();
const deleteEquipe = vi.fn();
const searchGroupPlayers = vi.fn();

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../src/auth/optional-auth', () => ({
  useOptionalAuth: () => authState,
}));

vi.mock('../../../src/auth/use-admin-status', () => ({
  useAdminStatus: () => adminState,
}));

vi.mock('../../../src/services/tournament-service', () => ({
  fetchDoublettes: (...args: unknown[]) => fetchDoublettes(...args),
  fetchEquipes: (...args: unknown[]) => fetchEquipes(...args),
  createDoublette: (...args: unknown[]) => createDoublette(...args),
  createEquipe: (...args: unknown[]) => createEquipe(...args),
  joinDoublette: (...args: unknown[]) => joinDoublette(...args),
  joinEquipe: (...args: unknown[]) => joinEquipe(...args),
  leaveDoublette: (...args: unknown[]) => leaveDoublette(...args),
  leaveEquipe: (...args: unknown[]) => leaveEquipe(...args),
  registerDoublette: (...args: unknown[]) => registerDoublette(...args),
  registerEquipe: (...args: unknown[]) => registerEquipe(...args),
  unregisterDoublette: (...args: unknown[]) => unregisterDoublette(...args),
  unregisterEquipe: (...args: unknown[]) => unregisterEquipe(...args),
  updateDoublette: (...args: unknown[]) => updateDoublette(...args),
  updateEquipe: (...args: unknown[]) => updateEquipe(...args),
  updateDoublettePassword: (...args: unknown[]) => updateDoublettePassword(...args),
  updateEquipePassword: (...args: unknown[]) => updateEquipePassword(...args),
  addDoubletteMember: (...args: unknown[]) => addDoubletteMember(...args),
  addEquipeMember: (...args: unknown[]) => addEquipeMember(...args),
  registerTournamentPlayer: (...args: unknown[]) => registerTournamentPlayer(...args),
  removeDoubletteMember: (...args: unknown[]) => removeDoubletteMember(...args),
  removeEquipeMember: (...args: unknown[]) => removeEquipeMember(...args),
  deleteDoublette: (...args: unknown[]) => deleteDoublette(...args),
  deleteEquipe: (...args: unknown[]) => deleteEquipe(...args),
  searchGroupPlayers: (...args: unknown[]) => searchGroupPlayers(...args),
}));

describe('GroupsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.history.pushState({}, '', '/?view=doublettes&tournamentId=t1');
    vi.spyOn(globalThis.window, 'prompt').mockReturnValue('secret');
    vi.spyOn(globalThis.window, 'confirm').mockReturnValue(true);

    fetchDoublettes.mockResolvedValue([]);
    fetchEquipes.mockResolvedValue([]);
    createDoublette.mockResolvedValue({});
    createEquipe.mockResolvedValue({});
    joinDoublette.mockResolvedValue({});
    joinEquipe.mockResolvedValue({});
    leaveDoublette.mockResolvedValue({ deleted: false });
    leaveEquipe.mockResolvedValue({ deleted: false });
    registerDoublette.mockResolvedValue({});
    registerEquipe.mockResolvedValue({});
    unregisterDoublette.mockResolvedValue({});
    unregisterEquipe.mockResolvedValue({});
    updateDoublette.mockResolvedValue({});
    updateEquipe.mockResolvedValue({});
    updateDoublettePassword.mockResolvedValue(undefined);
    updateEquipePassword.mockResolvedValue(undefined);
    addDoubletteMember.mockResolvedValue({});
    addEquipeMember.mockResolvedValue({});
    registerTournamentPlayer.mockResolvedValue({ id: 'new-player-id' });
    removeDoubletteMember.mockResolvedValue({});
    removeEquipeMember.mockResolvedValue({});
    deleteDoublette.mockResolvedValue(undefined);
    deleteEquipe.mockResolvedValue(undefined);
    searchGroupPlayers.mockResolvedValue([{ id: 'p2', firstName: 'Ana', lastName: 'D' }]);
    adminState.isAdmin = false;
    authState.isAuthenticated = true;
    authState.user = { email: 'me@example.com' };
  });

  it('loads groups across open tournaments when tournamentId is missing', async () => {
    globalThis.history.pushState({}, '', '/?view=doublettes');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        tournaments: [
          { id: 't1', name: 'Open T1', format: 'DOUBLE' },
          { id: 't2', name: 'Open T2', format: 'DOUBLE' },
        ],
      }),
    } as Response);

    fetchDoublettes.mockImplementation(async (tournamentId: string) => {
      if (tournamentId === 't2') {
        return [{
          id: 'd-2',
          name: 'My Duo',
          captainPlayerId: 'me',
          isRegistered: false,
          createdAt: new Date().toISOString(),
          memberCount: 1,
          members: [{ playerId: 'me', firstName: 'Me', lastName: 'User', email: 'me@example.com', joinedAt: new Date().toISOString() }],
        }];
      }
      return [];
    });

    render(<GroupsView mode="doublettes" />);

    expect(await screen.findByText('My Duo')).toBeInTheDocument();
    expect(fetchDoublettes).toHaveBeenCalledWith('t1', 'token-1', undefined);
    expect(fetchDoublettes).toHaveBeenCalledWith('t2', 'token-1', undefined);

    fetchSpy.mockRestore();
  });

  it('loads groups and supports search refresh', async () => {
    render(<GroupsView mode="doublettes" />);
    await screen.findByText('groups.none');

    fireEvent.change(screen.getByPlaceholderText('groups.searchPlaceholder'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByText('groups.search'));

    await waitFor(() => {
      expect(fetchDoublettes).toHaveBeenCalled();
    });
  });

  it('ignores tournaments with incompatible format in no-filter mode', async () => {
    globalThis.history.pushState({}, '', '/?view=doublettes');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        tournaments: [
          { id: 's1', name: 'Single T', format: 'SINGLE' },
          { id: 'd1', name: 'Double T', format: 'DOUBLE' },
        ],
      }),
    } as Response);

    fetchDoublettes.mockImplementation(async (tournamentId: string) => {
      if (tournamentId === 'd1') {
        return [{
          id: 'd-1',
          name: 'Only Valid Duo',
          captainPlayerId: 'me',
          isRegistered: false,
          createdAt: new Date().toISOString(),
          memberCount: 1,
          members: [{ playerId: 'me', firstName: 'Me', lastName: 'User', email: 'me@example.com', joinedAt: new Date().toISOString() }],
        }];
      }
      return [];
    });

    render(<GroupsView mode="doublettes" />);

    expect(await screen.findByText('Only Valid Duo')).toBeInTheDocument();
    expect(fetchDoublettes).toHaveBeenCalledWith('d1', 'token-1', undefined);

    fetchSpy.mockRestore();
  });

  it('creates group for authenticated users', async () => {
    render(<GroupsView mode="doublettes" />);
    await screen.findByText('groups.none');

    fireEvent.change(screen.getByPlaceholderText('groups.promptName'), { target: { value: 'New Duo' } });
    fireEvent.change(screen.getByPlaceholderText('groups.promptPassword'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByText('groups.create'));

    await waitFor(() => {
      expect(createDoublette).toHaveBeenCalled();
    });
  });

  it('joins and removes member on available actions', async () => {
    fetchDoublettes.mockResolvedValue([
      {
        id: 'd1',
        name: 'Duo A',
        captainPlayerId: 'p1',
        isRegistered: false,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        members: [{ playerId: 'p1', firstName: 'Ana', lastName: 'D', email: 'ana@example.com', joinedAt: new Date().toISOString() }],
      },
      {
        id: 'd2',
        name: 'My Duo',
        captainPlayerId: 'me',
        isRegistered: false,
        createdAt: new Date().toISOString(),
        memberCount: 2,
        members: [
          { playerId: 'me', firstName: 'Me', lastName: 'User', email: 'me@example.com', joinedAt: new Date().toISOString() },
          { playerId: 'p2', firstName: 'Other', lastName: 'User', email: 'other@example.com', joinedAt: new Date().toISOString() },
        ],
      },
    ]);

    render(<GroupsView mode="doublettes" />);
    await screen.findByText('Duo A');

    fireEvent.click(screen.getAllByText('groups.join')[0]!);
    const joinPasswordInput = screen.getByPlaceholderText('groups.promptJoinPassword');
    fireEvent.change(joinPasswordInput, { target: { value: 'secret' } });
    const joinToolbar = joinPasswordInput.closest('div');
    expect(joinToolbar).toBeTruthy();
    fireEvent.click(within(joinToolbar as HTMLElement).getByText('groups.join'));
    await waitFor(() => {
      expect(joinDoublette).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('groups.removeMember'));
    await waitFor(() => {
      expect(removeDoubletteMember).toHaveBeenCalled();
    });
  });

  it('uses equipes mode endpoints', async () => {
    globalThis.history.pushState({}, '', '/?view=equipes&tournamentId=t1');
    fetchEquipes.mockResolvedValue([{ id: 'e1', name: 'E1', captainPlayerId: 'p1', isRegistered: false, createdAt: new Date().toISOString(), memberCount: 0, members: [] }]);

    render(<GroupsView mode="equipes" />);
    await screen.findByText('E1');
    expect(fetchEquipes).toHaveBeenCalled();
  });

  it('wrapper components render base view', async () => {
    render(<DoublettesView />);
    await screen.findByText('groups.none');

    globalThis.history.pushState({}, '', '/?view=equipes&tournamentId=t1');
    render(<EquipesView />);
    await screen.findByText('groups.none');
  });

  it('supports CRUD flow on DoublettesView wrapper', async () => {
    globalThis.history.pushState({}, '', '/?view=doublettes&tournamentId=t1');
    fetchDoublettes.mockResolvedValue([
      {
        id: 'd-crud',
        name: 'CRUD Duo',
        captainPlayerId: 'me',
        isRegistered: false,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        members: [
          { playerId: 'me', firstName: 'Me', lastName: 'User', email: 'me@example.com', joinedAt: new Date().toISOString() },
        ],
      },
    ]);

    render(<DoublettesView />);

    await screen.findByText('CRUD Duo');
    expect(fetchDoublettes).toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('groups.promptName'), { target: { value: 'CRUD Duo New' } });
    fireEvent.change(screen.getByPlaceholderText('groups.promptPassword'), { target: { value: 'crud-pass' } });
    fireEvent.click(screen.getByText('groups.create'));
    await waitFor(() => {
      expect(createDoublette).toHaveBeenCalled();
    });

    const duoHeading = screen.getByText('CRUD Duo');
    const duoCard = duoHeading.closest('div.rounded-2xl');
    expect(duoCard).toBeTruthy();

    fireEvent.click(within(duoCard as HTMLElement).getByText('common.edit'));
    const renameInput = within(duoCard as HTMLElement).getByDisplayValue('CRUD Duo');
    fireEvent.change(renameInput, { target: { value: 'CRUD Duo Updated' } });
    fireEvent.click(within(duoCard as HTMLElement).getByText('common.save'));
    await waitFor(() => {
      expect(updateDoublette).toHaveBeenCalled();
    });

    const refreshedDuoCard = screen.getByText('CRUD Duo').closest('div.rounded-2xl');
    expect(refreshedDuoCard).toBeTruthy();
    fireEvent.click(within(refreshedDuoCard as HTMLElement).getByText('groups.delete'));
    await waitFor(() => {
      expect(deleteDoublette).toHaveBeenCalled();
    });
  });

  it('supports CRUD flow on EquipesView wrapper', async () => {
    globalThis.history.pushState({}, '', '/?view=equipes&tournamentId=t1');
    fetchEquipes.mockResolvedValue([
      {
        id: 'e-crud',
        name: 'CRUD Team',
        captainPlayerId: 'me',
        isRegistered: false,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        members: [
          { playerId: 'me', firstName: 'Me', lastName: 'User', email: 'me@example.com', joinedAt: new Date().toISOString() },
        ],
      },
    ]);

    render(<EquipesView />);

    await screen.findByText('CRUD Team');
    expect(fetchEquipes).toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('groups.promptName'), { target: { value: 'CRUD Team New' } });
    fireEvent.change(screen.getByPlaceholderText('groups.promptPassword'), { target: { value: 'team-pass' } });
    fireEvent.click(screen.getByText('groups.create'));
    await waitFor(() => {
      expect(createEquipe).toHaveBeenCalled();
    });

    const teamHeading = screen.getByText('CRUD Team');
    const teamCard = teamHeading.closest('div.rounded-2xl');
    expect(teamCard).toBeTruthy();

    fireEvent.click(within(teamCard as HTMLElement).getByText('common.edit'));
    const renameInput = within(teamCard as HTMLElement).getByDisplayValue('CRUD Team');
    fireEvent.change(renameInput, { target: { value: 'CRUD Team Updated' } });
    fireEvent.click(within(teamCard as HTMLElement).getByText('common.save'));
    await waitFor(() => {
      expect(updateEquipe).toHaveBeenCalled();
    });

    const refreshedTeamCard = screen.getByText('CRUD Team').closest('div.rounded-2xl');
    expect(refreshedTeamCard).toBeTruthy();
    fireEvent.click(within(refreshedTeamCard as HTMLElement).getByText('groups.delete'));
    await waitFor(() => {
      expect(deleteEquipe).toHaveBeenCalled();
    });
  });

  it('handles captain actions: rename, password, register and delete', async () => {
    fetchDoublettes.mockResolvedValue([
      {
        id: 'd-captain',
        name: 'My Duo',
        captainPlayerId: 'me',
        isRegistered: false,
        createdAt: new Date().toISOString(),
        memberCount: 2,
        members: [
          { playerId: 'me', firstName: 'Me', lastName: 'User', email: 'me@example.com', joinedAt: new Date().toISOString() },
          { playerId: 'p2', firstName: 'Other', lastName: 'User', email: 'other@example.com', joinedAt: new Date().toISOString() },
        ],
      },
    ]);

    render(<GroupsView mode="doublettes" />);
    await screen.findByText('My Duo');

    fireEvent.click(screen.getByText('common.edit'));
    fireEvent.change(screen.getByDisplayValue('My Duo'), { target: { value: 'Renamed Duo' } });
    fireEvent.click(screen.getByText('common.save'));
    await waitFor(() => {
      expect(updateDoublette).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('groups.changePassword'));
    fireEvent.change(screen.getByPlaceholderText('groups.promptNewPassword'), { target: { value: 'new-pass' } });
    fireEvent.click(screen.getByText('common.save'));
    await waitFor(() => {
      expect(updateDoublettePassword).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('groups.registerDoublette'));
    await waitFor(() => {
      expect(registerDoublette).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('groups.delete'));
    await waitFor(() => {
      expect(deleteDoublette).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(updateDoublette).toHaveBeenCalledTimes(1);
      expect(updateDoublettePassword).toHaveBeenCalledTimes(1);
      expect(registerDoublette).toHaveBeenCalledTimes(1);
      expect(deleteDoublette).toHaveBeenCalledTimes(1);
    });
  });

  it('adds member from search flow as admin', async () => {
    adminState.isAdmin = true;
    fetchDoublettes.mockResolvedValue([
      {
        id: 'd-captain',
        name: 'My Duo',
        captainPlayerId: 'me',
        isRegistered: false,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        members: [
          { playerId: 'me', firstName: 'Me', lastName: 'User', email: 'me@example.com', joinedAt: new Date().toISOString() },
        ],
      },
    ]);

    searchGroupPlayers.mockResolvedValue([
      { id: 'p2', firstName: 'Ana', lastName: 'D' },
      { id: 'p3', firstName: 'Bob', lastName: 'E' },
    ]);

    render(<GroupsView mode="doublettes" />);
    await screen.findByText('My Duo');

    fireEvent.click(screen.getByText('groups.addMember'));
    const memberSearchInput = screen.getByPlaceholderText('groups.promptPlayerSearch');
    fireEvent.change(memberSearchInput, { target: { value: 'ana' } });
    const memberSearchToolbar = memberSearchInput.closest('div');
    expect(memberSearchToolbar).toBeTruthy();
    fireEvent.click(within(memberSearchToolbar as HTMLElement).getByText('groups.search'));

    const anaRowLabel = await screen.findByText('Ana D');
    const anaRow = anaRowLabel.closest('li');
    expect(anaRow).toBeTruthy();
    fireEvent.click(within(anaRow as HTMLElement).getByText('groups.addMember'));

    await waitFor(() => {
      expect(addDoubletteMember).toHaveBeenCalledWith('t1', 'd-captain', { playerId: 'p2' }, 'token-1');
    });
  });

  it('quick-creates a player and auto-adds to the group for admin', async () => {
    adminState.isAdmin = true;
    fetchDoublettes.mockResolvedValue([
      {
        id: 'd-admin',
        name: 'Admin Duo',
        captainPlayerId: 'me',
        isRegistered: false,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        members: [
          { playerId: 'me', firstName: 'Me', lastName: 'User', email: 'me@example.com', joinedAt: new Date().toISOString() },
        ],
      },
    ]);

    render(<GroupsView mode="doublettes" />);
    await screen.findByText('Admin Duo');

    fireEvent.click(screen.getByText('groups.addMember'));
    fireEvent.change(screen.getByPlaceholderText('edit.firstName'), { target: { value: 'Nina' } });
    fireEvent.change(screen.getByPlaceholderText('edit.lastName'), { target: { value: 'Ray' } });
    fireEvent.click(screen.getByText('groups.createAndAddMember'));

    await waitFor(() => {
      expect(registerTournamentPlayer).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ firstName: 'Nina', lastName: 'Ray' }),
        'token-1'
      );
      expect(addDoubletteMember).toHaveBeenCalledWith('t1', 'd-admin', { playerId: 'new-player-id' }, 'token-1');
    });
  });

  it('blocks quick-create when email is invalid', async () => {
    adminState.isAdmin = true;
    fetchDoublettes.mockResolvedValue([
      {
        id: 'd-admin-invalid-email',
        name: 'Admin Duo Email',
        captainPlayerId: 'me',
        isRegistered: false,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        members: [
          { playerId: 'me', firstName: 'Me', lastName: 'User', email: 'me@example.com', joinedAt: new Date().toISOString() },
        ],
      },
    ]);

    render(<GroupsView mode="doublettes" />);
    await screen.findByText('Admin Duo Email');

    fireEvent.click(screen.getByText('groups.addMember'));
    fireEvent.change(screen.getByPlaceholderText('edit.firstName'), { target: { value: 'Nina' } });
    fireEvent.change(screen.getByPlaceholderText('edit.lastName'), { target: { value: 'Ray' } });
    fireEvent.change(screen.getByPlaceholderText('edit.email'), { target: { value: 'bad email@' } });

    const createAndAddButton = screen.getByText('groups.createAndAddMember');
    expect(createAndAddButton).toBeDisabled();

    fireEvent.click(createAndAddButton);
    expect(registerTournamentPlayer).not.toHaveBeenCalled();
    expect(addDoubletteMember).not.toHaveBeenCalled();
  });

  it('shows error when quick-created player has no id', async () => {
    adminState.isAdmin = true;
    registerTournamentPlayer.mockResolvedValueOnce({});
    fetchDoublettes.mockResolvedValue([
      {
        id: 'd-admin-missing-id',
        name: 'Admin Duo Missing Id',
        captainPlayerId: 'me',
        isRegistered: false,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        members: [
          { playerId: 'me', firstName: 'Me', lastName: 'User', email: 'me@example.com', joinedAt: new Date().toISOString() },
        ],
      },
    ]);

    render(<GroupsView mode="doublettes" />);
    await screen.findByText('Admin Duo Missing Id');

    fireEvent.click(screen.getByText('groups.addMember'));
    fireEvent.change(screen.getByPlaceholderText('edit.firstName'), { target: { value: 'Nina' } });
    fireEvent.change(screen.getByPlaceholderText('edit.lastName'), { target: { value: 'Ray' } });
    fireEvent.click(screen.getByText('groups.createAndAddMember'));

    expect(await screen.findByText('Failed to retrieve created player ID')).toBeInTheDocument();
    expect(addDoubletteMember).not.toHaveBeenCalled();
  });

  it('lets admin manage members from edit action on registered group', async () => {
    adminState.isAdmin = true;
    fetchDoublettes.mockResolvedValue([
      {
        id: 'd-registered',
        name: 'Registered Duo',
        captainPlayerId: 'p-captain',
        isRegistered: true,
        createdAt: new Date().toISOString(),
        memberCount: 2,
        members: [
          { playerId: 'p-captain', firstName: 'Cap', lastName: 'Tain', email: 'cap@example.com', joinedAt: new Date().toISOString() },
          { playerId: 'p-member', firstName: 'Mem', lastName: 'Ber', email: 'mem@example.com', joinedAt: new Date().toISOString() },
        ],
      },
    ]);

    searchGroupPlayers.mockResolvedValue([{ id: 'p3', firstName: 'Ana', lastName: 'D' }]);

    render(<GroupsView mode="doublettes" />);
    await screen.findByText('Registered Duo');

    fireEvent.click(screen.getByText('common.edit'));
    expect(screen.getByPlaceholderText('groups.promptPlayerSearch')).toBeInTheDocument();

    fireEvent.click(screen.getByText('groups.removeMember'));
    await waitFor(() => {
      expect(removeDoubletteMember).toHaveBeenCalledWith('t1', 'd-registered', 'p-member', 'token-1');
    });

    const memberSearchInput = screen.getByPlaceholderText('groups.promptPlayerSearch');
    fireEvent.change(memberSearchInput, { target: { value: 'ana' } });
    const memberSearchToolbar = memberSearchInput.closest('div');
    expect(memberSearchToolbar).toBeTruthy();
    fireEvent.click(within(memberSearchToolbar as HTMLElement).getByText('groups.search'));
    const anaRow = (await screen.findByText('Ana D')).closest('li');
    expect(anaRow).toBeTruthy();
    fireEvent.click(within(anaRow as HTMLElement).getByText('groups.addMember'));

    await waitFor(() => {
      expect(addDoubletteMember).toHaveBeenCalledWith('t1', 'd-registered', { playerId: 'p3' }, 'token-1');
    });
  });

  it('allows admin to unregister a registered doublette', async () => {
    adminState.isAdmin = true;
    fetchDoublettes.mockResolvedValue([
      {
        id: 'd-registered',
        name: 'Registered Duo',
        captainPlayerId: 'p-captain',
        isRegistered: true,
        createdAt: new Date().toISOString(),
        memberCount: 2,
        members: [
          { playerId: 'p-captain', firstName: 'Cap', lastName: 'Tain', email: 'cap@example.com', joinedAt: new Date().toISOString() },
          { playerId: 'p-member', firstName: 'Mem', lastName: 'Ber', email: 'mem@example.com', joinedAt: new Date().toISOString() },
        ],
      },
    ]);

    render(<GroupsView mode="doublettes" />);
    await screen.findByText('Registered Duo');

    fireEvent.click(screen.getByText('tournaments.unregister'));

    await waitFor(() => {
      expect(unregisterDoublette).toHaveBeenCalledWith('t1', 'd-registered', 'token-1');
    });
  });

  it('allows admin to unregister a registered equipe', async () => {
    adminState.isAdmin = true;
    globalThis.history.pushState({}, '', '/?view=equipes&tournamentId=t1');
    fetchEquipes.mockResolvedValue([
      {
        id: 'e-registered',
        name: 'Registered Team',
        captainPlayerId: 'p-captain',
        isRegistered: true,
        createdAt: new Date().toISOString(),
        memberCount: 4,
        members: [
          { playerId: 'p-captain', firstName: 'Cap', lastName: 'Tain', email: 'cap@example.com', joinedAt: new Date().toISOString() },
          { playerId: 'p2', firstName: 'A', lastName: 'B', email: 'a@example.com', joinedAt: new Date().toISOString() },
          { playerId: 'p3', firstName: 'C', lastName: 'D', email: 'c@example.com', joinedAt: new Date().toISOString() },
          { playerId: 'p4', firstName: 'E', lastName: 'F', email: 'e@example.com', joinedAt: new Date().toISOString() },
        ],
      },
    ]);

    render(<GroupsView mode="equipes" />);
    await screen.findByText('Registered Team');

    fireEvent.click(screen.getByText('tournaments.unregister'));

    await waitFor(() => {
      expect(unregisterEquipe).toHaveBeenCalledWith('t1', 'e-registered', 'token-1');
    });
  });

  it('shows load error message when fetch fails', async () => {
    fetchDoublettes.mockRejectedValueOnce(new Error('boom-load'));

    render(<GroupsView mode="doublettes" />);
    expect(await screen.findByText('boom-load')).toBeInTheDocument();
  });

  it('validates quick-create email formats for admin member creation', async () => {
    adminState.isAdmin = true;
    fetchDoublettes.mockResolvedValue([
      {
        id: 'd-email-matrix',
        name: 'Email Matrix Duo',
        captainPlayerId: 'me',
        isRegistered: false,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        members: [
          { playerId: 'me', firstName: 'Me', lastName: 'User', email: 'me@example.com', joinedAt: new Date().toISOString() },
        ],
      },
    ]);

    render(<GroupsView mode="doublettes" />);
    await screen.findByText('Email Matrix Duo');

    fireEvent.click(screen.getByText('groups.addMember'));
    fireEvent.change(screen.getByPlaceholderText('edit.firstName'), { target: { value: 'Nina' } });
    fireEvent.change(screen.getByPlaceholderText('edit.lastName'), { target: { value: 'Ray' } });

    const emailInput = screen.getByPlaceholderText('edit.email');
    const createAndAddButton = screen.getByText('groups.createAndAddMember');

    fireEvent.change(emailInput, { target: { value: 'bad email@example.com' } });
    expect(createAndAddButton).toBeDisabled();

    fireEvent.change(emailInput, { target: { value: 'bad@@example.com' } });
    expect(createAndAddButton).toBeDisabled();

    fireEvent.change(emailInput, { target: { value: 'bad@example' } });
    expect(createAndAddButton).toBeDisabled();

    fireEvent.change(emailInput, { target: { value: 'bad@.example.com' } });
    expect(createAndAddButton).toBeDisabled();

    fireEvent.change(emailInput, { target: { value: 'bad@example..com' } });
    expect(createAndAddButton).toBeDisabled();

    fireEvent.change(emailInput, { target: { value: 'ok@example.com' } });
    expect(createAndAddButton).not.toBeDisabled();
  });

  it('keeps create button hidden for unauthenticated users', async () => {
    authState.isAuthenticated = false;
    fetchDoublettes.mockResolvedValue([]);

    render(<GroupsView mode="doublettes" />);
    await screen.findByText('groups.none');

    expect(screen.queryByText('groups.create')).not.toBeInTheDocument();
  });
});
