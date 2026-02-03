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
  tournamentId?: string | undefined;
  tournamentName?: string | undefined;
  playerId?: string | undefined;
  playerName?: string | undefined;
  previousStatus?: string | undefined;
  newStatus?: string | undefined;
  previousData?: any;
  newData?: any;
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
  userId?: string | undefined;
  userRole?: string | undefined;
  metadata?: any;
}

export class TournamentLogger {
  private correlationId?: string | undefined;
  private userId?: string | undefined;

  constructor(req?: Request) {
    if (req) {
      this.correlationId = req.correlationId || undefined;
      this.userId = (req as any).user?.id || undefined; // Assuming user is attached to request
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
  tournamentCreated(tournamentId: string, tournamentName: string, data?: any) {
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
    previousData?: any,
    newData?: any
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
    this.log(
      'info',
      TournamentLogEvent.PLAYER_REGISTERED,
      `Player registered for tournament: ${playerName || playerId} → ${tournamentName}`,
      {
        tournamentId,
        tournamentName,
        playerId,
        playerName,
      }
    );
  }

  playerUnregistered(
    tournamentId: string,
    tournamentName: string,
    playerId: string,
    playerName?: string
  ) {
    this.log(
      'info',
      TournamentLogEvent.PLAYER_UNREGISTERED,
      `Player unregistered from tournament: ${playerName || playerId} ← ${tournamentName}`,
      {
        tournamentId,
        tournamentName,
        playerId,
        playerName,
      }
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
    this.log(
      'warn',
      TournamentLogEvent.VALIDATION_ERROR,
      `Tournament validation error: ${errorMessage}`,
      {
        tournamentId,
        tournamentName,
        errorCode,
        errorMessage,
      }
    );
  }

  accessError(
    errorCode: string,
    errorMessage: string,
    tournamentId?: string,
    tournamentName?: string
  ) {
    this.log(
      'error',
      TournamentLogEvent.ACCESS_ERROR,
      `Tournament access error: ${errorMessage}`,
      {
        tournamentId,
        tournamentName,
        errorCode,
        errorMessage,
      }
    );
  }

  // Generic error logging
  error(message: string, tournamentId?: string, error?: any) {
    this.log(
      'error',
      TournamentLogEvent.ACCESS_ERROR,
      message,
      {
        tournamentId,
        errorMessage: error?.message,
        errorCode: error?.code,
        metadata: {
          stack: error?.stack,
          ...error,
        },
      }
    );
  }
}

export default TournamentLogger;