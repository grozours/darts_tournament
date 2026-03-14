import { PrismaClient } from '@prisma/client';
import { config } from '../config/environment';
import logger from '../utils/logger';

type PersonRecord = {
  id: string;
  email: string | null;
};

type PersonRepository = {
  findMany: (query: {
    where: { email: { in: string[] } };
    select: { id: true; email: true };
  }) => Promise<PersonRecord[]>;
  create: (payload: {
    data: {
      firstName: string;
      lastName: string;
      email: string;
    };
    select: { id: true; email: true };
  }) => Promise<PersonRecord>;
};

type AdminBootstrapPrisma = {
  person: PersonRepository;
  $disconnect?: () => Promise<void>;
};

export type AdminBootstrapResult = {
  configuredAdminEmails: number;
  created: number;
  alreadyExisting: number;
  skippedInvalid: number;
};

const normalizeAdminEmails = (emails: string[]): { valid: string[]; skippedInvalid: number } => {
  const unique = new Set<string>();
  let skippedInvalid = 0;

  for (const rawEmail of emails) {
    const normalized = rawEmail.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      skippedInvalid += 1;
      continue;
    }
    unique.add(normalized);
  }

  return {
    valid: [...unique],
    skippedInvalid,
  };
};

const toTitleCase = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }

  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
};

const deriveNamesFromEmail = (email: string): { firstName: string; lastName: string } => {
  const localPart = email.split('@')[0] ?? '';
  const cleaned = localPart.replaceAll(/[._-]+/g, ' ').trim();
  const [firstRaw, ...lastParts] = cleaned.split(/\s+/).filter(Boolean);

  const firstName = toTitleCase(firstRaw ?? '') || 'Admin';
  const lastName = toTitleCase(lastParts.join(' ')) || 'User';

  return {
    firstName: firstName.slice(0, 50),
    lastName: lastName.slice(0, 50),
  };
};

const isUniqueConflict = (error: unknown): boolean => {
  const code = typeof error === 'object' && error !== null
    ? (error as { code?: string }).code
    : undefined;
  return code === 'P2002';
};

export const ensureAdminPersonsExist = async (prismaInstance?: AdminBootstrapPrisma): Promise<AdminBootstrapResult> => {
  const ownsPrisma = !prismaInstance;
  const prisma = prismaInstance ?? new PrismaClient({
    datasources: {
      db: {
        url: config.database.prismaUrl,
      },
    },
  });

  const { valid: adminEmails, skippedInvalid } = normalizeAdminEmails(config.auth.adminEmails);
  if (adminEmails.length === 0) {
    if (ownsPrisma) {
      await prisma.$disconnect?.();
    }
    return {
      configuredAdminEmails: 0,
      created: 0,
      alreadyExisting: 0,
      skippedInvalid,
    };
  }

  try {
    const existing = await prisma.person.findMany({
      where: { email: { in: adminEmails } },
      select: { id: true, email: true },
    });

    const existingEmails = new Set(
      existing
        .map((person) => person.email?.trim().toLowerCase() ?? '')
        .filter(Boolean)
    );

    let created = 0;
    for (const email of adminEmails) {
      if (existingEmails.has(email)) {
        continue;
      }

      const names = deriveNamesFromEmail(email);
      try {
        await prisma.person.create({
          data: {
            firstName: names.firstName,
            lastName: names.lastName,
            email,
          },
          select: { id: true, email: true },
        });
        created += 1;
      } catch (error) {
        if (isUniqueConflict(error)) {
          continue;
        }
        throw error;
      }
    }

    const result = {
      configuredAdminEmails: adminEmails.length,
      created,
      alreadyExisting: adminEmails.length - created,
      skippedInvalid,
    };

    logger.info('Admin account bootstrap completed', {
      metadata: result,
    });

    return result;
  } finally {
    if (ownsPrisma) {
      await prisma.$disconnect?.();
    }
  }
};
