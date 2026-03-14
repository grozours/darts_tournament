import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { config } from '../../src/config/environment';
import { ensureAdminPersonsExist } from '../../src/services/admin-account-bootstrap';

type PersonRecord = { id: string; email: string | null };
type FindManyFn = (query: {
  where: { email: { in: string[] } };
  select: { id: true; email: true };
}) => Promise<PersonRecord[]>;
type CreateFn = (payload: {
  data: { firstName: string; lastName: string; email: string };
  select: { id: true; email: true };
}) => Promise<PersonRecord>;
type DisconnectFn = () => Promise<void>;

const findManyMock = jest.fn<FindManyFn>();
const createMock = jest.fn<CreateFn>();
const disconnectMock = jest.fn<DisconnectFn>();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    person: {
      findMany: (...callArguments: Parameters<FindManyFn>) => findManyMock(...callArguments),
      create: (...callArguments: Parameters<CreateFn>) => createMock(...callArguments),
    },
    $disconnect: (...callArguments: Parameters<DisconnectFn>) => disconnectMock(...callArguments),
  })),
}));

describe('ensureAdminPersonsExist', () => {
  const originalAdminEmails = [...config.auth.adminEmails];

  beforeEach(() => {
    config.auth.adminEmails = [...originalAdminEmails];
    findManyMock.mockReset();
    createMock.mockReset();
    disconnectMock.mockReset();
    findManyMock.mockResolvedValue([]);
    createMock.mockResolvedValue({ id: 'person-1', email: 'admin@example.com' });
    disconnectMock.mockImplementation(async () => {});
  });

  afterAll(() => {
    config.auth.adminEmails = originalAdminEmails;
  });

  it('returns early when no valid admin email is configured', async () => {
    config.auth.adminEmails = ['', 'invalid-email'];

    const result = await ensureAdminPersonsExist();

    expect(result).toEqual({
      configuredAdminEmails: 0,
      created: 0,
      alreadyExisting: 0,
      skippedInvalid: 2,
    });
    expect(findManyMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it('creates missing admin persons and skips already existing ones', async () => {
    config.auth.adminEmails = [
      'Admin.One@example.com',
      'existing@example.com',
      'admin.one@example.com',
      'bad',
    ];

    findManyMock.mockResolvedValue([
      {
        id: 'person-existing',
        email: 'existing@example.com',
      },
    ]);

    const result = await ensureAdminPersonsExist();

    expect(findManyMock).toHaveBeenCalledWith({
      where: { email: { in: ['admin.one@example.com', 'existing@example.com'] } },
      select: { id: true, email: true },
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        firstName: 'Admin',
        lastName: 'One',
        email: 'admin.one@example.com',
      },
      select: { id: true, email: true },
    });
    expect(result).toEqual({
      configuredAdminEmails: 2,
      created: 1,
      alreadyExisting: 1,
      skippedInvalid: 1,
    });
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it('ignores unique conflicts while creating missing accounts', async () => {
    config.auth.adminEmails = ['new-admin@example.com'];
    createMock.mockRejectedValue({ code: 'P2002' });

    const result = await ensureAdminPersonsExist();

    expect(result).toEqual({
      configuredAdminEmails: 1,
      created: 0,
      alreadyExisting: 1,
      skippedInvalid: 0,
    });
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it('works with an injected prisma instance', async () => {
    config.auth.adminEmails = ['john.doe@example.com'];

    const injectedPrisma = {
      person: {
        findMany: jest.fn<FindManyFn>().mockResolvedValue([]),
        create: jest.fn<CreateFn>().mockResolvedValue({ id: 'person-1', email: 'john.doe@example.com' }),
      },
      $disconnect: jest.fn<DisconnectFn>().mockImplementation(async () => {}),
    };

    const result = await ensureAdminPersonsExist(injectedPrisma);

    expect(result).toEqual({
      configuredAdminEmails: 1,
      created: 1,
      alreadyExisting: 0,
      skippedInvalid: 0,
    });
    expect(injectedPrisma.$disconnect).not.toHaveBeenCalled();
    expect(disconnectMock).not.toHaveBeenCalled();
  });
});
