import { Server as SocketServer } from 'socket.io';
import { redis } from '../config/redis';
import logger from '../utils/logger';
import type {
  MatchFinishedPayload,
  MatchFormatChangedPayload,
  MatchStartedPayload,
  PlayerSummary,
  PoolAssignmentPayload,
  SchedulePayload,
  ScorePayload,
} from './websocket-types';

export class WebSocketService {
  private readonly io: SocketServer;

  constructor(io: SocketServer) {
    this.io = io;
  }

  async emitTournamentUpdated(tournamentId: string, status: string): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('tournament:updated', { tournamentId, status });

      await redis.getClient().setex(
        `event:tournament:${tournamentId}:updated`,
        300,
        JSON.stringify({ tournamentId, status, timestamp: Date.now() })
      );

      logger.debug('Tournament updated event emitted', {
        metadata: { tournamentId, status },
      });
    } catch (error) {
      logger.error('Failed to emit tournament updated event', {
        metadata: {
          tournamentId,
          status,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async emitMatchFormatChanged(payload: MatchFormatChangedPayload): Promise<void> {
    try {
      this.io.to(`tournament-${payload.tournamentId}`).emit('match:format-changed', payload);

      logger.debug('Match format changed event emitted', {
        metadata: { matchId: payload.matchId, tournamentId: payload.tournamentId, matchFormatKey: payload.matchFormatKey },
      });
    } catch (error) {
      logger.error('Failed to emit match format changed event', {
        metadata: {
          matchId: payload.matchId,
          tournamentId: payload.tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async emitPlayerRegistered(tournamentId: string, player: PlayerSummary): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('tournament:player-registered', {
        tournamentId,
        player,
      });

      logger.debug('Player registered event emitted', {
        metadata: { tournamentId, playerId: player.id },
      });
    } catch (error) {
      logger.error('Failed to emit player registered event', {
        metadata: {
          tournamentId,
          playerId: player.id,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async emitMatchScoreUpdated(matchId: string, tournamentId: string, score: ScorePayload): Promise<void> {
    try {
      const startTime = Date.now();

      this.io.to(`tournament-${tournamentId}`).emit('match:score-updated', {
        matchId,
        tournamentId,
        score,
      });

      const duration = Date.now() - startTime;
      if (duration > 100) {
        logger.warn('Slow websocket emission', {
          metadata: { matchId, tournamentId, durationMs: duration },
        });
      }

      logger.debug('Match score updated event emitted', {
        metadata: { matchId, tournamentId, durationMs: duration },
      });
    } catch (error) {
      logger.error('Failed to emit match score update', {
        metadata: {
          matchId,
          tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async emitMatchCompleted(matchId: string, tournamentId: string, winner: PlayerSummary): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('match:completed', {
        matchId,
        tournamentId,
        winner,
      });

      logger.debug('Match completed event emitted', {
        metadata: { matchId, tournamentId, winnerId: winner?.id },
      });
    } catch (error) {
      logger.error('Failed to emit match completed event', {
        metadata: {
          matchId,
          tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async emitMatchFinished(payload: MatchFinishedPayload): Promise<void> {
    try {
      this.io.to(`tournament-${payload.tournamentId}`).emit('match:finished', payload);

      logger.debug('Match finished event emitted', {
        metadata: { matchId: payload.matchId, tournamentId: payload.tournamentId, event: payload.event },
      });
    } catch (error) {
      logger.error('Failed to emit match finished event', {
        metadata: {
          matchId: payload.matchId,
          tournamentId: payload.tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async emitMatchStarted(payload: MatchStartedPayload): Promise<void> {
    try {
      this.io.to(`tournament-${payload.tournamentId}`).emit('match:started', payload);

      logger.info('Match started event emitted', {
        metadata: {
          matchId: payload.matchId,
          tournamentId: payload.tournamentId,
          targetNumber: payload.target?.targetNumber,
        },
      });
    } catch (error) {
      logger.error('Failed to emit match started event', {
        metadata: {
          matchId: payload.matchId,
          tournamentId: payload.tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async emitTargetAvailable(targetId: string, tournamentId: string): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('target:available', {
        targetId,
        tournamentId,
      });

      logger.debug('Target available event emitted', {
        metadata: { targetId, tournamentId },
      });
    } catch (error) {
      logger.error('Failed to emit target available event', {
        metadata: {
          targetId,
          tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async emitPoolAssigned(tournamentId: string, poolAssignments: PoolAssignmentPayload[]): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('pool:assigned', {
        tournamentId,
        poolAssignments,
      });

      logger.debug('Pool assigned event emitted', {
        metadata: { tournamentId, assignmentsCount: poolAssignments.length },
      });
    } catch (error) {
      logger.error('Failed to emit pool assigned event', {
        metadata: {
          tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async emitScheduleGenerated(tournamentId: string, schedule: SchedulePayload): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('schedule:generated', {
        tournamentId,
        schedule,
      });

      logger.debug('Schedule generated event emitted', {
        metadata: { tournamentId },
      });
    } catch (error) {
      logger.error('Failed to emit schedule generated event', {
        metadata: {
          tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async getConnectedClientsCount(tournamentId: string): Promise<number> {
    try {
      const clients = await redis.getClient().scard(`tournament:${tournamentId}:clients`);
      return clients;
    } catch (error) {
      logger.error('Failed to get connected clients count', {
        metadata: {
          tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      return 0;
    }
  }
}

export default WebSocketService;