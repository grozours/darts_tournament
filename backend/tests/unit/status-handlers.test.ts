import { TournamentFormat, TournamentStatus } from '../../../shared/src/types';
import { AppError } from '../../src/middleware/error-handler';
import { createStatusHandlers } from '../../src/services/tournament-service/status-handlers';

const baseTournament = {
  id: 't1',
  name: 'Tournament',
  format: TournamentFormat.SINGLE,
  status: TournamentStatus.DRAFT,
  startTime: new Date(Date.now() + 3600000),
  endTime: new Date(Date.now() + 7200000),
  totalParticipants: 8,
  targetCount: 4,
};

const buildContext = () => {
  const tournamentModel = {
    findById: jest.fn(),
    countRegisteredDoublettes: jest.fn().mockResolvedValue(0),
    countRegisteredEquipes: jest.fn().mockResolvedValue(0),
    getParticipantCount: jest.fn().mockResolvedValue(0),
    getCheckedInCount: jest.fn().mockResolvedValue(0),
    updateStatus: jest.fn(),
  };

  const logger = {
    accessError: jest.fn(),
    validationError: jest.fn(),
    error: jest.fn(),
    tournamentStatusChanged: jest.fn(),
  };

  return {
    tournamentModel,
    logger,
    validateUUID: jest.fn(),
    handlers: createStatusHandlers({
      tournamentModel,
      logger,
      validateUUID: jest.fn(),
    } as never),
  };
};

