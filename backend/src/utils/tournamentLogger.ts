import { Request } from 'express';
import logger from './logger';

/**
 * Tournament-specific logging utilities
 */

export enum TournamentLogEvent {
  CREATED = 'TOURNAMENT_CREATED',
  UPDATED = 'TOURNAMENT_UPDATED',
  DELETED = 'TOURNAMENT_DELETED',
  STATUS_CHANGED = 'TOURNAMENT_STATUS_CHANGED',
  PLAYER_REGISTERED = 'PLAYER_REGISTERED',
  PLAYER_UNREGISTERED = 'PLAYER_UNREGISTERED',
  LOGO_UPLOADED = 'TOURNAMENT_LOGO_UPLOADED',
  LOGO_DELETED = 'TOURNAMENT_LOGO_DELETED',
  VALIDATION_ERROR = 'TOURNAMENT_VALIDATION_ERROR',
  ACCESS_ERROR = 'TOURNAMENT_ACCESS_ERROR',
}

interface TournamentLogData {
  tournamentId?: string;
  tournamentName?: string;
  playerId?: string;
  playerName?: string;
  previousStatus?: string;
  newStatus?: string;
  previousData?: unknown;
  newData?: unknown;
  errorCode?: string;
  errorMessage?: string;
  userId?: string;
  userRole?: string;
  metadata?: Record<string, unknown>;
}

export class TournamentLogger {
  private readonly correlationId?: string;
  private readonly userId?: string;

  constructor(req?: Request) {
    if (req) {
      if (req.correlationId !== undefined) {
        this.correlationId = req.correlationId;
      }
      const authUser = (req as { user?: { id?: string } }).user;
      if (authUser?.id !== undefined) {
        this.userId = authUser.id;
      }
    }
  }

  private log(
    level: 'info' | 'warn' | 'error' | 'debug',
    event: TournamentLogEvent,
    message: string,
    data?: TournamentLogData
  ) {
    const logData = {
      event,
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(this.userId && { userId: this.userId }),
      ...(data?.tournamentId && { tournamentId: data.tournamentId }),
      ...(data?.playerId && { playerId: data.playerId }),
      metadata: {
        timestamp: new Date().toISOString(),
        ...data?.metadata,
        ...(data && {
          tournamentName: data.tournamentName,
          playerName: data.playerName,
          previousStatus: data.previousStatus,
          newStatus: data.newStatus,
          errorCode: data.errorCode,
          errorMessage: data.errorMessage,
          userRole: data.userRole,
        }),
      },
    };

    logger[level](message, logData);
  }

  // Tournament lifecycle events
  tournamentCreated(tournamentId: string, tournamentName: string, data?: unknown) {
    this.log(
      'info',
      TournamentLogEvent.CREATED,
      `Tournament created: ${tournamentName}`,
      {
        tournamentId,
        tournamentName,
        newData: data,
      }
    );
  }

  tournamentUpdated(
    tournamentId: string,
    tournamentName: string,
    previousData?: unknown,
    newData?: unknown
  ) {
    this.log(
      'info',
      TournamentLogEvent.UPDATED,
      `Tournament updated: ${tournamentName}`,
      {
        tournamentId,
        tournamentName,
        previousData,
        newData,
      }
    );
  }

  tournamentDeleted(tournamentId: string, tournamentName: string) {
    this.log(
      'info',
      TournamentLogEvent.DELETED,
      `Tournament deleted: ${tournamentName}`,
      {
        tournamentId,
        tournamentName,
      }
    );
  }

  tournamentStatusChanged(
    tournamentId: string,
    tournamentName: string,
    previousStatus: string,
    newStatus: string
  ) {
    this.log(
      'info',
      TournamentLogEvent.STATUS_CHANGED,
      `Tournament status changed from ${previousStatus} to ${newStatus}: ${tournamentName}`,
      {
        tournamentId,
        tournamentName,
        previousStatus,
        newStatus,
      }
    );
  }

  // Player registration events
  playerRegistered(
    tournamentId: string,
    tournamentName: string,
    playerId: string,
    playerName?: string
  ) {
    const data: TournamentLogData = {
      tournamentId,
      tournamentName,
      playerId,
      ...(playerName ? { playerName } : {}),
    };

    this.log(
      'info',
      TournamentLogEvent.PLAYER_REGISTERED,
      `Player registered for tournament: ${playerName ?? playerId} → ${tournamentName}`,
      data
    );
  }

  playerUnregistered(
    tournamentId: string,
    tournamentName: string,
    playerId: string,
    playerName?: string
  ) {
    const data: TournamentLogData = {
      tournamentId,
      tournamentName,
      playerId,
      ...(playerName ? { playerName } : {}),
    };

    this.log(
      'info',
      TournamentLogEvent.PLAYER_UNREGISTERED,
      `Player unregistered from tournament: ${playerName ?? playerId} ← ${tournamentName}`,
      data
    );
  }

  // Logo management events
  logoUploaded(tournamentId: string, tournamentName: string, logoUrl: string) {
    this.log(
      'info',
      TournamentLogEvent.LOGO_UPLOADED,
      `Logo uploaded for tournament: ${tournamentName}`,
      {
        tournamentId,
        tournamentName,
        metadata: { logoUrl },
      }
    );
  }

  logoDeleted(tournamentId: string, tournamentName: string) {
    this.log(
      'info',
      TournamentLogEvent.LOGO_DELETED,
      `Logo deleted for tournament: ${tournamentName}`,
      {
        tournamentId,
        tournamentName,
      }
    );
  }

  // Error events
  validationError(
    errorCode: string,
    errorMessage: string,
    tournamentId?: string,
    tournamentName?: string
  ) {
    const data: TournamentLogData = {
      ...(tournamentId ? { tournamentId } : {}),
      ...(tournamentName ? { tournamentName } : {}),
      errorCode,
      errorMessage,
    };

    this.log(
      'warn',
      TournamentLogEvent.VALIDATION_ERROR,
      `Tournament validation error: ${errorMessage}`,
      data
    );
  }

  accessError(
    errorCode: string,
    errorMessage: string,
    tournamentId?: string,
    tournamentName?: string
  ) {
    const data: TournamentLogData = {
      ...(tournamentId ? { tournamentId } : {}),
      ...(tournamentName ? { tournamentName } : {}),
      errorCode,
      errorMessage,
    };

    this.log(
      'error',
      TournamentLogEvent.ACCESS_ERROR,
      `Tournament access error: ${errorMessage}`,
      data
    );
  }

  // Generic error logging
  error(message: string, tournamentId?: string, error?: unknown) {
    const isObjectError = typeof error === 'object' && error !== null;
    const errorInfo = isObjectError
      ? (error as { message?: string; code?: string; stack?: string })
      : undefined;
    const errorMetadata = isObjectError ? (error as Record<string, unknown>) : undefined;

    const metadata: Record<string, unknown> = {};
    if (errorInfo?.stack) {
      metadata.stack = errorInfo.stack;
    }
    if (errorMetadata) {
      Object.assign(metadata, errorMetadata);
    }

    const data: TournamentLogData = {
      ...(tournamentId ? { tournamentId } : {}),
      ...(errorInfo?.message ? { errorMessage: errorInfo.message } : {}),
      ...(errorInfo?.code ? { errorCode: errorInfo.code } : {}),
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    };

    this.log(
      'error',
      TournamentLogEvent.ACCESS_ERROR,
      message,
      data
    );
  }
}

export default TournamentLogger;