import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  DEVELOPMENT_AUTOLOGIN_COOKIE_NAME,
  DEVELOPMENT_AUTOLOGIN_MODES,
  getActiveDevelopmentAutologinMode,
  isAdmin,
  parseDevelopmentAutologinMode,
  requireAuth,
  resolveUserEmailFromPayload,
} from '../middleware/auth';
import { config } from '../config/environment';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.database.prismaUrl,
    },
  },
});

const normalizeDisplayName = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeNamePart = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 50) {
    return undefined;
  }
  return trimmed;
};

const resolvePersonNameFromPayload = (
  payload: Record<string, unknown>,
  email: string
): { firstName: string; lastName: string } => {
  const displayName = normalizeDisplayName(payload.name);
  if (displayName) {
    const [firstNameCandidate, ...lastNameParts] = displayName.split(/\s+/).filter(Boolean);
    const firstName = firstNameCandidate ?? 'Authenticated';
    const lastName = lastNameParts.join(' ').trim() || 'User';
    return { firstName, lastName };
  }

  const localPart = (email.split('@')[0] ?? 'authenticated.user').replaceAll(/[._-]+/g, ' ').trim();
  const [firstNameCandidate, ...lastNameParts] = localPart.split(/\s+/).filter(Boolean);
  const firstName = firstNameCandidate ?? 'Authenticated';
  const lastName = lastNameParts.join(' ').trim() || 'User';
  return { firstName, lastName };
};

const ensurePersonForAuthenticatedUser = async (
  payload: Record<string, unknown>,
  email: string,
  correlationId: string | undefined
) => {
  const existingPerson = await prisma.person.findFirst({
    where: { email },
    select: { id: true, firstName: true, lastName: true, surname: true, email: true },
  });

  if (existingPerson) {
    return existingPerson;
  }

  const { firstName, lastName } = resolvePersonNameFromPayload(payload, email);
  const createdPerson = await prisma.person.create({
    data: {
      firstName,
      lastName,
      email,
    },
    select: { id: true, firstName: true, lastName: true, surname: true, email: true },
  });

  logger.info('Created Person record from authenticated user', {
    correlationId,
    metadata: {
      email,
    },
  });

  return createdPerson;
};

const buildDisplayName = (person: { firstName: string; lastName: string; surname: string | null }) => {
  const base = `${person.firstName} ${person.lastName}`.trim();
  if (person.surname) {
    return `${base} (${person.surname})`;
  }
  return base;
};

const resolveSearchQuery = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 100) : undefined;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const resolveTournamentFilterId = (value: unknown): { tournamentId?: string; errorMessage?: string } => {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== 'string') {
    return { errorMessage: 'Invalid tournamentId' };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  if (!UUID_PATTERN.test(trimmed)) {
    return { errorMessage: 'Invalid tournamentId' };
  }

  return { tournamentId: trimmed };
};

const resolveOptionalEmail = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  if (!trimmed.includes('@') || trimmed.length > 255) {
    return undefined;
  }
  return trimmed;
};

const hasAdminAccess = (request: Request): boolean => {
  const payload = request.auth?.payload;
  if (!payload) {
    return false;
  }
  return isAdmin(request);
};

const ADMIN_EMAILS_SET = new Set(config.auth.adminEmails.map((email) => email.toLowerCase()));

const isAdminEmail = (email: string | null): boolean => {
  if (!email) {
    return false;
  }
  return ADMIN_EMAILS_SET.has(email.trim().toLowerCase());
};

type AdminAccountUpdatePayload = {
  firstName?: string;
  lastName?: string;
  surname?: string;
  email?: string | null;
  skillLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT' | null;
};

const applyNormalizedNameField = (
  updates: AdminAccountUpdatePayload,
  body: Record<string, unknown>,
  field: 'firstName' | 'lastName'
): string | undefined => {
  if (body[field] === undefined) {
    return undefined;
  }

  const normalized = normalizeNamePart(body[field]);
  if (!normalized) {
    return `Invalid ${field}`;
  }

  updates[field] = normalized;
  return undefined;
};

const applySurnameField = (
  updates: AdminAccountUpdatePayload,
  body: Record<string, unknown>
): string | undefined => {
  if (body.surname === undefined) {
    return undefined;
  }

  if (typeof body.surname !== 'string') {
    return 'Invalid surname';
  }

  updates.surname = body.surname.trim().slice(0, 50);
  return undefined;
};

const applyEmailField = (
  updates: AdminAccountUpdatePayload,
  body: Record<string, unknown>
): string | undefined => {
  if (body.email === undefined) {
    return undefined;
  }

  const email = resolveOptionalEmail(body.email);
  if (email === undefined) {
    return 'Invalid email';
  }

  if (email !== '') {
    updates.email = email;
  }

  return undefined;
};

