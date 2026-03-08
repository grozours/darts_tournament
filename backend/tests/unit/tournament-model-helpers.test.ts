import { describe, expect, it, jest } from '@jest/globals';

const loggerErrorMock = jest.fn();

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    error: loggerErrorMock,
  },
}));

import {
  getPrismaErrorCode,
  logModelError,
  mapToPlayer,
} from '../../src/models/tournament-model/helpers';
import { SkillLevel } from '../../../shared/src/types';

describe('tournament model helpers', () => {
  it('extracts prisma error code when present', () => {
    expect(getPrismaErrorCode({ code: 'P2002' })).toBe('P2002');
    expect(getPrismaErrorCode({ code: 42 })).toBeUndefined();
    expect(getPrismaErrorCode(null)).toBeUndefined();
  });

  it('maps player skillLevel and optional fields', () => {
    const mapped = mapToPlayer({
      id: 'p1',
      tournamentId: 't1',
      personId: null,
      firstName: 'Ana',
      lastName: 'Diaz',
      surname: null,
      teamName: null,
      email: 'ana@example.com',
      phone: null,
      skillLevel: SkillLevel.INTERMEDIATE,
      registeredAt: new Date('2026-01-01T00:00:00.000Z'),
      isActive: true,
      checkedIn: false,
    } as never);

    expect(mapped.skillLevel).toBe(SkillLevel.INTERMEDIATE);
    expect(mapped.email).toBe('ana@example.com');
  });

  it('logs fallback message when error payload cannot be stringified', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    logModelError('ctx', circular);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'TournamentModel error: ctx',
      expect.objectContaining({
        metadata: expect.objectContaining({
          errorMessage: 'Unserializable error payload',
          errorName: 'UnknownError',
        }),
      })
    );
  });
});
