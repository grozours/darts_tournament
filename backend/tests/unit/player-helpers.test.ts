import { describe, expect, it, jest } from '@jest/globals';
import { AppError } from '../../src/middleware/error-handler';
import {
  buildPlayerPayload,
  buildPlayerUpdate,
  ensureTournamentAllowsPlayerUpdate,
  ensureUniquePlayerAttributes,
  ensureUniqueSurname,
  ensureUniqueTeamName,
  isSafeEmailFormat,
  resolvePersonId,
  updateLinkedPerson,
  validatePlayerData,
} from '../../src/services/tournament-service/player-helpers';
import { TournamentFormat, TournamentStatus } from '../../../shared/src/types';

const buildContext = () => {
  const tournamentModel = {
    findPlayerBySurname: jest.fn() as any,
    findPlayerByTeamName: jest.fn() as any,
    findPersonByEmailAndPhone: jest.fn() as any,
    createPerson: jest.fn() as any,
    updatePerson: jest.fn() as any,
  };

  return {
    tournamentModel,
    logger: {} as never,
  } as const;
};

describe('player-helpers', () => {
  it('validates email safety format across invalid and valid patterns', () => {
    expect(isSafeEmailFormat('')).toBe(false);
    expect(isSafeEmailFormat('bad address@example.com')).toBe(false);
    expect(isSafeEmailFormat(`${'a'.repeat(255)}@example.com`)).toBe(false);
    expect(isSafeEmailFormat('@example.com')).toBe(false);
    expect(isSafeEmailFormat('a@@example.com')).toBe(false);
    expect(isSafeEmailFormat('alice@example')).toBe(false);
    expect(isSafeEmailFormat('alice@.example.com')).toBe(false);
    expect(isSafeEmailFormat('alice@example.com.')).toBe(false);
    expect(isSafeEmailFormat('alice@example.com')).toBe(true);
  });

  it('validates player data and throws expected AppError codes', () => {
    expect(() => validatePlayerData({ firstName: 'A', lastName: 'Doe' } as never)).toThrow(AppError);
    expect(() => validatePlayerData({ firstName: 'Alice', lastName: 'D' } as never)).toThrow(AppError);
    expect(() => validatePlayerData({ firstName: 'Alice', lastName: 'Doe', surname: 'x'.repeat(51) } as never)).toThrow(AppError);
    expect(() => validatePlayerData({ firstName: 'Alice', lastName: 'Doe', teamName: 'x'.repeat(101) } as never)).toThrow(AppError);
    expect(() => validatePlayerData({ firstName: 'Alice', lastName: 'Doe', email: 'invalid' } as never)).toThrow(AppError);

    expect(() => validatePlayerData({
      firstName: 'Alice',
      lastName: 'Doe',
      surname: 'Alias',
      teamName: 'Team A',
      email: 'alice@example.com',
    } as never)).not.toThrow();
  });

  it('enforces unique surname and team name, with blank fast-paths', async () => {
    const context = buildContext();

    await ensureUniqueSurname(context as never, 't1', '   ');
    await ensureUniqueTeamName(context as never, 't1', '   ');
    expect(context.tournamentModel.findPlayerBySurname).not.toHaveBeenCalled();
    expect(context.tournamentModel.findPlayerByTeamName).not.toHaveBeenCalled();

    context.tournamentModel.findPlayerBySurname.mockResolvedValueOnce({ id: 'p1' });
    await expect(ensureUniqueSurname(context as never, 't1', 'Alias', 'p2')).rejects.toMatchObject({ code: 'DUPLICATE_SURNAME' });

    context.tournamentModel.findPlayerByTeamName.mockResolvedValueOnce({ id: 'p1' });
    await expect(ensureUniqueTeamName(context as never, 't1', 'Team', 'p2')).rejects.toMatchObject({ code: 'DUPLICATE_TEAM_NAME' });

    context.tournamentModel.findPlayerBySurname.mockResolvedValueOnce(undefined);
    context.tournamentModel.findPlayerByTeamName.mockResolvedValueOnce(undefined);
    await expect(ensureUniqueSurname(context as never, 't1', 'Alias', 'p2')).resolves.toBeUndefined();
    await expect(ensureUniqueTeamName(context as never, 't1', 'Team', 'p2')).resolves.toBeUndefined();
  });

  it('builds player payload with trimmed optional fields and resolved personId', async () => {
    const context = buildContext();
    context.tournamentModel.findPersonByEmailAndPhone.mockResolvedValueOnce(undefined);
    context.tournamentModel.createPerson.mockResolvedValueOnce({ id: 'person-1' });

    const payload = await buildPlayerPayload(context as never, {
      firstName: '  Alice  ',
      lastName: '  Doe ',
      surname: '  Alias ',
      teamName: ' Team A ',
      email: ' alice@example.com ',
      phone: ' 0123 ',
      skillLevel: 'BEGINNER',
    } as never);

    expect(payload).toEqual(expect.objectContaining({
      personId: 'person-1',
      firstName: 'Alice',
      lastName: 'Doe',
      surname: 'Alias',
      teamName: 'Team A',
      email: 'alice@example.com',
      phone: '0123',
      skillLevel: 'BEGINNER',
    }));
  });

  it('resolves existing person id when both email and phone are present; otherwise creates person', async () => {
    const context = buildContext();

    context.tournamentModel.findPersonByEmailAndPhone.mockResolvedValueOnce({ id: 'person-existing' });
    await expect(resolvePersonId(context as never, 'Alice', 'Doe', ' alice@example.com ', ' 0123 ')).resolves.toBe('person-existing');

    context.tournamentModel.findPersonByEmailAndPhone.mockResolvedValueOnce(undefined);
    context.tournamentModel.createPerson.mockResolvedValueOnce({ id: 'person-created' });
    await expect(resolvePersonId(context as never, 'Alice', 'Doe', ' alice@example.com ', ' 0123 ')).resolves.toBe('person-created');

    context.tournamentModel.createPerson.mockResolvedValueOnce({ id: 'person-created-2' });
    await expect(resolvePersonId(context as never, 'Alice', 'Doe', undefined, ' 0123 ')).resolves.toBe('person-created-2');
  });

  it('validates tournament update status, updates linked person and unique attribute rules', async () => {
    const context = buildContext();

    expect(() => ensureTournamentAllowsPlayerUpdate({ status: TournamentStatus.FINISHED } as never)).toThrow(AppError);
    expect(() => ensureTournamentAllowsPlayerUpdate({ status: TournamentStatus.LIVE } as never)).not.toThrow();

    await updateLinkedPerson(context as never, 'person-1', {
      firstName: ' Alice ',
      lastName: ' Doe ',
      email: ' ',
      phone: ' 0123 ',
    } as never);
    expect(context.tournamentModel.updatePerson).toHaveBeenCalledWith('person-1', {
      firstName: 'Alice',
      lastName: 'Doe',
      phone: '0123',
    });

    context.tournamentModel.findPlayerBySurname.mockResolvedValue(undefined);
    context.tournamentModel.findPlayerByTeamName.mockResolvedValue(undefined);

    await ensureUniquePlayerAttributes(
      context as never,
      { format: TournamentFormat.SINGLE } as never,
      't1',
      { surname: ' Alias ', teamName: ' Team A ' } as never,
      'p1'
    );
    expect(context.tournamentModel.findPlayerBySurname).toHaveBeenCalled();
    expect(context.tournamentModel.findPlayerByTeamName).not.toHaveBeenCalled();

    await ensureUniquePlayerAttributes(
      context as never,
      { format: TournamentFormat.DOUBLE } as never,
      't1',
      { teamName: ' Team A ' } as never,
      'p1'
    );
    expect(context.tournamentModel.findPlayerByTeamName).toHaveBeenCalled();
  });

  it('builds player update payload with and without optional fields', () => {
    expect(buildPlayerUpdate({ firstName: ' A ', lastName: ' B ' } as never)).toEqual({
      firstName: 'A',
      lastName: 'B',
    });

    expect(buildPlayerUpdate({
      firstName: ' A ',
      lastName: ' B ',
      surname: ' S ',
      teamName: ' T ',
      email: ' e@x.com ',
      phone: ' 123 ',
      skillLevel: 'ADVANCED',
    } as never, 'person-1')).toEqual(expect.objectContaining({
      personId: 'person-1',
      firstName: 'A',
      lastName: 'B',
      surname: 'S',
      teamName: 'T',
      email: 'e@x.com',
      phone: '123',
      skillLevel: 'ADVANCED',
    }));
  });
});