describe('status-handlers', () => {
  it('throws not found when tournament does not exist', async () => {
    const { handlers, tournamentModel, logger } = buildContext();
    tournamentModel.findById.mockResolvedValue(null);

    await expect(handlers.openTournamentRegistration('t1')).rejects.toMatchObject({ code: 'TOURNAMENT_NOT_FOUND' });
    expect(logger.accessError).toHaveBeenCalled();
  });

  it('rejects invalid status transition and logs validation error', async () => {
    const { handlers, tournamentModel, logger } = buildContext();
    tournamentModel.findById.mockResolvedValue({ ...baseTournament, status: TournamentStatus.DRAFT });

    await expect(handlers.startTournament('t1')).rejects.toBeInstanceOf(AppError);
    expect(logger.validationError).toHaveBeenCalled();
  });

  it('rejects opening registration for tournament in the past', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findById.mockResolvedValue({
      ...baseTournament,
      status: TournamentStatus.DRAFT,
      endTime: new Date(Date.now() - 1000),
    });

    await expect(handlers.openTournamentRegistration('t1')).rejects.toMatchObject({ code: 'TOURNAMENT_END_TIME_PASSED' });
  });

  it('rejects opening registration with insufficient slots or targets', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findById.mockResolvedValue({
      ...baseTournament,
      status: TournamentStatus.DRAFT,
      totalParticipants: 1,
    });

    await expect(handlers.openTournamentRegistration('t1')).rejects.toMatchObject({ code: 'INSUFFICIENT_PARTICIPANT_CAPACITY' });

    tournamentModel.findById.mockResolvedValue({
      ...baseTournament,
      status: TournamentStatus.DRAFT,
      targetCount: 0,
    });

    await expect(handlers.openTournamentRegistration('t1')).rejects.toMatchObject({ code: 'INSUFFICIENT_TARGET_COUNT' });
  });

  it('rejects starting before start time when not all participants are checked in', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findById.mockResolvedValue({
      ...baseTournament,
      status: TournamentStatus.SIGNATURE,
      startTime: new Date(Date.now() + 3600000),
    });
    tournamentModel.getParticipantCount.mockResolvedValue(3);
    tournamentModel.getCheckedInCount.mockResolvedValue(2);

    await expect(handlers.startTournament('t1')).rejects.toMatchObject({ code: 'TOURNAMENT_START_TIME_NOT_REACHED' });
  });

  it('uses format-specific registered slot counters when starting tournament', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findById.mockResolvedValue({
      ...baseTournament,
      format: TournamentFormat.DOUBLE,
      status: TournamentStatus.SIGNATURE,
      startTime: new Date(Date.now() - 1000),
    });
    tournamentModel.countRegisteredDoublettes.mockResolvedValue(1);

    await expect(handlers.startTournament('t1')).rejects.toMatchObject({ code: 'INSUFFICIENT_PARTICIPANTS' });

    tournamentModel.findById.mockResolvedValue({
      ...baseTournament,
      format: TournamentFormat.TEAM_4_PLAYER,
      status: TournamentStatus.SIGNATURE,
      startTime: new Date(Date.now() - 1000),
    });
    tournamentModel.countRegisteredEquipes.mockResolvedValue(2);
    tournamentModel.updateStatus.mockResolvedValue({ ...baseTournament, status: TournamentStatus.LIVE });

    await expect(handlers.startTournament('t1')).resolves.toMatchObject({ status: TournamentStatus.LIVE });
    expect(tournamentModel.countRegisteredDoublettes).toHaveBeenCalled();
    expect(tournamentModel.countRegisteredEquipes).toHaveBeenCalled();
  });

  it('rejects finishing when tournament is not live', async () => {
    const { handlers, tournamentModel } = buildContext();
    tournamentModel.findById.mockResolvedValue({ ...baseTournament, status: TournamentStatus.SIGNATURE });

    await expect(handlers.completeTournament('t1')).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
  });

  it('supports forced transition and sets completed date on finish', async () => {
    const { handlers, tournamentModel, logger } = buildContext();
    tournamentModel.findById.mockResolvedValue({ ...baseTournament, status: TournamentStatus.LIVE });
    tournamentModel.updateStatus.mockResolvedValue({ ...baseTournament, status: TournamentStatus.FINISHED });

    await expect(handlers.transitionTournamentStatus('t1', TournamentStatus.FINISHED, true)).resolves.toMatchObject({
      status: TournamentStatus.FINISHED,
    });
    expect(tournamentModel.updateStatus).toHaveBeenCalledWith('t1', TournamentStatus.FINISHED, expect.any(Date));
    expect(logger.tournamentStatusChanged).toHaveBeenCalled();
  });

  it('allows transition from LIVE back to SIGNATURE', async () => {
    const { handlers, tournamentModel, logger } = buildContext();
    tournamentModel.findById.mockResolvedValue({ ...baseTournament, status: TournamentStatus.LIVE });
    tournamentModel.updateStatus.mockResolvedValue({ ...baseTournament, status: TournamentStatus.SIGNATURE });

    await expect(handlers.transitionTournamentStatus('t1', TournamentStatus.SIGNATURE)).resolves.toMatchObject({
      status: TournamentStatus.SIGNATURE,
    });

    expect(tournamentModel.updateStatus).toHaveBeenCalledWith('t1', TournamentStatus.SIGNATURE, undefined);
    expect(logger.tournamentStatusChanged).toHaveBeenCalledWith(
      't1',
      'Tournament',
      TournamentStatus.LIVE,
      TournamentStatus.SIGNATURE
    );
  });

  it('allows transition from FINISHED back to LIVE', async () => {
    const { handlers, tournamentModel, logger } = buildContext();
    tournamentModel.findById.mockResolvedValue({
      ...baseTournament,
      status: TournamentStatus.FINISHED,
      startTime: new Date(Date.now() - 1000),
    });
    tournamentModel.getParticipantCount.mockResolvedValue(8);
    tournamentModel.updateStatus.mockResolvedValue({ ...baseTournament, status: TournamentStatus.LIVE });

    await expect(handlers.transitionTournamentStatus('t1', TournamentStatus.LIVE)).resolves.toMatchObject({
      status: TournamentStatus.LIVE,
    });

    expect(tournamentModel.updateStatus).toHaveBeenCalledWith('t1', TournamentStatus.LIVE, undefined);
    expect(logger.tournamentStatusChanged).toHaveBeenCalledWith(
      't1',
      'Tournament',
      TournamentStatus.FINISHED,
      TournamentStatus.LIVE
    );
  });

  it('logs and rethrows unexpected errors', async () => {
    const { handlers, tournamentModel, logger } = buildContext();
    tournamentModel.findById.mockResolvedValue({
      ...baseTournament,
      status: TournamentStatus.DRAFT,
      targetCount: 4,
      totalParticipants: 8,
    });
    tournamentModel.updateStatus.mockRejectedValue(new Error('db failed'));

    await expect(handlers.openTournamentRegistration('t1')).rejects.toThrow('db failed');
    expect(logger.error).toHaveBeenCalled();
  });
});