const applySkillLevelField = (
  updates: AdminAccountUpdatePayload,
  body: Record<string, unknown>
): string | undefined => {
  if (body.skillLevel === undefined) {
    return undefined;
  }

  const skillLevel = parseOptionalSkillLevel(body.skillLevel);
  if (skillLevel === undefined) {
    return 'Invalid skillLevel';
  }

  updates.skillLevel = skillLevel;
  return undefined;
};

const parseOptionalSkillLevel = (value: unknown): 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT' | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (
    normalized === 'BEGINNER'
    || normalized === 'INTERMEDIATE'
    || normalized === 'EXPERT'
  ) {
    return normalized;
  }

  return undefined;
};

const parseAdminAccountUpdatePayload = (
  body: Record<string, unknown>
): { updates?: AdminAccountUpdatePayload; errorMessage?: string } => {
  const updates: AdminAccountUpdatePayload = {};

  const fieldError =
    applyNormalizedNameField(updates, body, 'firstName')
    || applyNormalizedNameField(updates, body, 'lastName')
    || applySurnameField(updates, body)
    || applyEmailField(updates, body)
    || applySkillLevelField(updates, body);

  if (fieldError) {
    return { errorMessage: fieldError };
  }

  if (Object.keys(updates).length === 0) {
    return { errorMessage: 'No updatable fields provided' };
  }

  return { updates };
};

const handleAdminAccountUpdateError = (
  request: Request,
  response: Response,
  userId: string,
  error: unknown
): void => {
  const code = typeof error === 'object' && error !== null
    ? (error as { code?: string }).code
    : undefined;

  if (code === 'P2025') {
    response.status(404).json({ error: 'Not Found', message: 'User account not found' });
    return;
  }

  if (code === 'P2002') {
    response.status(409).json({ error: 'Conflict', message: 'Email is already used by another account' });
    return;
  }

  logger.error('Failed to update user account', {
    correlationId: request.correlationId,
    metadata: {
      userId,
      errorMessage: error instanceof Error ? error.message : String(error),
    },
  });
  response.status(500).json({ error: 'Internal Server Error' });
};

const isLocalDevelopmentRequest = (request: Request): boolean => {
  const host = request.hostname?.toLowerCase();
  return config.isDevelopment && (host === 'localhost' || host === '127.0.0.1' || host === '::1');
};

router.get('/dev-autologin', (request: Request, response: Response): void => {
  if (!isLocalDevelopmentRequest(request) || !config.auth.enabled) {
    response.status(404).json({ error: 'Not Found' });
    return;
  }

  response.json({
    mode: getActiveDevelopmentAutologinMode(request) ?? 'anonymous',
    availableModes: DEVELOPMENT_AUTOLOGIN_MODES,
  });
});

