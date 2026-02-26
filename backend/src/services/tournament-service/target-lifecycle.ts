import { MatchStatus, TargetStatus } from '../../../../shared/src/types';
import { AppError } from '../../middleware/error-handler';

type MatchReference = {
  id: string;
  bracketId?: string | null;
  targetId?: string | null;
};

type TargetReference = {
  id: string;
  tournamentId: string;
  status: string;
  currentMatchId?: string | null;
};

type ExistingMatchReference = {
  status?: MatchStatus | string | null;
  completedAt?: Date | null;
};

type TargetLifecycleDependencies = {
  getTargetById: (targetId: string) => Promise<TargetReference | null | undefined>;
  getBracketTargetIds: (bracketId: string) => Promise<string[]>;
  getMatchById: (matchId: string) => Promise<ExistingMatchReference | null | undefined>;
  setTargetAvailable: (targetId: string) => Promise<unknown>;
  finishMatchAndReleaseTarget: (
    matchId: string,
    targetId: string,
    status: MatchStatus,
    timestamps: { completedAt?: Date }
  ) => Promise<unknown>;
};

export const assertValidMatchTransition = (
  currentStatus: MatchStatus,
  nextStatus: MatchStatus
): void => {
  const validTransitions: Record<MatchStatus, MatchStatus[]> = {
    [MatchStatus.SCHEDULED]: [MatchStatus.IN_PROGRESS, MatchStatus.CANCELLED],
    [MatchStatus.IN_PROGRESS]: [MatchStatus.COMPLETED, MatchStatus.CANCELLED, MatchStatus.SCHEDULED],
    [MatchStatus.COMPLETED]: [MatchStatus.IN_PROGRESS],
    [MatchStatus.CANCELLED]: [],
  };

  if (!validTransitions[currentStatus].includes(nextStatus)) {
    throw new AppError(
      `Invalid match status transition from ${currentStatus} to ${nextStatus}`,
      400,
      'INVALID_MATCH_STATUS_TRANSITION'
    );
  }
};

const resolveTargetSelection = (
  match: MatchReference | null | undefined,
  targetId: string | undefined
): string => {
  const targetToUse = match?.targetId ?? targetId;
  if (!targetToUse) {
    throw new AppError('Target must be selected before starting a match', 400, 'TARGET_REQUIRED');
  }
  return targetToUse;
};

const ensureTargetExistsForTournament = (
  target: TargetReference | null | undefined,
  tournamentId: string
) : TargetReference => {
  if (target?.tournamentId !== tournamentId) {
    throw new AppError('Target not found', 404, 'TARGET_NOT_FOUND');
  }
  return target;
};

const ensureTargetAssignedToBracket = async (
  bracketId: string | null | undefined,
  targetId: string,
  dependencies: TargetLifecycleDependencies
): Promise<void> => {
  if (!bracketId) return;
  const targetIds = await dependencies.getBracketTargetIds(bracketId);
  if (targetIds.length === 0) {
    return;
  }
  if (!targetIds.includes(targetId)) {
    throw new AppError(
      'Target is not assigned to this bracket',
      400,
      'TARGET_NOT_ASSIGNED_TO_BRACKET'
    );
  }
};

const releaseStaleTargetUsage = async (
  target: TargetReference,
  dependencies: TargetLifecycleDependencies
): Promise<void> => {
  if (!target.currentMatchId) {
    await dependencies.setTargetAvailable(target.id);
    return;
  }

  const currentMatch = await dependencies.getMatchById(target.currentMatchId);
  if (currentMatch?.status === MatchStatus.IN_PROGRESS) {
    throw new AppError('Target is not available', 400, 'TARGET_NOT_AVAILABLE');
  }

  if (currentMatch && (currentMatch.status === MatchStatus.COMPLETED || currentMatch.status === MatchStatus.CANCELLED)) {
    await dependencies.finishMatchAndReleaseTarget(
      target.currentMatchId,
      target.id,
      currentMatch.status,
      { completedAt: currentMatch.completedAt ?? new Date() }
    );
    return;
  }

  await dependencies.setTargetAvailable(target.id);
};

const ensureTargetAvailability = async (
  target: TargetReference,
  dependencies: TargetLifecycleDependencies
): Promise<void> => {
  if (target.status === TargetStatus.IN_USE) {
    await releaseStaleTargetUsage(target, dependencies);
    return;
  }
  if (target.status !== TargetStatus.AVAILABLE) {
    throw new AppError('Target is not available', 400, 'TARGET_NOT_AVAILABLE');
  }
};

export const ensureTargetForMatchStart = async (
  match: MatchReference | null | undefined,
  targetId: string | undefined,
  tournamentId: string,
  dependencies: TargetLifecycleDependencies
): Promise<string> => {
  const targetToUse = resolveTargetSelection(match, targetId);
  const rawTarget = await dependencies.getTargetById(targetToUse);
  const target = ensureTargetExistsForTournament(rawTarget, tournamentId);
  await ensureTargetAssignedToBracket(match?.bracketId, targetToUse, dependencies);
  await ensureTargetAvailability(target, dependencies);
  return targetToUse;
};
