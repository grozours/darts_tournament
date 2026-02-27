import type { Prisma, Tournament as PrismaTournament, Player as PrismaPlayer } from '@prisma/client';
import {
  Tournament,
  TournamentFormat,
  DurationType,
  TournamentStatus,
  Player,
  SkillLevel,
} from '../../../../shared/src/types';
import logger from '../../utils/logger';

type PrismaError = { code?: string; meta?: { target?: unknown } };

export const getPrismaErrorCode = (error: unknown): string | undefined => {
  const code = (error as PrismaError)?.code;
  return typeof code === 'string' ? code : undefined;
};

export const logModelError = (context: string, error: unknown) => {
  logger.error(`TournamentModel error: ${context}`, {
    metadata: {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'UnknownError',
    },
  });
};

export const liveViewArguments = {
  include: {
    players: {
      orderBy: { registeredAt: 'asc' },
    },
    targets: {
      orderBy: { targetNumber: 'asc' },
    },
    poolStages: {
      orderBy: { stageNumber: 'asc' },
      include: {
        pools: {
          orderBy: { poolNumber: 'asc' },
          include: {
            assignments: {
              orderBy: { assignedAt: 'asc' },
              include: { player: true },
            },
            matches: {
              orderBy: { matchNumber: 'asc' },
              include: {
                playerMatches: { include: { player: true } },
                winner: true,
                target: true,
              },
            },
          },
        },
      },
    },
    brackets: {
      orderBy: { createdAt: 'asc' },
      include: {
        bracketTargets: {
          select: { targetId: true },
        },
        entries: {
          orderBy: { seedNumber: 'asc' },
          include: { player: true },
        },
        matches: {
          orderBy: { matchNumber: 'asc' },
          include: {
            playerMatches: { include: { player: true } },
            winner: true,
            target: true,
          },
        },
      },
    },
  },
} as const;

export type TournamentLiveView = Prisma.TournamentGetPayload<typeof liveViewArguments>;

export const mapToTournament = (
  prismaResult: PrismaTournament & { players?: unknown; targets?: unknown; matches?: unknown }
): Tournament => {
  return {
    id: prismaResult.id,
    name: prismaResult.name,
    ...(prismaResult.location ? { location: prismaResult.location } : {}),
    format: prismaResult.format as TournamentFormat,
    durationType: prismaResult.durationType as DurationType,
    status: prismaResult.status as TournamentStatus,
    startTime: prismaResult.startTime,
    endTime: prismaResult.endTime,
    totalParticipants: prismaResult.totalParticipants,
    targetCount: prismaResult.targetCount,
    targetStartNumber: prismaResult.targetStartNumber ?? 1,
    shareTargets: prismaResult.shareTargets ?? true,
    ...(prismaResult.logoUrl ? { logoUrl: prismaResult.logoUrl } : {}),
    createdAt: prismaResult.createdAt,
    ...(prismaResult.completedAt ? { completedAt: prismaResult.completedAt } : {}),
    historicalFlag: prismaResult.historicalFlag || false,
    doubleStageEnabled: prismaResult.doubleStageEnabled ?? false,
    ...(prismaResult.players ? { players: prismaResult.players } : {}),
    ...(prismaResult.targets ? { targets: prismaResult.targets } : {}),
    ...(prismaResult.matches ? { matches: prismaResult.matches } : {}),
  };
};

export const mapToPlayer = (prismaResult: PrismaPlayer): Player => {
  return {
    id: prismaResult.id,
    tournamentId: prismaResult.tournamentId,
    ...(prismaResult.personId ? { personId: prismaResult.personId } : {}),
    firstName: prismaResult.firstName,
    lastName: prismaResult.lastName,
    ...(prismaResult.surname ? { surname: prismaResult.surname } : {}),
    ...(prismaResult.teamName ? { teamName: prismaResult.teamName } : {}),
    ...(prismaResult.email ? { email: prismaResult.email } : {}),
    ...(prismaResult.phone ? { phone: prismaResult.phone } : {}),
    ...(prismaResult.skillLevel
      ? { skillLevel: prismaResult.skillLevel as SkillLevel }
      : {}),
    registeredAt: prismaResult.registeredAt,
    isActive: prismaResult.isActive,
    checkedIn: prismaResult.checkedIn,
  };
};