router.post('/dev-autologin', (request: Request, response: Response): void => {
  if (!isLocalDevelopmentRequest(request) || !config.auth.enabled) {
    response.status(404).json({ error: 'Not Found' });
    return;
  }

  const mode = parseDevelopmentAutologinMode(request.body?.mode);
  if (!mode) {
    response.status(400).json({
      error: 'Bad Request',
      message: `Mode must be one of: ${DEVELOPMENT_AUTOLOGIN_MODES.join(', ')}`,
    });
    return;
  }

  response.cookie(DEVELOPMENT_AUTOLOGIN_COOKIE_NAME, mode, {
    sameSite: 'lax',
    secure: false,
    httpOnly: false,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  response.json({ mode });
});

// Get current user info and admin status
router.get('/me', requireAuth, async (request: Request, response: Response): Promise<void> => {
  const userPayload = request.auth?.payload;

  if (!userPayload) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const email = resolveUserEmailFromPayload(userPayload);

  let person:
    | {
      id: string;
      firstName: string;
      lastName: string;
      surname: string | null;
      email: string | null;
    }
    | undefined;

  if (email) {
    try {
      person = await ensurePersonForAuthenticatedUser(userPayload, email, request.correlationId);
    } catch (error) {
      logger.error('Failed to ensure Person for authenticated user', {
        correlationId: request.correlationId,
        metadata: {
          email,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      response.status(500).json({ error: 'Internal Server Error' });
      return;
    }
  }

  let effectiveName: string | undefined;
  if (person?.firstName && person.lastName) {
    effectiveName = buildDisplayName(person);
  } else if (typeof userPayload.name === 'string') {
    effectiveName = userPayload.name;
  }

  response.json({
    user: {
      id: userPayload.sub,
      email,
      name: effectiveName,
      picture: userPayload.picture,
      ...(person ? {
        firstName: person.firstName,
        lastName: person.lastName,
        ...(person.surname ? { surname: person.surname } : {}),
      } : {}),
    },
    isAdmin: isAdmin(request),
  });
});

router.patch('/me/profile', requireAuth, async (request: Request, response: Response): Promise<void> => {
  const userPayload = request.auth?.payload;
  if (!userPayload) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const email = resolveUserEmailFromPayload(userPayload);
  if (!email) {
    response.status(400).json({ error: 'Bad Request', message: 'Authenticated user email is required' });
    return;
  }

  const firstName = normalizeNamePart(request.body?.firstName);
  const lastName = normalizeNamePart(request.body?.lastName);
  const surnameInput = request.body?.surname;
  const surname = typeof surnameInput === 'string'
    ? surnameInput.trim().slice(0, 50)
    : undefined;

  if (!firstName || !lastName) {
    response.status(400).json({
      error: 'Bad Request',
      message: 'firstName and lastName must be between 2 and 50 characters',
    });
    return;
  }

  try {
    const person = await ensurePersonForAuthenticatedUser(userPayload, email, request.correlationId);
    const updated = await prisma.person.update({
      where: { id: person.id },
      data: {
        firstName,
        lastName,
        ...(surname === undefined ? {} : { surname }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        surname: true,
        email: true,
      },
    });

    response.json({
      user: {
        id: userPayload.sub,
        email,
        name: buildDisplayName(updated),
        picture: userPayload.picture,
        firstName: updated.firstName,
        lastName: updated.lastName,
        ...(updated.surname ? { surname: updated.surname } : {}),
      },
      isAdmin: isAdmin(request),
    });
  } catch (error) {
    logger.error('Failed to update authenticated Person profile', {
      correlationId: request.correlationId,
      metadata: {
        email,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    response.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/users', requireAuth, async (request: Request, response: Response): Promise<void> => {
  if (!request.auth?.payload) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!hasAdminAccess(request)) {
    response.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    return;
  }

  const query = resolveSearchQuery(request.query?.q);
  const parsedTournamentFilter = resolveTournamentFilterId(request.query?.tournamentId);
  if (parsedTournamentFilter.errorMessage) {
    response.status(400).json({ error: 'Bad Request', message: parsedTournamentFilter.errorMessage });
    return;
  }
  const tournamentId = parsedTournamentFilter.tournamentId;
  const limitCandidate = Number(request.query?.limit);
  const limit = Number.isFinite(limitCandidate)
    ? Math.min(Math.max(Math.trunc(limitCandidate), 1), 200)
    : 100;

  try {
    const users = await prisma.person.findMany({
      ...(query
        || tournamentId
        ? {
          where: {
            ...(query
              ? {
                OR: [
                  { firstName: { contains: query, mode: 'insensitive' } },
                  { lastName: { contains: query, mode: 'insensitive' } },
                  { surname: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                ],
              }
              : {}),
            ...(tournamentId
              ? {
                players: {
                  some: {
                    tournamentId,
                    isActive: true,
                  },
                },
              }
              : {}),
          },
        }
        : {}),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        surname: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        players: {
          where: {
            isActive: true,
          },
          select: {
            skillLevel: true,
          },
          orderBy: {
            registeredAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    const personIds = users.map((user) => user.id);
    const tournamentLinks = personIds.length > 0
      ? await prisma.player.findMany({
        where: {
          personId: { in: personIds },
          isActive: true,
          tournamentId: { not: null },
        },
        select: {
          personId: true,
          tournamentId: true,
        },
        distinct: ['personId', 'tournamentId'],
      })
      : [];

    const activePlayerLinks = personIds.length > 0
      ? await prisma.player.findMany({
        where: {
          personId: { in: personIds },
          isActive: true,
        },
        select: {
          personId: true,
        },
        distinct: ['personId'],
      })
      : [];

    const activePlayersByPersonId = new Set(
      activePlayerLinks
        .map((link) => link.personId)
        .filter((personId): personId is string => Boolean(personId))
    );

    const tournamentCountByPersonId = tournamentLinks.reduce<Map<string, number>>((accumulator, link) => {
      if (!link.personId || !link.tournamentId) {
        return accumulator;
      }

      const current = accumulator.get(link.personId) ?? 0;
      accumulator.set(link.personId, current + 1);
      return accumulator;
    }, new Map());

    response.json({
      users: users.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        surname: user.surname,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        skillLevel: user.players?.[0]?.skillLevel ?? null,
        tournamentCount: tournamentCountByPersonId.get(user.id) ?? 0,
        isAdminAccount: isAdminEmail(user.email),
        activePlayerCount: activePlayersByPersonId.has(user.id) ? 1 : 0,
        canDelete: !isAdminEmail(user.email) && !activePlayersByPersonId.has(user.id),
      })),
    });
  } catch (error) {
    logger.error('Failed to list user accounts', {
      correlationId: request.correlationId,
      metadata: {
        query,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    response.status(500).json({ error: 'Internal Server Error' });
  }
});

router.patch('/users/:id', requireAuth, async (request: Request, response: Response): Promise<void> => {
  const userId = request.params.id ?? '';
  if (!request.auth?.payload) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!hasAdminAccess(request)) {
    response.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    return;
  }

  const parsedUpdate = parseAdminAccountUpdatePayload(
    typeof request.body === 'object' && request.body !== null
      ? request.body as Record<string, unknown>
      : {}
  );

  if (parsedUpdate.errorMessage) {
    response.status(400).json({ error: 'Bad Request', message: parsedUpdate.errorMessage });
    return;
  }

  const { updates } = parsedUpdate;
  if (!updates) {
    response.status(400).json({ error: 'Bad Request', message: 'No updatable fields provided' });
    return;
  }

  try {
    const { skillLevel, ...personUpdates } = updates;
    const updated = await prisma.person.update({
      where: { id: userId },
      data: personUpdates,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        surname: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let resolvedSkillLevel: string | null = null;
    if (skillLevel !== undefined) {
      await prisma.player.updateMany({
        where: {
          personId: userId,
          isActive: true,
        },
        data: {
          skillLevel,
        },
      });
      resolvedSkillLevel = skillLevel;
    } else {
      const latestPlayer = await prisma.player.findFirst({
        where: {
          personId: userId,
          isActive: true,
        },
        select: {
          skillLevel: true,
        },
        orderBy: {
          registeredAt: 'desc',
        },
      });
      resolvedSkillLevel = latestPlayer?.skillLevel ?? null;
    }

    response.json({ user: { ...updated, skillLevel: resolvedSkillLevel } });
  } catch (error) {
    handleAdminAccountUpdateError(request, response, userId, error);
  }
});

router.delete('/users', requireAuth, async (request: Request, response: Response): Promise<void> => {
  if (!request.auth?.payload) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!hasAdminAccess(request)) {
    response.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    return;
  }

  const scope = typeof request.query?.scope === 'string' ? request.query.scope.trim() : '';
  if (scope !== 'without-tournament') {
    response.status(400).json({
      error: 'Bad Request',
      message: 'Invalid scope. Use scope=without-tournament',
    });
    return;
  }

  try {
    const candidates = await prisma.person.findMany({
      where: {
        players: {
          none: {
            tournamentId: { not: null },
          },
        },
      },
      select: {
        id: true,
        email: true,
      },
    });

    const deletableIds = candidates
      .filter((candidate) => !isAdminEmail(candidate.email))
      .map((candidate) => candidate.id);

    if (deletableIds.length === 0) {
      response.json({ deletedCount: 0 });
      return;
    }

    const deletionResult = await prisma.person.deleteMany({
      where: {
        id: {
          in: deletableIds,
        },
      },
    });

    response.json({ deletedCount: deletionResult.count });
  } catch (error) {
    logger.error('Failed to bulk delete user accounts without tournaments', {
      correlationId: request.correlationId,
      metadata: {
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    response.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/users/:id', requireAuth, async (request: Request, response: Response): Promise<void> => {
  const userId = request.params.id ?? '';
  if (!request.auth?.payload) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!hasAdminAccess(request)) {
    response.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    return;
  }

  try {
    const person = await prisma.person.findFirst({
      where: { id: userId },
      select: {
        id: true,
        email: true,
      },
    });

    if (!person) {
      response.status(404).json({ error: 'Not Found', message: 'User account not found' });
      return;
    }

    if (isAdminEmail(person.email)) {
      response.status(403).json({ error: 'Forbidden', message: 'Cannot delete admin account' });
      return;
    }

    const activePlayersCount = await prisma.player.count({
      where: {
        personId: userId,
        isActive: true,
      },
    });

    if (activePlayersCount > 0) {
      response.status(409).json({
        error: 'Conflict',
        message: 'Cannot delete account linked to active player registrations',
      });
      return;
    }

    await prisma.person.delete({ where: { id: userId } });
    response.status(204).send();
  } catch (error) {
    logger.error('Failed to delete user account', {
      correlationId: request.correlationId,
      metadata: {
        userId,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    response.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
