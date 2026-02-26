import { MatchStatus, TargetStatus } from '../../../shared/src/types';
import { AppError } from '../../src/middleware/error-handler';
import {
  assertValidMatchTransition,
  ensureTargetForMatchStart,
} from '../../src/services/tournament-service/target-lifecycle';

type Dependencies = {
  getTargetById: jest.Mock;
  getBracketTargetIds: jest.Mock;
  getMatchById: jest.Mock;
  setTargetAvailable: jest.Mock;
  finishMatchAndReleaseTarget: jest.Mock;
};

const buildDependencies = (): Dependencies => ({
  getTargetById: jest.fn(),
  getBracketTargetIds: jest.fn().mockResolvedValue([]),
  getMatchById: jest.fn(),
  setTargetAvailable: jest.fn().mockResolvedValue(undefined),
  finishMatchAndReleaseTarget: jest.fn().mockResolvedValue(undefined),
});

describe('target lifecycle helpers', () => {
  it('validates allowed transitions and rejects invalid ones', () => {
    expect(() => assertValidMatchTransition(MatchStatus.SCHEDULED, MatchStatus.IN_PROGRESS)).not.toThrow();
    expect(() => assertValidMatchTransition(MatchStatus.COMPLETED, MatchStatus.IN_PROGRESS)).not.toThrow();

    expect(() => assertValidMatchTransition(MatchStatus.CANCELLED, MatchStatus.SCHEDULED)).toThrow(AppError);
  });

  it('requires a target when starting a match', async () => {
    const dependencies = buildDependencies();

    await expect(ensureTargetForMatchStart(
      { id: 'match-1', targetId: null },
      undefined,
      'tournament-1',
      dependencies
    )).rejects.toThrow('Target must be selected before starting a match');
  });

  it('fails when target does not belong to tournament', async () => {
    const dependencies = buildDependencies();
    dependencies.getTargetById.mockResolvedValue({
      id: 'target-1',
      tournamentId: 'other-tournament',
      status: TargetStatus.AVAILABLE,
    });

    await expect(ensureTargetForMatchStart(
      { id: 'match-1' },
      'target-1',
      'tournament-1',
      dependencies
    )).rejects.toThrow('Target not found');
  });

  it('fails when bracket target is not assigned to bracket', async () => {
    const dependencies = buildDependencies();
    dependencies.getTargetById.mockResolvedValue({
      id: 'target-1',
      tournamentId: 'tournament-1',
      status: TargetStatus.AVAILABLE,
    });
    dependencies.getBracketTargetIds.mockResolvedValue(['target-2']);

    await expect(ensureTargetForMatchStart(
      { id: 'match-1', bracketId: 'bracket-1' },
      'target-1',
      'tournament-1',
      dependencies
    )).rejects.toThrow('Target is not assigned to this bracket');
  });

  it('releases stale usage for in-use target without current match id', async () => {
    const dependencies = buildDependencies();
    dependencies.getTargetById.mockResolvedValue({
      id: 'target-1',
      tournamentId: 'tournament-1',
      status: TargetStatus.IN_USE,
      currentMatchId: null,
    });

    await expect(ensureTargetForMatchStart(
      { id: 'match-1' },
      'target-1',
      'tournament-1',
      dependencies
    )).resolves.toBe('target-1');

    expect(dependencies.setTargetAvailable).toHaveBeenCalledWith('target-1');
  });

  it('rejects in-use target when current match is still in progress', async () => {
    const dependencies = buildDependencies();
    dependencies.getTargetById.mockResolvedValue({
      id: 'target-1',
      tournamentId: 'tournament-1',
      status: TargetStatus.IN_USE,
      currentMatchId: 'match-running',
    });
    dependencies.getMatchById.mockResolvedValue({ status: MatchStatus.IN_PROGRESS });

    await expect(ensureTargetForMatchStart(
      { id: 'match-1' },
      'target-1',
      'tournament-1',
      dependencies
    )).rejects.toThrow('Target is not available');
  });

  it('releases completed stale match and allows target selection', async () => {
    const completedAt = new Date('2026-01-01T10:00:00.000Z');
    const dependencies = buildDependencies();
    dependencies.getTargetById.mockResolvedValue({
      id: 'target-1',
      tournamentId: 'tournament-1',
      status: TargetStatus.IN_USE,
      currentMatchId: 'old-match',
    });
    dependencies.getMatchById.mockResolvedValue({
      status: MatchStatus.COMPLETED,
      completedAt,
    });

    await expect(ensureTargetForMatchStart(
      { id: 'match-1' },
      'target-1',
      'tournament-1',
      dependencies
    )).resolves.toBe('target-1');

    expect(dependencies.finishMatchAndReleaseTarget).toHaveBeenCalledWith(
      'old-match',
      'target-1',
      MatchStatus.COMPLETED,
      { completedAt }
    );
  });

  it('rejects non available target status', async () => {
    const dependencies = buildDependencies();
    dependencies.getTargetById.mockResolvedValue({
      id: 'target-1',
      tournamentId: 'tournament-1',
      status: TargetStatus.MAINTENANCE,
    });

    await expect(ensureTargetForMatchStart(
      { id: 'match-1' },
      'target-1',
      'tournament-1',
      dependencies
    )).rejects.toThrow('Target is not available');
  });

  it('accepts available target and resolves selected target id', async () => {
    const dependencies = buildDependencies();
    dependencies.getTargetById.mockResolvedValue({
      id: 'target-1',
      tournamentId: 'tournament-1',
      status: TargetStatus.AVAILABLE,
    });

    await expect(ensureTargetForMatchStart(
      { id: 'match-1', targetId: 'target-1' },
      undefined,
      'tournament-1',
      dependencies
    )).resolves.toBe('target-1');

    expect(dependencies.setTargetAvailable).not.toHaveBeenCalled();
    expect(dependencies.finishMatchAndReleaseTarget).not.toHaveBeenCalled();
  });
});
